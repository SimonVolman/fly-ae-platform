package ae.fly.backend.domain

enum class DocumentStatus {
    CREATED,
    UPLOADING,
    PENDING,
    PROCESSING,
    APPROVED,
    REJECTED,
    FAILED,
    DELETED,
}
