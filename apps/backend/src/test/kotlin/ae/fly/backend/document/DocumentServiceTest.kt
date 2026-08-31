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
        `when`(guests.findById(guestId)).thenReturn(guestSession)
        `when`(categories.findByIdAndActiveTrue(categoryId)).thenReturn(category)
        `when`(documents.save(any(Document::class.java) ?: Document()))
            .thenAnswer { it.arguments[0] }
    }

    @Test
    fun `guest can create multiple documents up to one hundred mebibytes each`() {
        val first = service.create(
            AuthenticatedGuest(guestId),
            request(sizeBytes = 104_857_600),
        )
        val second = service.create(
            AuthenticatedGuest(guestId),
            request(
                sizeBytes = 42_000_000,
                filename = "second-upload.pdf",
            ),
        )

        assertEquals(104_857_600, first.sizeBytes)
        assertEquals(42_000_000, second.sizeBytes)
        assertTrue(first.filename.endsWith(".pdf"))
        assertNull(first.shareUrl)
    }

    @Test
    fun `guest can create image video and archive uploads`() {
        val image = service.create(
            AuthenticatedGuest(guestId),
            request(
                sizeBytes = 5_000_000,
                filename = "landing-gear.jpg",
                mimeType = "image/jpeg",
            ),
        )
        val video = service.create(
            AuthenticatedGuest(guestId),
            request(
                sizeBytes = 80_000_000,
                filename = "inspection.mp4",
                mimeType = "video/mp4",
            ),
        )
        val archive = service.create(
            AuthenticatedGuest(guestId),
            request(
                sizeBytes = 20_000_000,
                filename = "maintenance-records.zip",
                mimeType = "application/zip",
            ),
        )

        assertEquals("image/jpeg", image.mimeType)
        assertEquals("video/mp4", video.mimeType)
        assertEquals("application/zip", archive.mimeType)
    }

    @Test
    fun `filename extension must match the declared media type`() {
        val error = assertThrows(ApiProblem::class.java) {
            service.create(
                AuthenticatedGuest(guestId),
                request(
                    sizeBytes = 5_000_000,
                    filename = "inspection.jpg",
                    mimeType = "video/mp4",
                ),
            )
        }

        assertEquals(HttpStatus.BAD_REQUEST, error.status)
    }

    @Test
    fun `guest document above one hundred mebibytes returns payload too large`() {
        val error = assertThrows(ApiProblem::class.java) {
            service.create(
                AuthenticatedGuest(guestId),
                request(sizeBytes = 104_857_601),
            )
        }

        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, error.status)
        assertEquals("This upload is limited to 100 MB.", error.message)
    }

    private fun request(
        sizeBytes: Long,
        filename: String = "first-upload.pdf",
        mimeType: String = "application/pdf",
    ) = CreateDocumentRequest(
        categoryId = categoryId,
        msn = "34567",
        filename = filename,
        mimeType = mimeType,
        sizeBytes = sizeBytes,
    )
}
