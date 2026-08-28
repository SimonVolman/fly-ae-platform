package ae.fly.backend.repository

import ae.fly.backend.domain.TelegramLoginRequest
import java.util.UUID

interface TelegramLoginRequestRepository {
    fun findById(id: UUID): TelegramLoginRequest?
    fun findByTokenHashAndConsumedAtIsNull(tokenHash: String): TelegramLoginRequest?
    fun save(request: TelegramLoginRequest): TelegramLoginRequest
}
