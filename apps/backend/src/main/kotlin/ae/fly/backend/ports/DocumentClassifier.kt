package ae.fly.backend.ports

enum class Classification {
    APPROVED,
    REJECTED,
}

data class ClassificationResult(
    val classification: Classification,
    val reason: String,
)

interface DocumentClassifier {
    fun classify(documentId: String, text: String): ClassificationResult
}
