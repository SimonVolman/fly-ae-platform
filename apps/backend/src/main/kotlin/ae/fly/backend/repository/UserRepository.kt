package ae.fly.backend.repository

import ae.fly.backend.domain.User
import java.util.UUID

interface UserRepository {
    fun findById(id: UUID): User?
    fun findRecent(limit: Int): List<User>
    fun existsById(id: UUID): Boolean
    fun findByEmail(email: String): User?
    fun findByTelegramUserId(telegramUserId: Long): User?
    fun save(user: User): User
}
