package ae.fly.backend.auth

import ae.fly.backend.security.RateLimiter
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.time.Clock

@RestController
@RequestMapping("/api/v1/auth/otp")
class OtpController(
    private val otpService: OtpService,
    private val rateLimiter: RateLimiter,
    private val refreshCookie: RefreshSessionCookie,
    private val clock: Clock,
) {
    @GetMapping("/options")
    fun deliveryOptions(): OtpDeliveryOptions = OtpDeliveryOptions(
        telegramEnabled = false,
    )

    @PostMapping("/request")
    fun requestOtp(
        @Valid @RequestBody request: OtpRequest,
        servletRequest: HttpServletRequest,
    ): ResponseEntity<Void> {
        val email = request.email.trim().lowercase()
        rateLimiter.check("otp-request:ip:${servletRequest.remoteAddr}", 20, Duration.ofHours(1))
        rateLimiter.check("otp-request:email:$email", 5, Duration.ofHours(1))
        otpService.requestEmail(email)
        return ResponseEntity.accepted().build()
    }

    @PostMapping("/verify")
    fun verifyOtp(
        @Valid @RequestBody request: OtpVerification,
        servletRequest: HttpServletRequest,
        servletResponse: jakarta.servlet.http.HttpServletResponse,
    ): ResponseEntity<SessionResponse> {
        rateLimiter.check("otp-verify:ip:${servletRequest.remoteAddr}", 30, Duration.ofMinutes(15))
        rateLimiter.check(
            "otp-verify:email:${request.email.trim().lowercase()}",
            10,
            Duration.ofMinutes(15),
        )
        val login = otpService.verify(request)
        refreshCookie.set(servletResponse, login.refreshToken, login.refreshExpiresAt, clock.instant())
        return ResponseEntity.ok(login.response)
    }
}
