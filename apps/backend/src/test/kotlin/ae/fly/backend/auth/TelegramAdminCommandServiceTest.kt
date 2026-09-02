package ae.fly.backend.auth

import ae.fly.backend.config.StorageProperties
import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
import ae.fly.backend.domain.User
import ae.fly.backend.ports.CompletedPart
import ae.fly.backend.ports.MultipartUpload
import ae.fly.backend.ports.ObjectStorage
import ae.fly.backend.ports.StoredObjectMetadata
import ae.fly.backend.repository.DocumentRepository
import ae.fly.backend.repository.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.util.UUID

class TelegramAdminCommandServiceTest {
    private val adminChatId = 275138197L
    private val user = User(
        id = UUID.randomUUID(),
        email = "pilot@example.com",
        createdAt = Instant.parse("2026-09-01T08:00:00Z"),
        updatedAt = Instant.parse("2026-09-02T08:00:00Z"),
    )
    private val document = Document(
        id = UUID.randomUUID(),
        user = user,
        category = Category(code = "ENGINE", name = "Engine"),
        msn = "725766",
        originalFilename = "engine-report.pdf",
        objectKey = "users/${user.id}/documents/report/engine-report.pdf",
        mimeType = "application/pdf",
        sizeBytes = 2_048,
        status = DocumentStatus.APPROVED,
        createdAt = Instant.parse("2026-09-02T07:35:46Z"),
        updatedAt = Instant.parse("2026-09-02T07:36:00Z"),
    )
    private val users = mock(UserRepository::class.java)
    private val documents = mock(DocumentRepository::class.java)
    private val storage = FakeObjectStorage()
    private val bot = CapturingTelegramBotClient()
    private val service = TelegramAdminCommandService(
        telegram = TelegramProperties(
            enabled = true,
            botToken = "test-token",
            botUsername = "FlyAeOtpBot",
            webhookSecret = "test-webhook-secret",
            adminChatId = adminChatId,
        ),
        botClient = bot,
        users = users,
        documents = documents,
        storage = storage,
        storageProperties = StorageProperties(bucket = "documents"),
    )

    @Test
    fun `returns recent file details and a private download button to the admin`() {
        `when`(documents.findRecent(100)).thenReturn(listOf(document))
        `when`(users.findById(user.id)).thenReturn(user)

        val handled = service.handle(adminMessage("/activity"))

        assertTrue(handled)
        assertEquals(adminChatId, bot.chatId)
        assertTrue(requireNotNull(bot.text).contains("engine-report.pdf"))
        assertTrue(requireNotNull(bot.text).contains("pilot@example.com"))
        assertTrue(requireNotNull(bot.text).contains("725766"))
        assertEquals("https://download.example/engine-report.pdf", bot.buttons.single().url)
        assertEquals(1, storage.signedDownloads)
    }

    @Test
    fun `finds files for one user by email`() {
        `when`(users.findByEmail("pilot@example.com")).thenReturn(user)
        `when`(documents.findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.id))
            .thenReturn(listOf(document))

        service.handle(adminMessage("/files pilot@example.com 3"))

        assertTrue(requireNotNull(bot.text).startsWith("Файлы pilot@example.com"))
        assertEquals(document.id.toString(), requireNotNull(bot.text).substringAfter("Document ID: "))
        assertEquals(1, bot.buttons.size)
    }

    @Test
    fun `silently consumes admin commands from every other chat`() {
        val handled = service.handle(
            TelegramMessage(
                text = "/activity",
                chat = TelegramChat(id = 123L, type = "private"),
            ),
        )

        assertTrue(handled)
        assertEquals(null, bot.chatId)
        assertEquals(0, storage.signedDownloads)
    }

    @Test
    fun `leaves regular bot commands for the OTP service`() {
        assertFalse(service.handle(adminMessage("/start token")))
        assertEquals(null, bot.chatId)
    }

    private fun adminMessage(text: String) = TelegramMessage(
        text = text,
        chat = TelegramChat(id = adminChatId, type = "private"),
        from = TelegramUser(id = adminChatId),
    )

    private class CapturingTelegramBotClient : TelegramBotClient {
        var chatId: Long? = null
        var text: String? = null
        var buttons: List<TelegramUrlButton> = emptyList()

        override fun sendOtp(chatId: Long, code: String, ttl: Duration) = Unit

        override fun sendInvalidLink(chatId: Long) = Unit

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
            this.chatId = chatId
            this.text = text
            this.buttons = buttons
        }
    }

    private class FakeObjectStorage : ObjectStorage {
        var signedDownloads = 0

        override fun createMultipart(key: String, contentType: String): MultipartUpload =
            error("not used")

        override fun signPart(
            key: String,
            uploadId: String,
            partNumber: Int,
            ttl: Duration,
        ): URI = error("not used")

        override fun completeMultipart(
            key: String,
            uploadId: String,
            parts: List<CompletedPart>,
        ) = error("not used")

        override fun abortMultipart(key: String, uploadId: String) = error("not used")

        override fun metadata(key: String): StoredObjectMetadata = error("not used")

        override fun readPrefix(key: String, bytes: Int): ByteArray = error("not used")

        override fun signDownload(key: String, ttl: Duration): URI {
            signedDownloads += 1
            return URI("https://download.example/engine-report.pdf")
        }

        override fun delete(key: String) = error("not used")
    }
}
