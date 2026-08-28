package ae.fly.backend.auth

import ae.fly.backend.config.TelegramProperties
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.time.Duration

interface TelegramBotClient {
    fun sendOtp(chatId: Long, code: String, ttl: Duration)
    fun sendInvalidLink(chatId: Long)
    fun sendInstructions(chatId: Long)
}

@Component
class HttpTelegramBotClient(
    restClientBuilder: RestClient.Builder,
    private val properties: TelegramProperties,
) : TelegramBotClient {
    private val restClient = restClientBuilder.build()

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
}

class TelegramDeliveryException : RuntimeException("Telegram delivery failed")
