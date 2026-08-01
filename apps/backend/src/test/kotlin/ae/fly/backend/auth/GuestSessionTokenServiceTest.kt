package ae.fly.backend.auth

import ae.fly.backend.config.SecurityProperties
import ae.fly.backend.support.MutableClock
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.util.UUID

class GuestSessionTokenServiceTest {
    private val clock = MutableClock(Instant.parse("2026-08-01T12:00:00Z"))
    private val service = GuestSessionTokenService(
        SecurityProperties(
            sessionSecret = "test-session-secret-that-is-long-enough",
            otpPepper = "test-otp-pepper-that-is-long-enough",
            shareEncryptionSecret = "test-share-secret-that-is-long-enough",
            guestSessionTtl = Duration.ofHours(2),
        ),
        clock,
    )

    @Test
    fun `issues a scoped guest token`() {
        val guestId = UUID.randomUUID()

        val (token, expiresAt) = service.issue(guestId)
        val identity = service.verify(token)

        assertTrue(token.startsWith("gst_"))
        assertEquals(guestId, identity?.guestSessionId)
        assertEquals(expiresAt, identity?.expiresAt)
    }

    @Test
    fun `rejects user-shaped tampered and expired guest tokens`() {
        val (token, _) = service.issue(UUID.randomUUID())

        assertNull(service.verify(token.removePrefix("gst_")))
        assertNull(service.verify("${token}x"))
        clock.advance(Duration.ofHours(3))
        assertNull(service.verify(token))
    }
}
