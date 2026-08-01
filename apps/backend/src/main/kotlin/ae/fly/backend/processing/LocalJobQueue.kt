package ae.fly.backend.processing

import ae.fly.backend.ports.JobQueue
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import java.util.UUID

data class DocumentQueued(
    val documentId: UUID,
)

@Component
@Profile("local", "test")
class LocalJobQueue(
    private val events: ApplicationEventPublisher,
) : JobQueue {
    override fun enqueue(documentId: UUID) {
        events.publishEvent(DocumentQueued(documentId))
    }
}
