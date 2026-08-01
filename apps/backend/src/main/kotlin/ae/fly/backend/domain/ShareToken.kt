package ae.fly.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.OneToOne
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "share_tokens")
class ShareToken(
    @Id
    var id: UUID = UUID.randomUUID(),

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false, unique = true)
    var document: Document = Document(),

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    var tokenHash: String = "",

    @Column(name = "token_prefix", nullable = false, length = 12)
    var tokenPrefix: String = "",

    @Column(name = "token_ciphertext", nullable = false)
    var tokenCiphertext: String = "",

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(name = "revoked_at")
    var revokedAt: Instant? = null,
)
