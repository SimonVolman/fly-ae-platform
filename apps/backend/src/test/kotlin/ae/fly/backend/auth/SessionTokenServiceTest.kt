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

class SessionTokenServiceTest {
    private val clock = MutableClock(Instant.parse("2026-07-26T12:00:00Z"))
    private val service = SessionTokenService(
        SecurityProperties(
            sessionSecret = "test-session-secret-that-is-long-enough",
            otpPepper = "test-otp-pepper-that-is-long-enough",
            shareEncryptionSecret = "test-share-secret-that-is-long-enough",
            sessionTtl = Duration.ofHours(2),
        ),
        clock,
    )

    @Test
    fun `issues and verifies a signed session`() {
        val userId = UUID.randomUUID()

        val (token, expiresAt) = service.issue(userId)
        val identity = service.verify(token)

        assertEquals(userId, identity?.userId)
        assertEquals(expiresAt, identity?.expiresAt)
        assertTrue(token.count { it == '.' } == 1)
    }

    @Test
    fun `rejects tampered and expired sessions`() {
        val (token, _) = service.issue(UUID.randomUUID())

        assertNull(service.verify("${token}x"))
        clock.advance(Duration.ofHours(3))
        assertNull(service.verify(token))
    }
}
