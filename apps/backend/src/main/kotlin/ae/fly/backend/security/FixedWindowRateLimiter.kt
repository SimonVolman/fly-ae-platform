package ae.fly.backend.security

import org.springframework.stereotype.Service
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

class RateLimitExceeded(
    val retryAfterSeconds: Long,
) : RuntimeException("Rate limit exceeded")

@Service
class FixedWindowRateLimiter(
    private val clock: Clock,
) {
    private data class Window(
        val startedAt: Instant,
        val count: Int,
    )

    private val windows = ConcurrentHashMap<String, Window>()

    fun check(key: String, limit: Int, duration: Duration) {
        val now = clock.instant()
        var allowed = true
        var retryAfter = duration.seconds

        windows.compute(key) { _, current ->
            if (current == null || !current.startedAt.plus(duration).isAfter(now)) {
                Window(now, 1)
            } else {
                retryAfter = Duration.between(now, current.startedAt.plus(duration))
                    .seconds
                    .coerceAtLeast(1)
                if (current.count >= limit) {
                    allowed = false
                    current
                } else {
                    current.copy(count = current.count + 1)
                }
            }
        }

        if (!allowed) throw RateLimitExceeded(retryAfter)
    }
}
