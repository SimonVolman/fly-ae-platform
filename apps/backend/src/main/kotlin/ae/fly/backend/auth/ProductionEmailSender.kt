package ae.fly.backend.auth

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import java.time.Instant

@Component
@Profile("!local & !test")
class ProductionEmailSender : EmailSender {
    override fun sendOtp(email: String, code: String, expiresAt: Instant) {
        throw IllegalStateException(
            "A production EmailSender adapter must be configured before OTP delivery is enabled",
        )
    }
}
