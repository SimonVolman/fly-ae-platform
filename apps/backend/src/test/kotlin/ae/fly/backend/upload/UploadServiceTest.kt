package ae.fly.backend.upload

import ae.fly.backend.config.StorageProperties
import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
import ae.fly.backend.domain.User
import ae.fly.backend.ports.CompletedPart
import ae.fly.backend.ports.JobQueue
import ae.fly.backend.ports.MultipartUpload
import ae.fly.backend.ports.ObjectStorage
import ae.fly.backend.ports.StoredObjectMetadata
import ae.fly.backend.repository.DocumentRepository
import ae.fly.backend.support.MutableClock
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.util.UUID

class UploadServiceTest {
    private val userId = UUID.randomUUID()
    private val owner = AuthenticatedUser(userId)
    private val documentId = UUID.randomUUID()
    private val document = Document(
        id = documentId,
        user = User(id = userId, email = "pilot@fly.ae"),
        category = Category(code = "AIRCRAFT", name = "Aircraft"),
        msn = "34567",
        originalFilename = "amm.pdf",
        objectKey = "users/$userId/documents/$documentId/amm.pdf",
        mimeType = "application/pdf",
        sizeBytes = 42,
    )
    private val documents = mock(DocumentRepository::class.java)
    private val storage = FakeObjectStorage()
    private val queue = CapturingQueue()
    private val clock = MutableClock(Instant.parse("2026-07-26T12:00:00Z"))
    private val service = UploadService(
        documents,
        storage,
        queue,
        StorageProperties(
            endpoint = URI("http://localhost:9000"),
            bucket = "fly-ae-documents",
            accessKey = "flyae",
            secretKey = "secret",
            uploadSignatureTtl = Duration.ofHours(1),
        ),
        clock,
    )

    init {
        `when`(documents.findByIdAndUserIdAndDeletedAtIsNull(documentId, userId))
            .thenReturn(document)
        `when`(documents.save(document)).thenReturn(document)
    }

    @Test
    fun `moves a verified PDF from created to pending and enqueues it`() {
        val session = service.start(owner, documentId)
        assertEquals(DocumentStatus.UPLOADING, document.status)

        storage.metadata = StoredObjectMetadata("application/pdf", 42)
        storage.prefix = "%PDF-".toByteArray()
        val result = service.complete(
            owner,
            documentId,
            session.uploadId,
            CompleteMultipartRequest(listOf(CompletedPartRequest(1, "\"etag\""))),
        )

        assertEquals(DocumentStatus.PENDING, result.status)
        assertEquals(documentId, queue.documentId)
        assertTrue(storage.completed)
    }

    @Test
    fun `moves a verified image from created to pending and enqueues it`() {
        document.originalFilename = "landing-gear.jpg"
        document.mimeType = "image/jpeg"
        val session = service.start(owner, documentId)
        storage.metadata = StoredObjectMetadata("image/jpeg", 42)
        storage.prefix = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte())

        val result = service.complete(
            owner,
            documentId,
            session.uploadId,
            CompleteMultipartRequest(listOf(CompletedPartRequest(1, "\"etag\""))),
        )

        assertEquals(DocumentStatus.PENDING, result.status)
        assertEquals(documentId, queue.documentId)
    }

    @Test
    fun `moves a verified video from created to pending and enqueues it`() {
        document.originalFilename = "inspection.mp4"
        document.mimeType = "video/mp4"
        val session = service.start(owner, documentId)
        storage.metadata = StoredObjectMetadata("video/mp4", 42)
        storage.prefix = byteArrayOf(0, 0, 0, 24) + "ftypisom".toByteArray()

        val result = service.complete(
            owner,
            documentId,
            session.uploadId,
            CompleteMultipartRequest(listOf(CompletedPartRequest(1, "\"etag\""))),
        )

        assertEquals(DocumentStatus.PENDING, result.status)
        assertEquals(documentId, queue.documentId)
    }

    @Test
    fun `rejects and removes a stored object with an invalid signature`() {
        val session = service.start(owner, documentId)
        storage.metadata = StoredObjectMetadata("application/pdf", 42)
        storage.prefix = "HELLO".toByteArray()

        val result = service.complete(
            owner,
            documentId,
            session.uploadId,
            CompleteMultipartRequest(listOf(CompletedPartRequest(1, "\"etag\""))),
        )

        assertEquals(DocumentStatus.FAILED, result.status)
        assertEquals("INVALID_FILE", document.failureReason)
        assertTrue(storage.deleted)
        assertEquals(null, queue.documentId)
    }

    private class CapturingQueue : JobQueue {
        var documentId: UUID? = null

        override fun enqueue(documentId: UUID) {
            this.documentId = documentId
        }
    }

    private class FakeObjectStorage : ObjectStorage {
        var metadata = StoredObjectMetadata("application/pdf", 0)
        var prefix = ByteArray(0)
        var completed = false
        var deleted = false

        override fun createMultipart(key: String, contentType: String) =
            MultipartUpload("upload-1", key)

        override fun signPart(
            key: String,
            uploadId: String,
            partNumber: Int,
            ttl: Duration,
        ): URI = URI("http://localhost/upload/$partNumber")

        override fun completeMultipart(
            key: String,
            uploadId: String,
            parts: List<CompletedPart>,
        ) {
            completed = true
        }

        override fun abortMultipart(key: String, uploadId: String) = Unit

        override fun metadata(key: String): StoredObjectMetadata = metadata

        override fun readPrefix(key: String, bytes: Int): ByteArray = prefix

        override fun signDownload(key: String, ttl: Duration): URI =
            URI("http://localhost/download")

        override fun delete(key: String) {
            deleted = true
        }
    }
}
