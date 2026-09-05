package ae.fly.backend.share

import ae.fly.backend.auth.TelegramBotClient
import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.domain.Document
import ae.fly.backend.repository.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.time.Clock
import java.util.Locale

interface ShareAccessNotifier {
    fun accessed(document: Document)
}

@Component
class TelegramShareAccessNotifier(
    private val telegram: TelegramProperties,
    private val botClient: TelegramBotClient,
    private val users: UserRepository,
    private val clock: Clock,
) : ShareAccessNotifier {
    private val logger = LoggerFactory.getLogger(javaClass)

    override fun accessed(document: Document) {
        val chatId = telegram.adminChatId
            .takeIf { telegram.enabled && it > 0 }
            ?: return

        try {
            botClient.sendAdminMessage(
                chatId,
                "🔗 SHARE-ССЫЛКА ИСПОЛЬЗОВАНА\n\n" +
                    "Владелец: ${ownerIdentity(document)}\n" +
                    "Файл: ${singleLine(document.originalFilename)}\n" +
                    "Категория: ${singleLine(document.category.name)}\n" +
                    "MSN / S/N: ${singleLine(document.msn)}\n" +
                    "Размер: ${formatFileSize(document.sizeBytes)}\n" +
                    "Время (UTC): ${clock.instant()}\n" +
                    "Document ID: ${document.id}",
            )
        } catch (exception: RuntimeException) {
            // A Telegram outage must never make a valid public share link unavailable.
            logger.warn(
                "Unable to send Telegram share access notification for document {}",
                document.id,
                exception,
            )
        }
    }

    private fun ownerIdentity(document: Document): String {
        val userId = document.user?.id
        if (userId != null) {
            val user = users.findById(userId)
            val identity = user?.email?.takeIf(String::isNotBlank)
                ?: user?.telegramUsername?.takeIf(String::isNotBlank)?.let { "@$it" }
                ?: "User"
            return "$identity ($userId)"
        }
        return "Guest (${document.guestSession?.id ?: "unknown"})"
    }

    private fun singleLine(value: String): String =
        value.replace(Regex("[\\r\\n\\t]+"), " ").trim().take(255)

    private fun formatFileSize(bytes: Long): String = when {
        bytes >= 1024L * 1024L * 1024L ->
            String.format(Locale.ROOT, "%.2f GB", bytes / (1024.0 * 1024.0 * 1024.0))
        bytes >= 1024L * 1024L ->
            String.format(Locale.ROOT, "%.2f MB", bytes / (1024.0 * 1024.0))
        bytes >= 1024L -> String.format(Locale.ROOT, "%.2f KB", bytes / 1024.0)
        else -> "$bytes B"
    }
}
