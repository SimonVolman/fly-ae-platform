package ae.fly.backend.repository

import ae.fly.backend.domain.ShareToken
import java.time.Instant
import java.util.UUID

interface ShareTokenRepository {
    fun findByTokenHashAndRevokedAtIsNull(tokenHash: String): ShareToken?
    fun findByDocumentIdAndRevokedAtIsNull(documentId: UUID): ShareToken?
    fun findByShortCodeHashAndRevokedAtIsNullAndShortCodeExpiresAtAfter(
        shortCodeHash: String,
        instant: Instant,
    ): ShareToken?
    fun shortCodeHashExists(shortCodeHash: String): Boolean
    fun save(shareToken: ShareToken): ShareToken
}
