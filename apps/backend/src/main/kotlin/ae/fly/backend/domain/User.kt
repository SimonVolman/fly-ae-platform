package ae.fly.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "users")
class User(
    @Id
    var id: UUID = UUID.randomUUID(),

    @Column(unique = true, length = 254)
    var email: String? = null,

    @Column(name = "telegram_user_id", unique = true)
    var telegramUserId: Long? = null,

    @Column(name = "telegram_chat_id")
    var telegramChatId: Long? = null,

    @Column(name = "telegram_username", length = 64)
    var telegramUsername: String? = null,

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)
