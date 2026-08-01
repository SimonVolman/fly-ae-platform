package ae.fly.backend.document

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.auth.AuthenticatedGuest
import ae.fly.backend.config.DocumentProperties
import ae.fly.backend.config.WebProperties
import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.GuestSession
import ae.fly.backend.ports.ObjectStorage
import ae.fly.backend.repository.CategoryRepository
import ae.fly.backend.repository.DocumentRepository
import ae.fly.backend.repository.GuestSessionRepository
import ae.fly.backend.repository.UserRepository
import ae.fly.backend.share.ShareTokenService
import ae.fly.backend.support.MutableClock
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.http.HttpStatus
import java.time.Instant
import java.util.Optional
import java.util.UUID

class DocumentServiceTest {
    private val guestId = UUID.randomUUID()
    private val categoryId = UUID.randomUUID()
    private val category = Category(id = categoryId, code = "AIRCRAFT", name = "Aircraft")
    private val guestSession = GuestSession(id = guestId)
    private val documents = mock(DocumentRepository::class.java)
    private val categories = mock(CategoryRepository::class.java)
    private val users = mock(UserRepository::class.java)
    private val guests = mock(GuestSessionRepository::class.java)
    private val storage = mock(ObjectStorage::class.java)
    private val shares = mock(ShareTokenService::class.java)
    private val service = DocumentService(
        documents = documents,
        categories = categories,
        users = users,
        guestSessions = guests,
        objectStorage = storage,
        shareTokens = shares,
        webProperties = WebProperties(),
        documentProperties = DocumentProperties(),
        clock = MutableClock(Instant.parse("2026-08-01T12:00:00Z")),
    )

    init {
        `when`(guests.findById(guestId)).thenReturn(Optional.of(guestSession))
        `when`(documents.existsByGuestSessionId(guestId)).thenReturn(false)
        `when`(categories.findByIdAndActiveTrue(categoryId)).thenReturn(category)
        `when`(documents.save(any(Document::class.java))).thenAnswer { it.arguments[0] }
    }

    @Test
    fun `guest can create one document up to ten mebibytes`() {
        val response = service.create(
            AuthenticatedGuest(guestId),
            request(sizeBytes = 10_485_760),
        )

        assertEquals(10_485_760, response.sizeBytes)
        assertTrue(response.filename.endsWith(".pdf"))
        assertNull(response.shareUrl)
    }

    @Test
    fun `guest document above ten mebibytes returns payload too large`() {
        val error = assertThrows(ApiProblem::class.java) {
            service.create(
                AuthenticatedGuest(guestId),
                request(sizeBytes = 10_485_761),
            )
        }

        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, error.status)
        assertEquals("This upload is limited to 10 MB.", error.message)
    }

    private fun request(sizeBytes: Long) = CreateDocumentRequest(
        categoryId = categoryId,
        msn = "34567",
        filename = "first-upload.pdf",
        mimeType = "application/pdf",
        sizeBytes = sizeBytes,
    )
}
