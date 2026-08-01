package ae.fly.backend.repository

import ae.fly.backend.domain.OtpCode
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface OtpCodeRepository : JpaRepository<OtpCode, UUID> {
    fun findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(email: String): OtpCode?
    fun findAllByEmailAndConsumedAtIsNull(email: String): List<OtpCode>
}
