package ae.fly.backend.activity

import ae.fly.backend.auth.AuthenticatedGuest
import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.auth.FlyPrincipal
import ae.fly.backend.domain.DocumentActivity
import ae.fly.backend.domain.DocumentActivityType
import ae.fly.backend.repository.DocumentActivityRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.time.Clock
import java.util.UUID

@Component
class DocumentActivityRecorder(
    private val activities: DocumentActivityRepository,
    private val clock: Clock,
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    fun record(documentId: UUID, type: DocumentActivityType, actor: FlyPrincipal?, ipAddress: String?) {
        try {
            activities.save(
                DocumentActivity(
                    documentId = documentId,
                    eventType = type,
                    occurredAt = clock.instant(),
                    ipAddress = ipAddress,
                    actorUserId = (actor as? AuthenticatedUser)?.id,
                    guestSessionId = (actor as? AuthenticatedGuest)?.id,
                ),
            )
        } catch (exception: RuntimeException) {
            // Activity logging must not interrupt an already stored file or a valid public link.
            logger.warn("Unable to record {} activity for document {}", type, documentId, exception)
        }
    }
}
