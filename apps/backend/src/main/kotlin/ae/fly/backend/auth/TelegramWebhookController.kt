package ae.fly.backend.auth

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.security.RateLimiter
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.security.MessageDigest

@RestController
class TelegramWebhookController(
    private val telegram: TelegramProperties,
    private val botClient: TelegramBotClient,
    private val telegramAdminCommands: TelegramAdminCommandService,
    private val rateLimiter: RateLimiter,
) {
    @PostMapping("/api/v1/auth/telegram/webhook")
    fun receiveUpdate(
        @RequestHeader(
            name = "X-Telegram-Bot-Api-Secret-Token",
            required = false,
        ) webhookSecret: String?,
        @RequestBody update: TelegramUpdate,
    ): ResponseEntity<Void> {
        if (!telegram.enabled) {
            throw ApiProblem(HttpStatus.NOT_FOUND, "Telegram bot is not configured.")
        }
        if (!MessageDigest.isEqual(
                telegram.webhookSecret.toByteArray(Charsets.UTF_8),
                webhookSecret?.toByteArray(Charsets.UTF_8) ?: byteArrayOf(),
            )
        ) {
            throw ApiProblem(HttpStatus.UNAUTHORIZED, "The Telegram webhook secret is invalid.")
        }
        update.message?.let { message ->
            rateLimiter.check(
                "telegram-webhook:chat:${message.chat.id}",
                10,
                Duration.ofMinutes(15),
            )
            if (
                !telegramAdminCommands.handle(message) &&
                message.chat.type == "private" &&
                START_COMMAND.matches(message.text?.trim().orEmpty())
            ) {
                botClient.sendInstructions(message.chat.id)
            }
        }
        return ResponseEntity.ok().build()
    }

    companion object {
        private val START_COMMAND = Regex("^/start(?:@[A-Za-z0-9_]{5,32})?(?:\\s+.*)?$")
    }
}
