package ae.fly.backend.auth

import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import java.time.Instant

@Component
@Profile("local", "test")
class DevelopmentEmailSender : EmailSender {
    private val logger = LoggerFactory.getLogger(javaClass)

    override fun sendOtp(email: String, code: String, expiresAt: Instant) {
        logger.info("Development OTP for {}: {} (expires {})", email, code, expiresAt)
    }
}
