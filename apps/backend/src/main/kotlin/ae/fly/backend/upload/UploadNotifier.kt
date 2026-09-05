package ae.fly.backend.upload

import ae.fly.backend.auth.AuthenticatedGuest
import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.auth.FlyPrincipal
import ae.fly.backend.auth.TelegramBotClient
import ae.fly.backend.auth.TelegramUploadNotification
import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.domain.Document
import ae.fly.backend.repository.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

interface UploadNotifier {
    fun completed(owner: FlyPrincipal, document: Document)
}

@Component
class TelegramUploadNotifier(
    private val telegram: TelegramProperties,
    private val botClient: TelegramBotClient,
    private val users: UserRepository,
) : UploadNotifier {
    private val logger = LoggerFactory.getLogger(javaClass)

    override fun completed(owner: FlyPrincipal, document: Document) {
        val chatId = telegram.adminChatId
            .takeIf { telegram.enabled && it > 0 }
            ?: return

        try {
            botClient.sendUploadNotification(
                chatId,
                TelegramUploadNotification(
                    uploader = uploader(owner),
                    filename = document.originalFilename,
                    sizeBytes = document.sizeBytes,
                    documentId = document.id,
                    uploadedAt = document.updatedAt,
                ),
            )
        } catch (exception: RuntimeException) {
            // The file is already safely stored; an unavailable bot must not fail the upload.
            logger.warn(
                "Unable to send Telegram upload notification for document {}",
                document.id,
                exception,
            )
        }
    }

    private fun uploader(owner: FlyPrincipal): String = when (owner) {
        is AuthenticatedUser -> {
            val user = users.findById(owner.id)
            val identity = user?.email?.takeIf(String::isNotBlank)
                ?: user?.telegramUsername?.takeIf(String::isNotBlank)?.let { "@$it" }
                ?: "User"
            "$identity (${owner.id})"
        }
        is AuthenticatedGuest -> "Guest (${owner.id})"
    }
}
