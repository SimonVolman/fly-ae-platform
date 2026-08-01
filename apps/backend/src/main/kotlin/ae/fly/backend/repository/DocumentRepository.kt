package ae.fly.backend.repository

import ae.fly.backend.domain.Document
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface DocumentRepository : JpaRepository<Document, UUID> {
    fun findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId: UUID): List<Document>
    fun findByIdAndUserIdAndDeletedAtIsNull(id: UUID, userId: UUID): Document?
    fun findByIdAndGuestSessionIdAndDeletedAtIsNull(id: UUID, guestSessionId: UUID): Document?
    fun existsByGuestSessionId(guestSessionId: UUID): Boolean
}
