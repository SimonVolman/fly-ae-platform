package ae.fly.backend.auth

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.config.WebProperties
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import java.time.Instant

class CookieSessionSecurityTest {
    private val properties = WebProperties(
        allowedOrigins = listOf("https://fly.ae"),
        publicBaseUrl = "https://fly.ae",
    )

    @Test
    fun `refresh endpoints require the exact configured origin`() {
        val guard = CookieRequestGuard(properties)
        guard.requireTrustedOrigin(MockHttpServletRequest().apply { addHeader("Origin", "https://fly.ae") })

        val error = assertThrows(ApiProblem::class.java) {
            guard.requireTrustedOrigin(
                MockHttpServletRequest().apply { addHeader("Origin", "https://attacker.example") },
            )
        }
        assertEquals(403, error.status.value())
    }

    @Test
    fun `refresh cookie is host-only HttpOnly secure and scoped to auth`() {
        val response = MockHttpServletResponse()
        RefreshSessionCookie(properties).set(
            response,
            "x".repeat(64),
            Instant.parse("2026-10-17T12:00:00Z"),
            Instant.parse("2026-09-17T12:00:00Z"),
        )

        val header = requireNotNull(response.getHeader("Set-Cookie"))
        assertTrue(header.contains("HttpOnly"))
        assertTrue(header.contains("Secure"))
        assertTrue(header.contains("SameSite=Lax"))
        assertTrue(header.contains("Path=/api/v1/auth"))
        assertTrue(!header.contains("Domain="))
    }
}
