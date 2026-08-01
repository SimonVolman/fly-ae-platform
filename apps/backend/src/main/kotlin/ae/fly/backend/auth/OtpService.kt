package ae.fly.backend.auth

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.config.SecurityProperties
import ae.fly.backend.domain.OtpCode
import ae.fly.backend.domain.TermsAcceptance
import ae.fly.backend.domain.User
import ae.fly.backend.repository.OtpCodeRepository
import ae.fly.backend.repository.TermsAcceptanceRepository
import ae.fly.backend.repository.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.time.Clock

@Service
class OtpService(
    private val otpCodes: OtpCodeRepository,
    private val users: UserRepository,
    private val termsAcceptances: TermsAcceptanceRepository,
    private val emailSender: EmailSender,
    private val sessionTokens: SessionTokenService,
    private val properties: SecurityProperties,
    private val clock: Clock,
) {
    private val random = SecureRandom()
    private val hash = SecureHash(properties.otpPepper)

    @Transactional
    fun request(rawEmail: String) {
        val email = normalizeEmail(rawEmail)
        val now = clock.instant()
        otpCodes.findAllByEmailAndConsumedAtIsNull(email).forEach {
            it.consumedAt = now
        }

        val code = random.nextInt(1_000_000).toString().padStart(6, '0')
        val expiresAt = now.plus(properties.otpTtl)
        otpCodes.save(
            OtpCode(
                email = email,
                codeHash = hash.hex("$email:$code"),
                expiresAt = expiresAt,
                createdAt = now,
            ),
        )
        emailSender.sendOtp(email, code, expiresAt)
    }

    @Transactional
    fun verify(request: OtpVerification): SessionResponse {
        val email = normalizeEmail(request.email)
        val now = clock.instant()
        val otp = otpCodes.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(email)
            ?: unauthorized()

        if (!otp.isUsable(now, properties.otpMaxAttempts)) unauthorized()
        if (!hash.matches("$email:${request.code}", otp.codeHash)) {
            otp.failedAttempts += 1
            otpCodes.save(otp)
            unauthorized()
        }

        otp.consumedAt = now
        otpCodes.save(otp)

        val user = users.findByEmail(email) ?: users.save(
            User(email = email, createdAt = now, updatedAt = now),
        )
        recordLegalAcceptance(user, "TERMS", request.termsVersion)
        recordLegalAcceptance(user, "PRIVACY", request.privacyVersion)

        val (token, expiresAt) = sessionTokens.issue(user.id)
        return SessionResponse(token, expiresAt, SessionUser(user.id, user.email))
    }

    private fun recordLegalAcceptance(user: User, type: String, version: String) {
        if (!termsAcceptances.existsByUserIdAndDocumentTypeAndVersion(user.id, type, version)) {
            termsAcceptances.save(
                TermsAcceptance(
                    user = user,
                    documentType = type,
                    version = version,
                    acceptedAt = clock.instant(),
                ),
            )
        }
    }

    private fun normalizeEmail(email: String): String = email.trim().lowercase()

    private fun unauthorized(): Nothing =
        throw ApiProblem(HttpStatus.UNAUTHORIZED, "The OTP is invalid or expired.")
}
