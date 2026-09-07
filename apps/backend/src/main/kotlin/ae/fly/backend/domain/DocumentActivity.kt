package ae.fly.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

enum class DocumentActivityType { UPLOAD_COMPLETED, SHARE_ACCESSED }

@Entity
@Table(name = "document_activities")
class DocumentActivity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "document_id", nullable = false) var documentId: UUID = UUID.randomUUID(),
    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 32)
    var eventType: DocumentActivityType = DocumentActivityType.SHARE_ACCESSED,
    @Column(name = "occurred_at", nullable = false) var occurredAt: Instant = Instant.now(),
    @Column(name = "ip_address", length = 45) var ipAddress: String? = null,
    @Column(name = "actor_user_id") var actorUserId: UUID? = null,
    @Column(name = "guest_session_id") var guestSessionId: UUID? = null,
)
