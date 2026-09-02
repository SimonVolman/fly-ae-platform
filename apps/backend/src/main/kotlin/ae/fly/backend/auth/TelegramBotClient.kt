package ae.fly.backend.auth

import ae.fly.backend.config.TelegramProperties
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.time.Duration
import java.time.Instant
import java.util.Locale
import java.util.UUID

interface TelegramBotClient {
    fun sendOtp(chatId: Long, code: String, ttl: Duration)
    fun sendInvalidLink(chatId: Long)
    fun sendInstructions(chatId: Long)
    fun sendUploadNotification(chatId: Long, notification: TelegramUploadNotification)
}

data class TelegramUploadNotification(
    val uploader: String,
    val filename: String,
    val sizeBytes: Long,
    val documentId: UUID,
    val uploadedAt: Instant,
)

@Component
class HttpTelegramBotClient(
    private val properties: TelegramProperties,
) : TelegramBotClient {
    private val restClient = RestClient.builder().build()

    override fun sendOtp(chatId: Long, code: String, ttl: Duration) {
        val minutes = ttl.toMinutes().coerceAtLeast(1)
        sendMessage(
            chatId,
            "Your fly.ae one-time code: $code\n\n" +
                "It expires in $minutes minutes. Do not share this code.",
            protectContent = true,
        )
    }

    override fun sendInvalidLink(chatId: Long) {
        sendMessage(
            chatId,
            "This fly.ae sign-in URL is invalid or has expired. Return to fly.ae and start Telegram sign-in again.",
        )
    }

    override fun sendInstructions(chatId: Long) {
        sendMessage(
            chatId,
            "Start Telegram sign-in on fly.ae, then open the Telegram button shown there.",
        )
    }

    override fun sendUploadNotification(chatId: Long, notification: TelegramUploadNotification) {
        sendMessage(
            chatId,
            "📄 Новый файл загружен на fly.ae\n\n" +
                "Пользователь: ${singleLine(notification.uploader)}\n" +
                "Файл: ${singleLine(notification.filename)}\n" +
                "Размер: ${formatFileSize(notification.sizeBytes)}\n" +
                "Время (UTC): ${notification.uploadedAt}\n" +
                "Document ID: ${notification.documentId}",
        )
    }

    private fun sendMessage(chatId: Long, text: String, protectContent: Boolean = false) {
        if (!properties.enabled) throw TelegramDeliveryException()
        val uri = "${properties.apiBaseUrl.trimEnd('/')}/bot${properties.botToken}/sendMessage"
        try {
            restClient.post()
                .uri(uri)
                .contentType(MediaType.APPLICATION_JSON)
                .body(
                    mapOf(
                        "chat_id" to chatId,
                        "text" to text,
                        "protect_content" to protectContent,
                    ),
                )
                .retrieve()
                .toBodilessEntity()
        } catch (_: RestClientException) {
            // Do not include the request URI in the exception: Telegram embeds the bot token in it.
            throw TelegramDeliveryException()
        }
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

class TelegramDeliveryException : RuntimeException("Telegram delivery failed")
