package ae.fly.backend.persistence.postgres

import ae.fly.backend.domain.DocumentActivity
import ae.fly.backend.repository.DocumentActivityRepository
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

interface JpaDocumentActivityRepository : JpaRepository<DocumentActivity, UUID> {
    fun findByDocumentIdOrderByOccurredAtDescIdDesc(documentId: UUID, pageable: Pageable): List<DocumentActivity>
}

@Repository
@ConditionalOnProperty(name = ["fly.persistence.type"], havingValue = "postgres", matchIfMissing = true)
class PostgresDocumentActivityRepository(private val delegate: JpaDocumentActivityRepository) : DocumentActivityRepository {
    // A failed audit write must not mark the surrounding upload transaction rollback-only.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    override fun save(activity: DocumentActivity): DocumentActivity = delegate.saveAndFlush(activity)

    override fun findRecentByDocumentId(documentId: UUID, limit: Int): List<DocumentActivity> =
        delegate.findByDocumentIdOrderByOccurredAtDescIdDesc(documentId, PageRequest.of(0, limit))
}
