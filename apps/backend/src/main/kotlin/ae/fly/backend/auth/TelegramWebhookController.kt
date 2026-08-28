package ae.fly.backend.auth

import ae.fly.backend.security.RateLimiter
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

@RestController
class TelegramWebhookController(
    private val telegramOtpService: TelegramOtpService,
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
        telegramOtpService.verifyWebhookSecret(webhookSecret)
        update.message?.let { message ->
            rateLimiter.check(
                "telegram-otp:chat:${message.chat.id}",
                10,
                Duration.ofMinutes(15),
            )
            telegramOtpService.handle(message)
        }
        return ResponseEntity.ok().build()
    }
}
