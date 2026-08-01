package ae.fly.backend.api

import ae.fly.backend.security.RateLimitExceeded
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.ConstraintViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

class ApiProblem(
    val status: HttpStatus,
    override val message: String,
) : RuntimeException(message)

@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(ApiProblem::class)
    fun apiProblem(error: ApiProblem): ProblemDetail =
        ProblemDetail.forStatusAndDetail(error.status, error.message).apply {
            title = error.status.reasonPhrase
        }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun invalidBody(error: MethodArgumentNotValidException): ProblemDetail {
        val detail = error.bindingResult.fieldErrors
            .joinToString("; ") { "${it.field}: ${it.defaultMessage}" }
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail).apply {
            title = "Invalid request"
        }
    }

    @ExceptionHandler(ConstraintViolationException::class)
    fun constraintViolation(error: ConstraintViolationException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, error.message).apply {
            title = "Invalid request"
        }

    @ExceptionHandler(RateLimitExceeded::class)
    fun rateLimited(
        error: RateLimitExceeded,
        response: HttpServletResponse,
    ): ResponseEntity<ProblemDetail> {
        val body = ProblemDetail.forStatusAndDetail(
            HttpStatus.TOO_MANY_REQUESTS,
            "Too many requests. Try again later.",
        ).apply { title = "Rate limit exceeded" }
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .header("Retry-After", error.retryAfterSeconds.toString())
            .body(body)
    }
}
