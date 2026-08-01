package ae.fly.backend.repository

import ae.fly.backend.domain.ShareToken
import java.util.UUID

interface ShareTokenRepository {
    fun findByTokenHashAndRevokedAtIsNull(tokenHash: String): ShareToken?
    fun findByDocumentIdAndRevokedAtIsNull(documentId: UUID): ShareToken?
    fun save(shareToken: ShareToken): ShareToken
}
