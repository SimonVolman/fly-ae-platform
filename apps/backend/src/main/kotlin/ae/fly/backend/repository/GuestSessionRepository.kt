package ae.fly.backend.repository

import ae.fly.backend.domain.GuestSession
import java.time.Instant
import java.util.UUID

interface GuestSessionRepository {
    fun findById(id: UUID): GuestSession?
    fun existsByIdAndExpiresAtAfter(id: UUID, instant: Instant): Boolean
    fun save(guestSession: GuestSession): GuestSession
}
