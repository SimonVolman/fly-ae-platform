package ae.fly.backend.auth

import ae.fly.backend.security.FixedWindowRateLimiter
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

@RestController
@RequestMapping("/api/v1/guest/sessions")
class GuestSessionController(
    private val guestSessionService: GuestSessionService,
    private val rateLimiter: FixedWindowRateLimiter,
) {
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @Valid @RequestBody request: CreateGuestSessionRequest,
        servletRequest: HttpServletRequest,
    ): GuestSessionResponse {
        rateLimiter.check(
            "guest-session:ip:${servletRequest.remoteAddr}",
            20,
            Duration.ofHours(1),
        )
        return guestSessionService.create(request)
    }
}
