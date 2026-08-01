package ae.fly.backend.upload

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.auth.AuthenticatedGuest
import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.auth.FlyPrincipal
import ae.fly.backend.config.StorageProperties
import ae.fly.backend.document.DocumentResponse
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
import ae.fly.backend.ports.CompletedPart
import ae.fly.backend.ports.JobQueue
import ae.fly.backend.ports.ObjectStorage
import ae.fly.backend.repository.DocumentRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.time.Clock
import java.util.UUID

@Service
class UploadService(
    private val documents: DocumentRepository,
    private val storage: ObjectStorage,
    private val queue: JobQueue,
    private val storageProperties: StorageProperties,
    private val clock: Clock,
) {
    @Transactional
    fun start(owner: FlyPrincipal, documentId: UUID): MultipartSessionResponse {
        val document = requireOwned(owner, documentId)
        if (document.status != DocumentStatus.CREATED) {
            throw ApiProblem(HttpStatus.CONFLICT, "The document is not ready to start uploading.")
        }

        val upload = storage.createMultipart(document.objectKey, document.mimeType)
        document.multipartUploadId = upload.uploadId
        document.status = DocumentStatus.UPLOADING
        document.updatedAt = clock.instant()
        documents.save(document)
        return MultipartSessionResponse(
            uploadId = upload.uploadId,
            key = upload.key,
            expiresAt = clock.instant().plus(storageProperties.uploadSignatureTtl),
        )
    }

    @Transactional(readOnly = true)
    fun signPart(
        owner: FlyPrincipal,
        documentId: UUID,
        uploadId: String,
        partNumber: Int,
    ): SignedPartResponse {
        val document = requireUploading(owner, documentId, uploadId)
        val url = storage.signPart(
            document.objectKey,
            uploadId,
            partNumber,
            storageProperties.uploadSignatureTtl,
        )
        return SignedPartResponse(url.toString())
    }

    @Transactional
    fun complete(
        owner: FlyPrincipal,
        documentId: UUID,
        uploadId: String,
        request: CompleteMultipartRequest,
    ): DocumentResponse {
        val document = requireUploading(owner, documentId, uploadId)
        val uniqueParts = request.parts.map(CompletedPartRequest::partNumber).toSet()
        if (uniqueParts.size != request.parts.size) {
            throw ApiProblem(HttpStatus.BAD_REQUEST, "Multipart part numbers must be unique.")
        }

        storage.completeMultipart(
            document.objectKey,
            uploadId,
            request.parts.map { CompletedPart(it.partNumber, it.etag) },
        )

        val metadata = storage.metadata(document.objectKey)
        val pdfHeader = storage.readPrefix(document.objectKey, 5)
        val validPdf = metadata.contentLength == document.sizeBytes &&
            metadata.contentType?.substringBefore(';') == "application/pdf" &&
            String(pdfHeader, StandardCharsets.US_ASCII) == "%PDF-"

        document.multipartUploadId = null
        document.updatedAt = clock.instant()
        if (!validPdf) {
            storage.delete(document.objectKey)
            document.status = DocumentStatus.FAILED
            document.failureReason = "INVALID_PDF"
            documents.save(document)
            return DocumentResponse.from(document)
        }

        document.status = DocumentStatus.PENDING
        document.failureReason = null
        documents.save(document)
        queue.enqueue(document.id)
        return DocumentResponse.from(document)
    }

    @Transactional
    fun abort(owner: FlyPrincipal, documentId: UUID, uploadId: String) {
        val document = requireUploading(owner, documentId, uploadId)
        storage.abortMultipart(document.objectKey, uploadId)
        document.multipartUploadId = null
        document.status = DocumentStatus.CREATED
        document.updatedAt = clock.instant()
        documents.save(document)
    }

    private fun requireUploading(owner: FlyPrincipal, documentId: UUID, uploadId: String): Document {
        val document = requireOwned(owner, documentId)
        if (
            document.status != DocumentStatus.UPLOADING ||
            document.multipartUploadId != uploadId
        ) {
            throw ApiProblem(HttpStatus.CONFLICT, "Multipart upload session does not match.")
        }
        return document
    }

    private fun requireOwned(owner: FlyPrincipal, documentId: UUID): Document {
        val document = when (owner) {
            is AuthenticatedUser ->
                documents.findByIdAndUserIdAndDeletedAtIsNull(documentId, owner.id)
            is AuthenticatedGuest ->
                documents.findByIdAndGuestSessionIdAndDeletedAtIsNull(documentId, owner.id)
        }
        return document ?: throw ApiProblem(HttpStatus.NOT_FOUND, "Document not found.")
    }
}
