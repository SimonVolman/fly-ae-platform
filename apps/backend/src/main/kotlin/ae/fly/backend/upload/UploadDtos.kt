package ae.fly.backend.upload

import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant

data class MultipartSessionResponse(
    val uploadId: String,
    val key: String,
    val expiresAt: Instant,
)

data class SignedPartResponse(
    val url: String,
    val headers: Map<String, String> = emptyMap(),
)

data class CompletedPartRequest(
    @field:Min(1)
    @field:Max(10_000)
    val partNumber: Int,

    @field:NotBlank
    @field:Size(max = 512)
    val etag: String,
)

data class CompleteMultipartRequest(
    @field:Size(min = 1, max = 10_000)
    val parts: List<@Valid CompletedPartRequest>,
)
