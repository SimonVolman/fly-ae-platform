package ae.fly.backend.auth

import ae.fly.backend.config.WebProperties
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.Instant

@Component
class RefreshSessionCookie(
    private val webProperties: WebProperties,
) {
    fun set(response: HttpServletResponse, token: String, expiresAt: Instant, now: Instant) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(token, Duration.between(now, expiresAt)).toString())
    }

    fun clear(response: HttpServletResponse) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString())
    }

    private fun cookie(value: String, maxAge: Duration): ResponseCookie =
        ResponseCookie.from(COOKIE_NAME, value)
            .httpOnly(true)
            .secure(webProperties.publicBaseUrl.startsWith("https://"))
            .sameSite("Lax")
            .path(COOKIE_PATH)
            .maxAge(maxAge.coerceAtLeast(Duration.ZERO))
            .build()

    companion object {
        const val COOKIE_NAME = "flyae_refresh"
        const val COOKIE_PATH = "/api/v1/auth"
    }
}
