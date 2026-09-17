package ae.fly.backend.auth

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class AuthResponseHeadersFilter : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (request.requestURI.startsWith("/api/v1/auth/")) {
            response.setHeader("Cache-Control", "no-store")
            response.setHeader("Pragma", "no-cache")
        }
        filterChain.doFilter(request, response)
    }
}
