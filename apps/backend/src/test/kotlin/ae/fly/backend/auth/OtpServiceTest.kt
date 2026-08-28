package ae.fly.backend.auth

import ae.fly.backend.config.SecurityProperties
import ae.fly.backend.domain.OtpCode
import ae.fly.backend.domain.User
import ae.fly.backend.repository.OtpCodeRepository
import ae.fly.backend.repository.TermsAcceptanceRepository
import ae.fly.backend.repository.UserRepository
import ae.fly.backend.support.MutableClock
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.mockingDetails
import org.mockito.Mockito.`when`
import java.time.Duration
import java.time.Instant
import java.util.UUID

class OtpServiceTest {
    private val otpCodes = mock(OtpCodeRepository::class.java)
    private val users = mock(UserRepository::class.java)
    private val terms = mock(TermsAcceptanceRepository::class.java)
    private val emailSender = CapturingEmailSender()
    private val clock = MutableClock(Instant.parse("2026-07-26T12:00:00Z"))
    private val properties = SecurityProperties(
        sessionSecret = "test-session-secret-that-is-long-enough",
        otpPepper = "test-otp-pepper-that-is-long-enough",
        shareEncryptionSecret = "test-share-secret-that-is-long-enough",
        sessionTtl = Duration.ofHours(12),
        otpTtl = Duration.ofMinutes(10),
        otpMaxAttempts = 5,
    )
    private val sessionTokens = SessionTokenService(properties, clock)
    private val service = OtpService(
        otpCodes,
        users,
        terms,
        emailSender,
        sessionTokens,
        properties,
        clock,
    )

    @Test
    fun `requests and consumes a one-time code`() {
        var savedOtp: OtpCode? = null
        val user = User(id = UUID.randomUUID(), email = "pilot@fly.ae")

        `when`(otpCodes.findAllByEmailAndConsumedAtIsNull("pilot@fly.ae"))
            .thenReturn(emptyList())
        `when`(otpCodes.save(any(OtpCode::class.java) ?: OtpCode())).thenAnswer {
            (it.arguments[0] as OtpCode).also { value -> savedOtp = value }
        }
        `when`(otpCodes.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc("pilot@fly.ae"))
            .thenAnswer { savedOtp }
        `when`(users.findByEmail("pilot@fly.ae")).thenReturn(user)
        `when`(
            terms.existsByUserIdAndDocumentTypeAndVersion(
                user.id,
                "TERMS",
                "customer-v1",
            ),
        ).thenReturn(false)
        `when`(
            terms.existsByUserIdAndDocumentTypeAndVersion(
                user.id,
                "PRIVACY",
                "customer-v1",
            ),
        ).thenReturn(false)

        service.requestEmail(" PILOT@fly.ae ")
        val response = service.verify(
            OtpVerification(
                email = "pilot@fly.ae",
                code = emailSender.code,
                acceptedLegal = true,
                termsVersion = "customer-v1",
                privacyVersion = "customer-v1",
            ),
        )

        assertEquals(user.id, response.user.id)
        assertEquals("pilot@fly.ae", response.user.email)
        assertNotNull(savedOtp?.consumedAt)
        assertTrue(sessionTokens.verify(response.accessToken) != null)
        assertEquals(
            2,
            mockingDetails(terms).invocations.count { it.method.name == "save" },
        )
    }

    private class CapturingEmailSender : EmailSender {
        lateinit var code: String

        override fun sendOtp(email: String, code: String, expiresAt: Instant) {
            this.code = code
            assertEquals("pilot@fly.ae", email)
            assertEquals(6, code.length)
        }
    }
}
