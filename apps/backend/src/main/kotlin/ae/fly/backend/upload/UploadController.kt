package ae.fly.backend.upload

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.auth.FlyPrincipal
import ae.fly.backend.document.DocumentResponse
import ae.fly.backend.security.FixedWindowRateLimiter
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.util.UUID

@RestController
@RequestMapping("/api/v1/documents/{documentId}/multipart")
class UploadController(
    private val uploads: UploadService,
    private val rateLimiter: FixedWindowRateLimiter,
) {
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun start(
        authentication: Authentication,
        @PathVariable documentId: UUID,
    ): MultipartSessionResponse {
        val principal = authentication.flyPrincipal()
        rateLimiter.check("upload-start:${principal.id}", 30, Duration.ofHours(1))
        return uploads.start(principal, documentId)
    }

    @GetMapping("/{uploadId}/parts/{partNumber}")
    fun signPart(
        authentication: Authentication,
        @PathVariable documentId: UUID,
        @PathVariable uploadId: String,
        @PathVariable partNumber: Int,
    ): SignedPartResponse {
        if (partNumber !in 1..10_000) {
            throw ApiProblem(
                HttpStatus.BAD_REQUEST,
                "partNumber must be between 1 and 10000.",
            )
        }
        val principal = authentication.flyPrincipal()
        rateLimiter.check("upload-sign:${principal.id}", 2_000, Duration.ofHours(1))
        return uploads.signPart(principal, documentId, uploadId, partNumber)
    }

    @PostMapping("/{uploadId}/complete")
    fun complete(
        authentication: Authentication,
        @PathVariable documentId: UUID,
        @PathVariable uploadId: String,
        @Valid @RequestBody request: CompleteMultipartRequest,
    ): DocumentResponse =
        uploads.complete(authentication.flyPrincipal(), documentId, uploadId, request)

    @DeleteMapping("/{uploadId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun abort(
        authentication: Authentication,
        @PathVariable documentId: UUID,
        @PathVariable uploadId: String,
    ) {
        uploads.abort(authentication.flyPrincipal(), documentId, uploadId)
    }

    private fun Authentication.flyPrincipal(): FlyPrincipal = principal as FlyPrincipal
}
