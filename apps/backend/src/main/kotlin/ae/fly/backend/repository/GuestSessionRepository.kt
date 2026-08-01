package ae.fly.backend.repository

import ae.fly.backend.domain.GuestSession
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant
import java.util.UUID

interface GuestSessionRepository : JpaRepository<GuestSession, UUID> {
    fun existsByIdAndExpiresAtAfter(id: UUID, instant: Instant): Boolean
}
