package ae.fly.backend.processing

import org.springframework.context.annotation.Profile
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Component
@Profile("local", "test")
class LocalProcessingListener(
    private val processing: DocumentProcessingService,
) {
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun process(event: DocumentQueued) {
        processing.process(event.documentId)
    }
}
