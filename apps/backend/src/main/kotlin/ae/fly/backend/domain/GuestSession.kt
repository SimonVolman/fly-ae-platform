package ae.fly.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "guest_sessions")
class GuestSession(
    @Id
    var id: UUID = UUID.randomUUID(),

    @Column(name = "accepted_terms_version", nullable = false, length = 32)
    var acceptedTermsVersion: String = "",

    @Column(name = "accepted_privacy_version", nullable = false, length = 32)
    var acceptedPrivacyVersion: String = "",

    @Column(name = "accepted_at", nullable = false)
    var acceptedAt: Instant = Instant.now(),

    @Column(name = "expires_at", nullable = false)
    var expiresAt: Instant = Instant.now(),

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
)
