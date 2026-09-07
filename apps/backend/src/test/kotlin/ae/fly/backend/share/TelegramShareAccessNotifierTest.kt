package ae.fly.backend.share

import ae.fly.backend.auth.TelegramBotClient
import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.auth.TelegramUploadNotification
import ae.fly.backend.auth.TelegramUrlButton
import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.User
import ae.fly.backend.repository.UserRepository
import ae.fly.backend.support.MutableClock
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.time.Instant
import java.util.UUID

class TelegramShareAccessNotifierTest {
    private val users = mock(UserRepository::class.java)
    private val bot = CapturingTelegramBotClient()
    private val clock = MutableClock(Instant.parse("2026-09-05T13:00:00Z"))

    @Test
    fun `sends safe share access details to the configured administrator`() {
        val user = User(id = UUID.randomUUID(), email = "owner@example.com")
        val document = Document(
            id = UUID.randomUUID(),
            user = user,
            category = Category(name = "Engine"),
            msn = "725766",
            originalFilename = "engine-report.pdf",
            sizeBytes = 2_048,
        )
        `when`(users.findById(user.id)).thenReturn(user)
        val notifier = TelegramShareAccessNotifier(
            telegram = TelegramProperties(
                enabled = true,
                botToken = "test-token",
                botUsername = "FlyAeOtpBot",
                webhookSecret = "test-webhook-secret",
                adminChatId = 275138197,
            ),
            botClient = bot,
            users = users,
            clock = clock,
        )

        val visitor = User(id = UUID.randomUUID(), email = "visitor@example.com")
        `when`(users.findById(visitor.id)).thenReturn(visitor)
        notifier.accessed(document, AuthenticatedUser(visitor.id), "203.0.113.10")

        assertTrue(bot.text.contains("SHARE-ССЫЛКА ИСПОЛЬЗОВАНА"))
        assertTrue(bot.text.contains("Владелец: owner@example.com (${user.id})"))
        assertTrue(bot.text.contains("Посетитель: visitor@example.com (${visitor.id})"))
        assertTrue(bot.text.contains("engine-report.pdf"))
        assertTrue(bot.text.contains(document.id.toString()))
        assertTrue(bot.text.contains("IP: 203.0.113.10"))
        assertFalse(bot.text.contains("share-token"))

        notifier.accessed(document, null, "2001:db8::1")
        assertTrue(bot.text.contains("Посетитель: Гость\n"))
        assertTrue(bot.text.contains("IP: 2001:db8::1"))
        assertFalse(bot.text.contains("visitor@example.com"))
    }

    private class CapturingTelegramBotClient : TelegramBotClient {
        var text = ""

        override fun sendInstructions(chatId: Long) = Unit
        override fun sendUploadNotification(
            chatId: Long,
            notification: TelegramUploadNotification,
        ) = Unit

        override fun sendAdminMessage(
            chatId: Long,
            text: String,
            buttons: List<TelegramUrlButton>,
        ) {
            this.text = text
        }
    }
}
