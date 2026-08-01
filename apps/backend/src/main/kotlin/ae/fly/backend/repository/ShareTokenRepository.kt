package ae.fly.backend.repository

import ae.fly.backend.domain.ShareToken
import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ShareTokenRepository : JpaRepository<ShareToken, UUID> {
    @EntityGraph(attributePaths = ["document", "document.category"])
    fun findByTokenHashAndRevokedAtIsNull(tokenHash: String): ShareToken?
    fun findByDocumentIdAndRevokedAtIsNull(documentId: UUID): ShareToken?
}
