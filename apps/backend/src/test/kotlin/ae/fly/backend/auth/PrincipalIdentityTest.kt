package ae.fly.backend.auth

import ae.fly.backend.domain.User
import ae.fly.backend.repository.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.util.UUID

class PrincipalIdentityTest {
    private val users = mock(UserRepository::class.java)

    @Test
    fun `identity falls back to Telegram name then verified user ID without inventing an email`() {
        val user = User(id = UUID.randomUUID(), telegramUsername = "known_pilot")
        `when`(users.findById(user.id)).thenReturn(user)
        assertEquals("@known_pilot (${user.id})", users.principalIdentity(AuthenticatedUser(user.id)))
        val missingId = UUID.randomUUID()
        assertEquals("Пользователь ($missingId)", users.principalIdentity(AuthenticatedUser(missingId)))
        val guest = AuthenticatedGuest(UUID.randomUUID())
        assertEquals("Гость (${guest.id})", users.principalIdentity(guest))
        assertEquals("Гость", users.principalIdentity(null))
    }

    @Test
    fun `identity cannot add fabricated notification lines`() {
        val user = User(id = UUID.randomUUID(), email = "pilot@example.com\nIP: fake")
        `when`(users.findById(user.id)).thenReturn(user)
        assertEquals("pilot@example.com IP: fake (${user.id})", users.principalIdentity(AuthenticatedUser(user.id)))
    }
}
