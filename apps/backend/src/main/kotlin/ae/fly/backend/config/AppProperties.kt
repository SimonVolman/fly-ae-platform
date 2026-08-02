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
