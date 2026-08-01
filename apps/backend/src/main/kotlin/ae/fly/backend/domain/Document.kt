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
@Table(name = "documents")
class Document(
    @Id
    var id: UUID = UUID.randomUUID(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    var user: User? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_session_id")
    var guestSession: GuestSession? = null,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    var category: Category = Category(),

    @Column(nullable = false, length = 64)
    var msn: String = "",

    @Column(name = "original_filename", nullable = false, length = 255)
    var originalFilename: String = "",

    @Column(name = "object_key", nullable = false, unique = true, length = 768)
    var objectKey: String = "",

    @Column(name = "mime_type", nullable = false, length = 120)
    var mimeType: String = "",

    @Column(name = "size_bytes", nullable = false)
    var sizeBytes: Long = 0,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    var status: DocumentStatus = DocumentStatus.CREATED,

    @Column(name = "multipart_upload_id", length = 512)
    var multipartUploadId: String? = null,

    @Column(name = "failure_reason", length = 128)
    var failureReason: String? = null,

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),

    @Column(name = "deleted_at")
    var deletedAt: Instant? = null,
)
