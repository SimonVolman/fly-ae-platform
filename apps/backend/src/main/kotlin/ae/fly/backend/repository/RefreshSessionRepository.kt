package ae.fly.backend.repository

import ae.fly.backend.domain.RefreshSession
import java.time.Instant
import java.util.UUID

interface RefreshSessionRepository {
    fun findById(id: UUID): RefreshSession?
    fun findByTokenHash(tokenHash: String): RefreshSession?
    fun save(session: RefreshSession): RefreshSession

    /** Atomically marks [currentId] as rotated and stores [successor]. */
    fun rotate(currentId: UUID, rotatedAt: Instant, successor: RefreshSession): Boolean

    fun revokeFamily(familyId: UUID, revokedAt: Instant)
}
