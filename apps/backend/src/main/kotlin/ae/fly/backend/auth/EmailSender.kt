package ae.fly.backend.auth

import java.time.Instant

interface EmailSender {
    fun sendOtp(email: String, code: String, expiresAt: Instant)
}
