package ae.fly.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "telegram_login_requests")
class TelegramLoginRequest(
    @Id
    var id: UUID = UUID.randomUUID(),

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    var tokenHash: String = "",

    @Column(name = "code_hash", length = 64)
    var codeHash: String? = null,

    @Column(name = "telegram_user_id")
    var telegramUserId: Long? = null,

    @Column(name = "telegram_chat_id")
    var telegramChatId: Long? = null,

    @Column(name = "telegram_username", length = 64)
    var telegramUsername: String? = null,

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
