package ae.fly.backend.upload

import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.auth.TelegramBotClient
import ae.fly.backend.auth.TelegramUploadNotification
import ae.fly.backend.auth.TelegramUrlButton
import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.User
import ae.fly.backend.repository.UserRepository
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.time.Duration
import java.time.Instant
import java.util.UUID

class TelegramUploadNotifierTest {
    private val userId = UUID.randomUUID()
    private val owner = AuthenticatedUser(userId)
    private val document = Document(
        id = UUID.randomUUID(),
        user = User(id = userId),
        category = Category(code = "ENGINE", name = "Engine"),
        originalFilename = "engine-report.pdf",
        sizeBytes = 2_048,
        updatedAt = Instant.parse("2026-09-02T07:35:46Z"),
    )
    private val users = mock(UserRepository::class.java)
    private val bot = CapturingTelegramBotClient()

    @Test
    fun `sends an upload alert only to the configured private chat`() {
        `when`(users.findById(userId)).thenReturn(
            User(
                id = userId,
                email = "pilot@example.com",
                telegramChatId = 999L,
            ),
        )
        val notifier = TelegramUploadNotifier(properties(chatId = 123L), bot, users)

        notifier.completed(owner, document)

        assertEquals(123L, bot.chatId)
        assertEquals("pilot@example.com ($userId)", bot.notification?.uploader)
        assertEquals("engine-report.pdf", bot.notification?.filename)
    }

    @Test
    fun `does not send when the single recipient is not configured`() {
        val notifier = TelegramUploadNotifier(properties(chatId = 0L), bot, users)

        notifier.completed(owner, document)

        assertNull(bot.chatId)
    }

    @Test
    fun `does not fail a completed upload when Telegram delivery fails`() {
        `when`(users.findById(userId)).thenReturn(User(id = userId, email = "pilot@example.com"))
        bot.fail = true
        val notifier = TelegramUploadNotifier(properties(chatId = 123L), bot, users)

        assertDoesNotThrow { notifier.completed(owner, document) }
    }

    private fun properties(chatId: Long) = TelegramProperties(
        enabled = true,
        botToken = "test-token",
        botUsername = "FlyAeOtpBot",
        webhookSecret = "test-webhook-secret",
        adminChatId = chatId,
    )

    private class CapturingTelegramBotClient : TelegramBotClient {
        var chatId: Long? = null
        var notification: TelegramUploadNotification? = null
        var fail = false

        override fun sendOtp(chatId: Long, code: String, ttl: Duration) = Unit

        override fun sendInvalidLink(chatId: Long) = Unit

        override fun sendInstructions(chatId: Long) = Unit

        override fun sendUploadNotification(
            chatId: Long,
            notification: TelegramUploadNotification,
        ) {
            if (fail) error("simulated delivery failure")
            this.chatId = chatId
            this.notification = notification
        }

        override fun sendAdminMessage(
            chatId: Long,
            text: String,
            buttons: List<TelegramUrlButton>,
        ) = Unit
    }
}
