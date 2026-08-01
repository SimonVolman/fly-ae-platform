package ae.fly.backend.repository

import ae.fly.backend.domain.Document
import java.util.UUID

interface DocumentRepository {
    fun findById(id: UUID): Document?
    fun findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId: UUID): List<Document>
    fun findByIdAndUserIdAndDeletedAtIsNull(id: UUID, userId: UUID): Document?
    fun findByIdAndGuestSessionIdAndDeletedAtIsNull(id: UUID, guestSessionId: UUID): Document?
    fun existsByGuestSessionId(guestSessionId: UUID): Boolean
    fun save(document: Document): Document
}
