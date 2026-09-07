package ae.fly.backend.auth

import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.config.WebProperties
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.time.Instant
import java.util.Locale
import java.util.UUID

interface TelegramBotClient {
    fun sendInstructions(chatId: Long)
    fun sendUploadNotification(chatId: Long, notification: TelegramUploadNotification)
    fun sendAdminMessage(chatId: Long, text: String, buttons: List<TelegramUrlButton> = emptyList())
}

data class TelegramUploadNotification(
    val uploader: String,
    val filename: String,
    val sizeBytes: Long,
    val documentId: UUID,
    val uploadedAt: Instant,
    val ipAddress: String? = null,
)

data class TelegramUrlButton(
    val text: String,
    val url: String,
)

@Component
class HttpTelegramBotClient(
    private val properties: TelegramProperties,
    private val webProperties: WebProperties,
) : TelegramBotClient {
    private val restClient = RestClient.builder().build()

    override fun sendInstructions(chatId: Long) {
        sendMessage(
            chatId,
            "✈️ fly.ae\n\n" +
                "Sign in with your email at ${webProperties.publicBaseUrl}.\n\n" +
                "This bot provides notifications. Telegram sign-in is no longer available.",
        )
    }

    override fun sendUploadNotification(chatId: Long, notification: TelegramUploadNotification) {
        sendMessage(
            chatId,
            withEnvironmentHeader(
                "📄 Новый файл загружен на fly.ae\n\n" +
                    "Пользователь: ${singleLine(notification.uploader)}\n" +
                    "IP: ${notification.ipAddress ?: "не определён"}\n" +
                    "Файл: ${singleLine(notification.filename)}\n" +
                    "Размер: ${formatFileSize(notification.sizeBytes)}\n" +
                    "Время (UTC): ${notification.uploadedAt}\n" +
                    "Document ID: ${notification.documentId}",
                properties.environment,
            ),
        )
    }

    override fun sendAdminMessage(chatId: Long, text: String, buttons: List<TelegramUrlButton>) {
        sendMessage(
            chatId,
            withEnvironmentHeader(text, properties.environment),
            protectContent = true,
            buttons = buttons,
        )
    }

    private fun sendMessage(
        chatId: Long,
        text: String,
        protectContent: Boolean = false,
        buttons: List<TelegramUrlButton> = emptyList(),
    ) {
        if (!properties.enabled) throw TelegramDeliveryException()
        val uri = "${properties.apiBaseUrl.trimEnd('/')}/bot${properties.botToken}/sendMessage"
        try {
            restClient.post()
                .uri(uri)
                .contentType(MediaType.APPLICATION_JSON)
                .body(buildMap<String, Any> {
                    put("chat_id", chatId)
                    put("text", withMaintenanceBanner(text, webProperties.maintenanceMode))
                    put("protect_content", protectContent)
                    put("link_preview_options", mapOf("is_disabled" to true))
                    if (buttons.isNotEmpty()) {
                        put(
                            "reply_markup",
                            mapOf(
                                "inline_keyboard" to buttons.map { button ->
                                    listOf(
                                        mapOf(
                                            "text" to singleLine(button.text).take(64),
                                            "url" to button.url,
                                        ),
                                    )
                                },
                            ),
                        )
                    }
                })
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

internal fun withMaintenanceBanner(text: String, maintenanceMode: Boolean): String {
    if (!maintenanceMode) return text
    return "🚧🚧🚧 FLY.AE MAINTENANCE 🚧🚧🚧\n" +
        "⚠️ САЙТ ВРЕМЕННО НЕДОСТУПЕН / THE WEBSITE IS TEMPORARILY UNAVAILABLE ⚠️\n\n" +
        text
}

internal fun withEnvironmentHeader(text: String, environment: String): String {
    val label = environment.trim().uppercase(Locale.ROOT).ifBlank { "LOCAL" }.take(24)
    return "[$label]\n$text"
}

class TelegramDeliveryException : RuntimeException("Telegram delivery failed")
