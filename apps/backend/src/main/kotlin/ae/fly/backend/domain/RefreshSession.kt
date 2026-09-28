package ae.fly.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * A long-lived login credential. Only a keyed hash of the browser value is
 * persisted, so a database export cannot be used as a browser session.
 */
@Entity
@Table(
    name = "refresh_sessions",
    indexes = [
        Index(name = "refresh_sessions_token_hash_idx", columnList = "token_hash", unique = true),
        Index(name = "refresh_sessions_family_idx", columnList = "family_id"),
    ],
)
class RefreshSession(
    @Id
    var id: UUID = UUID.randomUUID(),

    @Column(name = "user_id", nullable = false)
    var userId: UUID = UUID.randomUUID(),

    @Column(name = "family_id", nullable = false)
    var familyId: UUID = UUID.randomUUID(),

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    var tokenHash: String = "",

    @Column(name = "expires_at", nullable = false)
    var expiresAt: Instant = Instant.now(),

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(name = "rotated_at")
    var rotatedAt: Instant? = null,

    @Column(name = "successor_id")
    var successorId: UUID? = null,

    @Column(name = "revoked_at")
    var revokedAt: Instant? = null,
)
