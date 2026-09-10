package ae.fly.backend.share

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.activity.DocumentActivityRecorder
import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.domain.DocumentActivityType
import ae.fly.backend.config.StorageProperties
import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
import ae.fly.backend.domain.ShareToken
import ae.fly.backend.ports.ObjectStorage
import ae.fly.backend.security.RateLimiter
import jakarta.servlet.http.HttpServletRequest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import java.net.URI
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken

class ShareControllerTest {
    private val shareTokens = mock(ShareTokenService::class.java)
    private val storage = mock(ObjectStorage::class.java)
    private val rateLimiter = mock(RateLimiter::class.java)
    private val notifier = mock(ShareAccessNotifier::class.java)
    private val activities = mock(DocumentActivityRecorder::class.java)
    private val storageProperties = StorageProperties(bucket = "documents")
    private val controller = ShareController(
        shareTokens = shareTokens,
        storage = storage,
        storageProperties = storageProperties,
        rateLimiter = rateLimiter,
        accessNotifier = notifier,
        activities = activities,
    )

    @Test
    fun `successful share resolution notifies the administrator`() {
        val document = Document(
            id = UUID.randomUUID(),
            category = Category(name = "Engine"),
            msn = "725766",
            originalFilename = "engine-report.pdf",
            objectKey = "users/owner/documents/engine-report.pdf",
            mimeType = "application/pdf",
            sizeBytes = 2_048,
            status = DocumentStatus.APPROVED,
        )
        val request = mock(HttpServletRequest::class.java)
        `when`(request.remoteAddr).thenReturn("203.0.113.10")
        `when`(shareTokens.resolve("valid-token")).thenReturn(ShareToken(document = document))
        `when`(storage.signDownload(document.objectKey, storageProperties.downloadSignatureTtl))
            .thenReturn(URI("https://download.example/engine-report.pdf"))

        val response = controller.resolve("valid-token", request)

        assertEquals("engine-report.pdf", response.filename)
        verify(notifier).accessed(document, null, "203.0.113.10")
        verify(activities).record(document.id, DocumentActivityType.SHARE_ACCESSED, null, "203.0.113.10")

        val visitor = AuthenticatedUser(UUID.randomUUID())
        controller.resolve("valid-token", request, UsernamePasswordAuthenticationToken(visitor, null, emptyList()))
        verify(notifier).accessed(document, visitor, "203.0.113.10")
        verify(activities).record(document.id, DocumentActivityType.SHARE_ACCESSED, visitor, "203.0.113.10")
    }

    @Test
    fun `invalid share does not notify the administrator`() {
        val request = mock(HttpServletRequest::class.java)
        `when`(request.remoteAddr).thenReturn("203.0.113.10")
        `when`(shareTokens.resolve("invalid-token"))
            .thenThrow(ApiProblem(HttpStatus.NOT_FOUND, "Share link not found."))

        assertThrows(ApiProblem::class.java) {
            controller.resolve("invalid-token", request)
        }

        verifyNoInteractions(notifier, activities)
    }

    @Test
    fun `temporary codes use a stricter rate limit`() {
        val request = mock(HttpServletRequest::class.java)
        `when`(request.remoteAddr).thenReturn("203.0.113.10")
        `when`(shareTokens.isTemporaryCode("7K9D-P4QX")).thenReturn(true)
        `when`(shareTokens.resolve("7K9D-P4QX"))
            .thenThrow(ApiProblem(HttpStatus.NOT_FOUND, "Share link not found."))

        assertThrows(ApiProblem::class.java) {
            controller.resolve("7K9D-P4QX", request)
        }

        verify(rateLimiter).check("temporary-share:203.0.113.10", 10, java.time.Duration.ofMinutes(1))
    }
}
