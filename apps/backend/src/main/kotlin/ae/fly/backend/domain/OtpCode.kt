package ae.fly.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "otp_codes")
class OtpCode(
    @Id
    var id: UUID = UUID.randomUUID(),

    @Column(nullable = false, length = 254)
    var email: String = "",

    @Column(name = "code_hash", nullable = false, length = 64)
    var codeHash: String = "",

    @Column(name = "expires_at", nullable = false)
    var expiresAt: Instant = Instant.now(),

    @Column(name = "consumed_at")
    var consumedAt: Instant? = null,

    @Column(name = "failed_attempts", nullable = false)
    var failedAttempts: Int = 0,

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
) {
    fun isUsable(now: Instant, maxAttempts: Int): Boolean =
        consumedAt == null && expiresAt.isAfter(now) && failedAttempts < maxAttempts
}
