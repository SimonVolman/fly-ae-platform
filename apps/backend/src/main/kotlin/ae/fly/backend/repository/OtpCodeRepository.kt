package ae.fly.backend.repository

import ae.fly.backend.domain.OtpCode

interface OtpCodeRepository {
    fun findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(email: String): OtpCode?
    fun findAllByEmailAndConsumedAtIsNull(email: String): List<OtpCode>
    fun save(otpCode: OtpCode): OtpCode
}
