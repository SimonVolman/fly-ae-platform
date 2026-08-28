package ae.fly.backend.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties("fly.security")
data class SecurityProperties(
    val sessionSecret: String,
    val otpPepper: String,
    val shareEncryptionSecret: String,
    val sessionTtl: Duration = Duration.ofHours(12),
    val guestSessionTtl: Duration = Duration.ofHours(12),
    val otpTtl: Duration = Duration.ofMinutes(10),
    val otpMaxAttempts: Int = 5,
)

@ConfigurationProperties("fly.documents")
data class DocumentProperties(
    val authenticatedMaxFileSizeBytes: Long = 104_857_600,
    val guestMaxFileSizeBytes: Long = 10_485_760,
)

@ConfigurationProperties("fly.web")
data class WebProperties(
    val allowedOrigins: List<String> = listOf("http://localhost:3000"),
    val publicBaseUrl: String = "http://localhost:3000",
)

@ConfigurationProperties("fly.email")
data class EmailProperties(
    val from: String = "no-reply@fly.ae",
    val region: String = "eu-central-1",
)

@ConfigurationProperties("fly.telegram")
data class TelegramProperties(
    val enabled: Boolean = false,
    val botToken: String = "",
    val botUsername: String = "",
    val webhookSecret: String = "",
    val apiBaseUrl: String = "https://api.telegram.org",
) {
    init {
        if (enabled) {
            require(botToken.isNotBlank()) { "fly.telegram.bot-token is required when Telegram is enabled" }
            require(botUsername.matches(Regex("^[A-Za-z0-9_]{5,32}$"))) {
                "fly.telegram.bot-username must be a valid Telegram username without @"
            }
            require(webhookSecret.matches(Regex("^[A-Za-z0-9_-]{16,256}$"))) {
                "fly.telegram.webhook-secret must be 16-256 URL-safe characters"
            }
            require(apiBaseUrl.startsWith("https://")) {
                "fly.telegram.api-base-url must use HTTPS"
            }
        }
    }
}
