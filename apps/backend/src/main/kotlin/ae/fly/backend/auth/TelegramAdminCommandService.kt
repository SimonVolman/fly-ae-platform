package ae.fly.backend.auth

import ae.fly.backend.config.StorageProperties
import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
import ae.fly.backend.domain.User
import ae.fly.backend.ports.ObjectStorage
import ae.fly.backend.repository.DocumentRepository
import ae.fly.backend.repository.UserRepository
import org.springframework.stereotype.Service
import java.util.Locale
import java.util.UUID

@Service
class TelegramAdminCommandService(
    private val telegram: TelegramProperties,
    private val botClient: TelegramBotClient,
    private val users: UserRepository,
    private val documents: DocumentRepository,
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
) {
    fun handle(message: TelegramMessage): Boolean {
        val match = COMMAND.matchEntire(message.text?.trim().orEmpty()) ?: return false
        val command = match.groupValues[1].lowercase()
        if (command !in ADMIN_COMMANDS) return false

        val chatId = telegram.adminChatId
        if (chatId <= 0 || message.chat.type != "private" || message.chat.id != chatId) {
            // Do not reveal that admin commands exist to any other Telegram user or chat.
            return true
        }

        val argument = match.groupValues.getOrElse(2) { "" }.trim()
        when (command) {
            "admin" -> sendHelp(chatId)
            "activity", "recent" -> sendRecentActivity(chatId, argument)
            "users" -> sendRecentUsers(chatId, argument)
            "files" -> sendUserFiles(chatId, argument)
            "file" -> sendFile(chatId, argument)
        }
        return true
    }

    private fun sendHelp(chatId: Long) {
        botClient.sendAdminMessage(
            chatId,
            "🔐 fly.ae admin\n\n" +
                "/activity [N] — последние загруженные файлы\n" +
                "/users [N] — последние пользователи\n" +
                "/files <email|user UUID|Telegram ID> [N] — файлы пользователя\n" +
                "/file <document UUID> — информация и ссылка на один файл\n\n" +
                "N — любое положительное число, по умолчанию $DEFAULT_LIMIT.\n" +
                "Ссылки приватные и действуют ${storageProperties.downloadSignatureTtl.toMinutes()} минут.",
        )
    }

    private fun sendRecentActivity(chatId: Long, argument: String) {
        val limit = parseLimit(chatId, argument, "/activity") ?: return
        val recent = documents.findRecent(limit)
            .asSequence()
            .filter(::isDownloadable)
            .take(limit)
            .toList()
        sendDocuments(chatId, "Последние загрузки", recent)
    }

    private fun sendRecentUsers(chatId: Long, argument: String) {
        val limit = parseLimit(chatId, argument, "/users") ?: return
        val recent = users.findRecent(limit)
        if (recent.isEmpty()) {
            botClient.sendAdminMessage(chatId, "Пользователи пока не найдены.")
            return
        }
        recent.withIndex().toList().chunked(USERS_PER_MESSAGE).forEach { chunk ->
            val text = buildString {
                append(batchTitle("Последние пользователи", chunk, recent.size)).append("\n\n")
                chunk.forEach { (index, user) ->
                    append(index + 1).append(". ").append(userIdentity(user)).append('\n')
                    append("ID: ").append(user.id).append('\n')
                    append("Создан: ").append(user.createdAt).append('\n')
                    append("Обновлён: ").append(user.updatedAt).append("\n\n")
                }
            }
            botClient.sendAdminMessage(chatId, text.trimEnd())
        }
    }

    private fun sendUserFiles(chatId: Long, argument: String) {
        val parts = argument.split(Regex("\\s+"), limit = 2).filter(String::isNotBlank)
        if (parts.isEmpty()) {
            botClient.sendAdminMessage(
                chatId,
                "Использование: /files <email|user UUID|Telegram ID> [N]",
            )
            return
        }
        val user = findUser(parts[0])
        if (user == null) {
            botClient.sendAdminMessage(chatId, "Пользователь не найден.")
            return
        }
        val limit = parseLimit(chatId, parts.getOrElse(1) { "" }, "/files ${parts[0]}") ?: return
        val userDocuments = documents.findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.id)
            .asSequence()
            .filter(::isDownloadable)
            .take(limit)
            .toList()
        sendDocuments(chatId, "Файлы ${userIdentity(user)}", userDocuments)
    }

    private fun sendFile(chatId: Long, argument: String) {
        val documentId = argument.toUuidOrNull()
        if (documentId == null) {
            botClient.sendAdminMessage(chatId, "Использование: /file <document UUID>")
            return
        }
        val document = documents.findById(documentId)?.takeIf(::isDownloadable)
        if (document == null) {
            botClient.sendAdminMessage(chatId, "Файл не найден или недоступен.")
            return
        }
        sendDocuments(chatId, "Файл", listOf(document))
    }

    private fun sendDocuments(chatId: Long, title: String, found: List<Document>) {
        if (found.isEmpty()) {
            botClient.sendAdminMessage(chatId, "$title: ничего не найдено.")
            return
        }

        found.withIndex().toList().chunked(DOCUMENTS_PER_MESSAGE).forEach { chunk ->
            val text = buildString {
                append(batchTitle(title, chunk, found.size)).append("\n\n")
                chunk.forEach { (index, document) ->
                    append(index + 1).append(". ").append(singleLine(document.originalFilename, 100)).append('\n')
                    append("Пользователь: ").append(documentOwner(document)).append('\n')
                    append("Категория: ").append(singleLine(document.category.name, 50)).append('\n')
                    append("MSN: ").append(singleLine(document.msn, 50).ifBlank { "—" }).append('\n')
                    append("Тип: ").append(singleLine(document.mimeType, 60)).append('\n')
                    append("Размер: ").append(formatFileSize(document.sizeBytes)).append('\n')
                    append("Статус: ").append(document.status.name).append('\n')
                    append("Создан: ").append(document.createdAt).append('\n')
                    append("Document ID: ").append(document.id).append("\n\n")
                }
            }.trimEnd()
            val buttons = chunk.map { (index, document) ->
                TelegramUrlButton(
                    text = "⬇️ ${index + 1}. ${singleLine(document.originalFilename, 50)}",
                    url = storage.signDownload(
                        document.objectKey,
                        storageProperties.downloadSignatureTtl,
                    ).toString(),
                )
            }
            botClient.sendAdminMessage(chatId, text, buttons)
        }
    }

    private fun findUser(candidate: String): User? {
        candidate.toUuidOrNull()?.let { return users.findById(it) }
        candidate.toLongOrNull()?.let { return users.findByTelegramUserId(it) }
        return users.findByEmail(candidate.lowercase())
    }

    private fun documentOwner(document: Document): String {
        val user = document.user?.id?.let(users::findById)
        return when {
            user != null -> "${userIdentity(user)} (${user.id})"
            document.user != null -> "User (${document.user?.id})"
            document.guestSession != null -> "Guest (${document.guestSession?.id})"
            else -> "Unknown"
        }
    }

    private fun userIdentity(user: User): String =
        user.email?.takeIf(String::isNotBlank)?.let { singleLine(it, 120) }
            ?: user.telegramUsername?.takeIf(String::isNotBlank)?.let { "@${singleLine(it, 64)}" }
            ?: user.telegramUserId?.let { "Telegram user $it" }
            ?: "User"

    private fun parseLimit(chatId: Long, argument: String, usage: String): Int? {
        if (argument.isBlank()) return DEFAULT_LIMIT
        val limit = argument.toIntOrNull()?.takeIf { it > 0 }
        if (limit == null) {
            botClient.sendAdminMessage(
                chatId,
                "Использование: $usage [N], N — положительное целое число",
            )
        }
        return limit
    }

    private fun <T> batchTitle(title: String, chunk: List<IndexedValue<T>>, total: Int): String {
        if (total <= chunk.size) return title
        return "$title (${chunk.first().index + 1}–${chunk.last().index + 1} из $total)"
    }

    private fun isDownloadable(document: Document): Boolean =
        document.deletedAt == null && document.status in DOWNLOADABLE_STATUSES

    private fun String.toUuidOrNull(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()

    private fun singleLine(value: String, maxLength: Int = 255): String =
        value.replace(Regex("[\\r\\n\\t]+"), " ").trim().take(maxLength)

    private fun formatFileSize(bytes: Long): String = when {
        bytes >= 1024L * 1024L * 1024L ->
            String.format(Locale.ROOT, "%.2f GB", bytes / (1024.0 * 1024.0 * 1024.0))
        bytes >= 1024L * 1024L ->
            String.format(Locale.ROOT, "%.2f MB", bytes / (1024.0 * 1024.0))
        bytes >= 1024L -> String.format(Locale.ROOT, "%.2f KB", bytes / 1024.0)
        else -> "$bytes B"
    }

    companion object {
        private const val DEFAULT_LIMIT = 10
        private const val USERS_PER_MESSAGE = 10
        private const val DOCUMENTS_PER_MESSAGE = 5
        private val ADMIN_COMMANDS = setOf("admin", "activity", "recent", "users", "files", "file")
        private val DOWNLOADABLE_STATUSES = setOf(
            DocumentStatus.PENDING,
            DocumentStatus.PROCESSING,
            DocumentStatus.APPROVED,
            DocumentStatus.REJECTED,
        )
        private val COMMAND = Regex(
            "^/([A-Za-z]+)(?:@[A-Za-z0-9_]{5,32})?(?:\\s+(.+))?$",
        )
    }
}
