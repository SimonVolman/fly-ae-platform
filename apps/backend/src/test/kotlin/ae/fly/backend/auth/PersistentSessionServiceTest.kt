package ae.fly.backend.auth

import ae.fly.backend.config.SecurityProperties
import ae.fly.backend.domain.RefreshSession
import ae.fly.backend.domain.User
import ae.fly.backend.repository.RefreshSessionRepository
import ae.fly.backend.repository.UserRepository
import ae.fly.backend.support.MutableClock
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.util.UUID

class PersistentSessionServiceTest {
    private val clock = MutableClock(Instant.parse("2026-09-17T12:00:00Z"))
    private val properties = SecurityProperties(
        sessionSecret = "test-session-secret-with-at-least-32-characters",
        otpPepper = "test-otp-pepper-with-at-least-32-characters",
        shareEncryptionSecret = "test-share-secret-with-at-least-32-characters",
        sessionTtl = Duration.ofMinutes(15),
        refreshSessionTtl = Duration.ofDays(30),
        refreshReuseGrace = Duration.ofSeconds(30),
    )
    private val user = User(id = UUID.randomUUID(), email = "pilot@fly.ae")
    private val users = InMemoryUsers(user)
    private val refreshSessions = InMemoryRefreshSessions()
    private val service = PersistentSessionService(
        refreshSessions,
        users,
        SessionTokenService(properties, clock),
        properties,
        clock,
    )

    @Test
    fun `refresh rotates the browser credential without extending absolute expiry`() {
        val login = service.login(user)
        val refreshed = requireNotNull(service.refresh(login.refreshToken))

        assertNotEquals(login.refreshToken, refreshed.replacementRefreshToken)
        assertNotNull(refreshed.refreshExpiresAt)
        assertTrue(refreshed.refreshExpiresAt == login.refreshExpiresAt)
        assertNotNull(SessionTokenService(properties, clock).verify(refreshed.response.accessToken))
    }

    @Test
    fun `simultaneous refresh accepts the just-rotated cookie without issuing another cookie`() {
        val login = service.login(user)
        val first = requireNotNull(service.refresh(login.refreshToken))
        val concurrent = requireNotNull(service.refresh(login.refreshToken))

        assertNotNull(first.replacementRefreshToken)
        assertNull(concurrent.replacementRefreshToken)
    }

    @Test
    fun `reused refresh credential revokes its family after grace period`() {
        val login = service.login(user)
        val first = requireNotNull(service.refresh(login.refreshToken))
        clock.advance(Duration.ofSeconds(31))

        assertNull(service.refresh(login.refreshToken))
        assertNull(service.refresh(first.replacementRefreshToken))
    }

    private class InMemoryRefreshSessions : RefreshSessionRepository {
        private val values = linkedMapOf<UUID, RefreshSession>()

        override fun findById(id: UUID): RefreshSession? = values[id]
        override fun findByTokenHash(tokenHash: String): RefreshSession? =
            values.values.firstOrNull { it.tokenHash == tokenHash }

        override fun save(session: RefreshSession): RefreshSession = session.also { values[it.id] = it }

        override fun rotate(currentId: UUID, rotatedAt: Instant, successor: RefreshSession): Boolean {
            val current = values[currentId] ?: return false
            if (current.rotatedAt != null || current.revokedAt != null) return false
            current.rotatedAt = rotatedAt
            current.successorId = successor.id
            values[successor.id] = successor
            return true
        }

        override fun revokeFamily(familyId: UUID, revokedAt: Instant) {
            values.values.filter { it.familyId == familyId && it.revokedAt == null }
                .forEach { it.revokedAt = revokedAt }
        }
    }

    private class InMemoryUsers(private val user: User) : UserRepository {
        override fun findById(id: UUID): User? = user.takeIf { it.id == id }
        override fun findRecent(limit: Int): List<User> = listOf(user).take(limit)
        override fun existsById(id: UUID): Boolean = user.id == id
        override fun findByEmail(email: String): User? = user.takeIf { it.email == email }
        override fun findByTelegramUserId(telegramUserId: Long): User? = null
        override fun save(user: User): User = user
    }
}
