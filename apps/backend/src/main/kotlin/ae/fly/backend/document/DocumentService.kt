package ae.fly.backend.document

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
import ae.fly.backend.auth.AuthenticatedGuest
import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.auth.FlyPrincipal
import ae.fly.backend.config.DocumentProperties
import ae.fly.backend.repository.CategoryRepository
import ae.fly.backend.repository.DocumentRepository
import ae.fly.backend.repository.GuestSessionRepository
import ae.fly.backend.repository.UserRepository
import ae.fly.backend.config.WebProperties
import ae.fly.backend.ports.ObjectStorage
import ae.fly.backend.share.ShareTokenService
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.util.UUID

@Service
class DocumentService(
    private val documents: DocumentRepository,
    private val categories: CategoryRepository,
    private val users: UserRepository,
    private val guestSessions: GuestSessionRepository,
    private val objectStorage: ObjectStorage,
    private val shareTokens: ShareTokenService,
    private val webProperties: WebProperties,
    private val documentProperties: DocumentProperties,
    private val clock: Clock,
) {
    @Transactional
    fun create(owner: FlyPrincipal, request: CreateDocumentRequest): DocumentResponse {
        if (!isSupportedUpload(request.filename, request.mimeType)) {
            throw ApiProblem(
                HttpStatus.BAD_REQUEST,
                "The filename extension does not match a supported file type.",
            )
        }
        val user = (owner as? AuthenticatedUser)?.let {
            users.findById(it.id)
                ?: throw ApiProblem(
                    HttpStatus.UNAUTHORIZED,
                    "The authenticated user no longer exists.",
                )
        }
        val guestSession = (owner as? AuthenticatedGuest)?.let {
            guestSessions.findById(it.id)
                ?: throw ApiProblem(
                    HttpStatus.UNAUTHORIZED,
                    "The guest session no longer exists.",
                )
        }
        val maxFileSize = when (owner) {
            is AuthenticatedUser -> documentProperties.authenticatedMaxFileSizeBytes
            is AuthenticatedGuest -> documentProperties.guestMaxFileSizeBytes
        }
        if (request.sizeBytes > maxFileSize) {
            val limitMb = maxFileSize / (1024 * 1024)
            throw ApiProblem(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "This upload is limited to $limitMb MB.",
            )
        }
        val category = categories.findByIdAndActiveTrue(request.categoryId)
            ?: throw ApiProblem(HttpStatus.BAD_REQUEST, "The selected category is unavailable.")
        val now = clock.instant()
        val documentId = UUID.randomUUID()
        val safeFilename = sanitizeFilename(request.filename)

        val ownerPath = when (owner) {
            is AuthenticatedUser -> "users/${owner.id}"
            is AuthenticatedGuest -> "guests/${owner.id}"
        }
        val document = documents.save(
            Document(
                id = documentId,
                user = user,
                guestSession = guestSession,
                category = category,
                msn = request.msn.trim(),
                originalFilename = request.filename.trim(),
                objectKey = "$ownerPath/documents/$documentId/$safeFilename",
                mimeType = request.mimeType,
                sizeBytes = request.sizeBytes,
                status = DocumentStatus.CREATED,
                createdAt = now,
                updatedAt = now,
            ),
        )
        return DocumentResponse.from(document)
    }

    @Transactional(readOnly = true)
    fun list(userId: UUID): List<DocumentResponse> =
        documents.findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
            .map(::response)

    @Transactional(readOnly = true)
    fun get(owner: FlyPrincipal, documentId: UUID): DocumentResponse =
        response(requireOwned(owner, documentId))

    @Transactional
    fun markDeleted(owner: FlyPrincipal, documentId: UUID) {
        val document = requireOwned(owner, documentId)
        objectStorage.delete(document.objectKey)
        shareTokens.revoke(document)
        document.status = DocumentStatus.DELETED
        document.deletedAt = clock.instant()
        document.updatedAt = clock.instant()
        documents.save(document)
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

    private fun response(document: Document): DocumentResponse {
        val shareUrl = shareTokens.rawFor(document)
            ?.let { "${webProperties.publicBaseUrl.trimEnd('/')}/share/$it" }
        return DocumentResponse.from(document, shareUrl)
    }

    private fun sanitizeFilename(filename: String): String {
        val leaf = filename.trim().substringAfterLast('/').substringAfterLast('\\')
        return leaf.replace(Regex("[^A-Za-z0-9._-]"), "_").take(180)
    }
}
