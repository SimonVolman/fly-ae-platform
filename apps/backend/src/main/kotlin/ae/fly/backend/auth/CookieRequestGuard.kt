package ae.fly.backend.auth

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.config.WebProperties
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component

/** Cookie-authenticated endpoints require an exact, configured browser origin. */
@Component
class CookieRequestGuard(
    private val webProperties: WebProperties,
) {
    fun requireTrustedOrigin(request: HttpServletRequest) {
        val origin = request.getHeader("Origin")?.trim()?.trimEnd('/')
        val allowed = webProperties.allowedOrigins.map { it.trim().trimEnd('/') }.toSet()
        if (origin == null || origin !in allowed) {
            throw ApiProblem(HttpStatus.FORBIDDEN, "This request must originate from fly.ae.")
        }
    }
}
