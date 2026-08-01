package ae.fly.backend.auth

import ae.fly.backend.repository.UserRepository
import ae.fly.backend.repository.GuestSessionRepository
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.time.Clock

@Component
class BearerSessionFilter(
    private val tokenService: SessionTokenService,
    private val guestTokenService: GuestSessionTokenService,
    private val users: UserRepository,
    private val guestSessions: GuestSessionRepository,
    private val clock: Clock,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val rawHeader = request.getHeader("Authorization")
        val token = rawHeader
            ?.takeIf { it.startsWith("Bearer ", ignoreCase = true) }
            ?.substringAfter(' ')
            ?.trim()
            ?.takeIf(String::isNotEmpty)

        if (token != null) {
            val principal = if (token.startsWith("gst_")) {
                guestTokenService.verify(token)
                    ?.takeIf {
                        guestSessions.existsByIdAndExpiresAtAfter(
                            it.guestSessionId,
                            clock.instant(),
                        )
                    }
                    ?.let { AuthenticatedGuest(it.guestSessionId) }
            } else {
                tokenService.verify(token)
                    ?.takeIf { users.existsById(it.userId) }
                    ?.let { AuthenticatedUser(it.userId) }
            }
            if (principal != null) {
                SecurityContextHolder.getContext().authentication =
                    UsernamePasswordAuthenticationToken(principal, token, emptyList())
            }
        }

        filterChain.doFilter(request, response)
    }
}
