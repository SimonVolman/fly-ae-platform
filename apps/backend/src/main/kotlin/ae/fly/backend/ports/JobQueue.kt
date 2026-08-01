package ae.fly.backend.ports

import java.util.UUID

interface JobQueue {
    fun enqueue(documentId: UUID)
}
