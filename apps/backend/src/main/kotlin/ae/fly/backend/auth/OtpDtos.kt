package ae.fly.backend.auth

import jakarta.validation.constraints.AssertTrue
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

data class OtpRequest(
    @field:Email
    @field:NotBlank
    @field:Size(max = 254)
    val email: String,
)

data class OtpVerification(
    @field:Email
    @field:NotBlank
    @field:Size(max = 254)
    val email: String,

    @field:Pattern(regexp = "^[0-9]{6}$")
    val code: String,

    @field:AssertTrue(message = "Terms and Privacy must be accepted")
    val acceptedLegal: Boolean,

    @field:NotBlank
    @field:Size(max = 32)
    val termsVersion: String,

    @field:NotBlank
    @field:Size(max = 32)
    val privacyVersion: String,
)

data class SessionUser(
    val id: UUID,
    val email: String,
)

data class SessionResponse(
    val accessToken: String,
    val expiresAt: Instant,
    val user: SessionUser,
)
