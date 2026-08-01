package ae.fly.backend.repository

import ae.fly.backend.domain.TermsAcceptance
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TermsAcceptanceRepository : JpaRepository<TermsAcceptance, UUID> {
    fun existsByUserIdAndDocumentTypeAndVersion(
        userId: UUID,
        documentType: String,
        version: String,
    ): Boolean
}
