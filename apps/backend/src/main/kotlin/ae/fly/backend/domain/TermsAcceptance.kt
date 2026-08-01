package ae.fly.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "terms_acceptances")
class TermsAcceptance(
    @Id
    var id: UUID = UUID.randomUUID(),

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User = User(),

    @Column(name = "document_type", nullable = false, length = 32)
    var documentType: String = "",

    @Column(nullable = false, length = 32)
    var version: String = "",

    @Column(name = "accepted_at", nullable = false)
    var acceptedAt: Instant = Instant.now(),
)
