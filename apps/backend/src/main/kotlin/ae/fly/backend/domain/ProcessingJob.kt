package ae.fly.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "processing_jobs")
class ProcessingJob(
    @Id
    var id: UUID = UUID.randomUUID(),

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    var document: Document = Document(),

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    var status: ProcessingJobStatus = ProcessingJobStatus.QUEUED,

    @Column(nullable = false)
    var attempt: Int = 0,

    @Column(name = "error_code", length = 64)
    var errorCode: String? = null,

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(name = "started_at")
    var startedAt: Instant? = null,

    @Column(name = "completed_at")
    var completedAt: Instant? = null,
)
