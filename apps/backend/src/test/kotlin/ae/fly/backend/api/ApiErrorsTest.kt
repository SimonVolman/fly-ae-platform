package ae.fly.backend.api

import ae.fly.backend.security.RateLimitExceeded
import jakarta.servlet.http.HttpServletResponse
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock

class ApiErrorsTest {
    @Test
    fun `rate limit response includes retry after seconds`() {
        val response = ApiErrors().rateLimited(
            RateLimitExceeded(2_806),
            mock(HttpServletResponse::class.java),
        )

        assertEquals(429, response.statusCode.value())
        assertEquals("2806", response.headers.getFirst("Retry-After"))
        assertEquals(
            "Too many requests. Try again later.",
            response.body?.detail,
        )
    }
}
