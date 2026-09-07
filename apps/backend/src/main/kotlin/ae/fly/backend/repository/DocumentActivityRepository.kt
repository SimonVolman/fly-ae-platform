package ae.fly.backend.repository

import ae.fly.backend.domain.DocumentActivity
import java.util.UUID

interface DocumentActivityRepository {
    fun save(activity: DocumentActivity): DocumentActivity
    fun findRecentByDocumentId(documentId: UUID, limit: Int): List<DocumentActivity>
}
