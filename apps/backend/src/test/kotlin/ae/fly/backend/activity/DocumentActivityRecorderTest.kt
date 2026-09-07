package ae.fly.backend.activity

import ae.fly.backend.auth.AuthenticatedGuest
import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.domain.DocumentActivity
import ae.fly.backend.domain.DocumentActivityType
import ae.fly.backend.repository.DocumentActivityRepository
import ae.fly.backend.support.MutableClock
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.UUID

class DocumentActivityRecorderTest {
    private val saved = mutableListOf<DocumentActivity>()
    private val repository = object : DocumentActivityRepository {
        override fun save(activity: DocumentActivity) = activity.also { saved.add(it) }
        override fun findRecentByDocumentId(documentId: UUID, limit: Int) = saved.filter { it.documentId == documentId }.takeLast(limit)
    }
    private val now = Instant.parse("2026-09-07T12:00:00Z")
    private val recorder = DocumentActivityRecorder(repository, MutableClock(now))

    @Test
    fun `records actor type and IP independently of Telegram configuration`() {
        val documentId = UUID.randomUUID()
        val user = AuthenticatedUser(UUID.randomUUID())
        val guest = AuthenticatedGuest(UUID.randomUUID())
        recorder.record(documentId, DocumentActivityType.UPLOAD_COMPLETED, user, "203.0.113.10")
        recorder.record(documentId, DocumentActivityType.SHARE_ACCESSED, guest, "2001:db8::1")
        recorder.record(documentId, DocumentActivityType.SHARE_ACCESSED, null, null)

        assertEquals(3, saved.size)
        assertTrue(saved.all { it.documentId == documentId && it.occurredAt == now })
        assertEquals(DocumentActivityType.UPLOAD_COMPLETED, saved[0].eventType)
        assertEquals(user.id, saved[0].actorUserId)
        assertNull(saved[0].guestSessionId)
        assertEquals("203.0.113.10", saved[0].ipAddress)
        assertNull(saved[1].actorUserId)
        assertEquals(guest.id, saved[1].guestSessionId)
        assertEquals("2001:db8::1", saved[1].ipAddress)
        assertNull(saved[2].actorUserId)
        assertNull(saved[2].guestSessionId)
        assertNull(saved[2].ipAddress)
    }

    @Test
    fun `audit storage failure does not fail the request`() {
        val failing = object : DocumentActivityRepository by repository {
            override fun save(activity: DocumentActivity): DocumentActivity = error("simulated storage failure")
        }
        assertDoesNotThrow {
            DocumentActivityRecorder(failing, MutableClock(now))
                .record(UUID.randomUUID(), DocumentActivityType.SHARE_ACCESSED, null, "203.0.113.10")
        }
    }
}
