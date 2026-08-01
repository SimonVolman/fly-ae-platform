package ae.fly.backend.auth

import jakarta.validation.constraints.AssertTrue
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant

data class CreateGuestSessionRequest(
    @field:AssertTrue(message = "Terms and Privacy must be accepted")
    val acceptedLegal: Boolean,

    @field:NotBlank
    @field:Size(max = 32)
    val termsVersion: String,

    @field:NotBlank
    @field:Size(max = 32)
    val privacyVersion: String,
)

data class GuestSessionResponse(
    val accessToken: String,
    val expiresAt: Instant,
    val maxFileSizeBytes: Long,
)
