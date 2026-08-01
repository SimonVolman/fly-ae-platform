package ae.fly.backend.security

import ae.fly.backend.support.MutableClock
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant

class FixedWindowRateLimiterTest {
    private val clock = MutableClock(Instant.parse("2026-07-26T12:00:00Z"))
    private val limiter = FixedWindowRateLimiter(clock)

    @Test
    fun `blocks after the configured limit and resets after the window`() {
        limiter.check("otp:test@example.com", 2, Duration.ofMinutes(10))
        limiter.check("otp:test@example.com", 2, Duration.ofMinutes(10))

        assertThrows(RateLimitExceeded::class.java) {
            limiter.check("otp:test@example.com", 2, Duration.ofMinutes(10))
        }

        clock.advance(Duration.ofMinutes(11))
        assertDoesNotThrow {
            limiter.check("otp:test@example.com", 2, Duration.ofMinutes(10))
        }
    }
}
