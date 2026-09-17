package ae.fly.backend.auth

import ae.fly.backend.security.RateLimiter
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CookieValue
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Clock
import java.time.Duration

@RestController
@RequestMapping("/api/v1/auth/session")
class SessionController(
    private val sessions: PersistentSessionService,
    private val cookie: RefreshSessionCookie,
    private val requestGuard: CookieRequestGuard,
    private val rateLimiter: RateLimiter,
    private val clock: Clock,
) {
    @PostMapping("/refresh")
    fun refresh(
        @CookieValue(name = RefreshSessionCookie.COOKIE_NAME, required = false) refreshToken: String?,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ResponseEntity<SessionResponse> {
        requestGuard.requireTrustedOrigin(request)
        rateLimiter.check("session-refresh:ip:${request.remoteAddr}", 60, Duration.ofMinutes(1))
        val refreshed = sessions.refresh(refreshToken)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()
        refreshed.replacementRefreshToken?.let { replacement ->
            cookie.set(response, replacement, requireNotNull(refreshed.refreshExpiresAt), clock.instant())
        }
        return ResponseEntity.ok(refreshed.response)
    }

    @PostMapping("/logout")
    fun logout(
        @CookieValue(name = RefreshSessionCookie.COOKIE_NAME, required = false) refreshToken: String?,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ResponseEntity<Void> {
        requestGuard.requireTrustedOrigin(request)
        rateLimiter.check("session-logout:ip:${request.remoteAddr}", 30, Duration.ofMinutes(1))
        sessions.logout(refreshToken)
        cookie.clear(response)
        return ResponseEntity.noContent().build()
    }
}
