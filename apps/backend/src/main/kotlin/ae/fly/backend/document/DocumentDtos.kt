package ae.fly.backend.document

import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

data class CategoryResponse(
    val id: UUID,
    val code: String,
    val name: String,
) {
    companion object {
        fun from(category: Category) = CategoryResponse(category.id, category.code, category.name)
    }
}

data class CreateDocumentRequest(
    val categoryId: UUID,

    @field:NotBlank
    @field:Size(max = 64)
    @field:Pattern(
        regexp = "^[A-Za-z0-9 ./_-]+$",
        message = "must contain only letters, numbers, spaces, dots, slashes, underscores or dashes",
    )
    val msn: String,

    @field:NotBlank
    @field:Size(min = 5, max = 255)
    @field:Pattern(regexp = "(?i)^.+\\.pdf$", message = "must end in .pdf")
    val filename: String,

    @field:Pattern(
        regexp = "^application/pdf$",
        message = "must be application/pdf",
    )
    val mimeType: String,

    @field:Min(1)
    @field:Max(3_221_225_472)
    val sizeBytes: Long,
)

data class DocumentResponse(
    val id: UUID,
    val category: CategoryResponse,
    val msn: String,
    val filename: String,
    val mimeType: String,
    val sizeBytes: Long,
    val status: DocumentStatus,
    val shareUrl: String?,
    val createdAt: Instant,
) {
    companion object {
        fun from(document: Document, shareUrl: String? = null) =
            DocumentResponse(
                id = document.id,
                category = CategoryResponse.from(document.category),
                msn = document.msn,
                filename = document.originalFilename,
                mimeType = document.mimeType,
                sizeBytes = document.sizeBytes,
                status = document.status,
                shareUrl = shareUrl,
                createdAt = document.createdAt,
            )
    }
}
