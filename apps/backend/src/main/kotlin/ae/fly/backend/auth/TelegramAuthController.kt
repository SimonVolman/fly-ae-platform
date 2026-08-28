package ae.fly.backend.auth

import ae.fly.backend.security.RateLimiter
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

@RestController
@RequestMapping("/api/v1/auth/telegram")
class TelegramAuthController(
    private val telegramOtpService: TelegramOtpService,
    private val rateLimiter: RateLimiter,
) {
    @PostMapping("/request")
    fun requestLogin(servletRequest: HttpServletRequest): TelegramLoginAccepted {
        rateLimiter.check(
            "telegram-login-request:ip:${servletRequest.remoteAddr}",
            20,
            Duration.ofHours(1),
        )
        return telegramOtpService.requestLogin()
    }

    @PostMapping("/verify")
    fun verify(
        @Valid @RequestBody request: TelegramOtpVerification,
        servletRequest: HttpServletRequest,
    ): SessionResponse {
        rateLimiter.check(
            "telegram-login-verify:ip:${servletRequest.remoteAddr}",
            30,
            Duration.ofMinutes(15),
        )
        rateLimiter.check(
            "telegram-login-verify:request:${request.requestId}",
            10,
            Duration.ofMinutes(15),
        )
        return telegramOtpService.verify(request)
    }
}
