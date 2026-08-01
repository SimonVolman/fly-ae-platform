package ae.fly.backend.processing

import ae.fly.backend.ports.Classification
import ae.fly.backend.ports.ClassificationResult
import ae.fly.backend.ports.DocumentClassifier
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component

@Component
@Profile("local", "test", "v0-prod")
class DeterministicDocumentClassifier : DocumentClassifier {
    override fun classify(documentId: String, text: String): ClassificationResult =
        ClassificationResult(
            classification = Classification.APPROVED,
            reason = "V0 deterministic approval",
        )
}
