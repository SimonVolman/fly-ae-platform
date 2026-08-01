package ae.fly.backend.repository

import ae.fly.backend.domain.TermsAcceptance
import java.util.UUID

interface TermsAcceptanceRepository {
    fun existsByUserIdAndDocumentTypeAndVersion(
        userId: UUID,
        documentType: String,
        version: String,
    ): Boolean
    fun save(termsAcceptance: TermsAcceptance): TermsAcceptance
}
