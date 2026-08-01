package ae.fly.backend.processing

import ae.fly.backend.ports.JobQueue
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import java.util.UUID

@Component
@Profile("v0-prod")
class V0ProdJobQueue(
    private val processing: DocumentProcessingService,
) : JobQueue {
    override fun enqueue(documentId: UUID) {
        processing.process(documentId)
    }
}
