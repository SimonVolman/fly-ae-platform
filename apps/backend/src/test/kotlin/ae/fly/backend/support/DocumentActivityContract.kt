package ae.fly.backend.support

import ae.fly.backend.domain.DocumentActivity
import ae.fly.backend.domain.DocumentActivityType
import ae.fly.backend.repository.DocumentActivityRepository
import org.junit.jupiter.api.Assertions.*
import java.time.Instant
import java.util.UUID

fun assertDocumentActivityContract(repository: DocumentActivityRepository) {
    val documentId = UUID.randomUUID()
    val now = Instant.parse("2026-09-07T12:00:00Z")
    val userId = UUID.randomUUID()
    val guestId = UUID.randomUUID()
    val upload = repository.save(DocumentActivity(
        documentId = documentId, eventType = DocumentActivityType.UPLOAD_COMPLETED,
        occurredAt = now, ipAddress = "203.0.113.10", actorUserId = userId,
    ))
    val guest = repository.save(DocumentActivity(
        documentId = documentId, eventType = DocumentActivityType.SHARE_ACCESSED,
        occurredAt = now.plusSeconds(1), ipAddress = "2001:db8::1", guestSessionId = guestId,
    ))
    val anonymous = repository.save(DocumentActivity(documentId = documentId, occurredAt = now.plusSeconds(2)))
    repository.save(DocumentActivity(documentId = UUID.randomUUID(), occurredAt = now.plusSeconds(3)))

    val events = repository.findRecentByDocumentId(documentId, 10)
    assertEquals(listOf(anonymous.id, guest.id, upload.id), events.map { it.id })
    assertTrue(events.all { it.documentId == documentId })
    assertNull(events[0].ipAddress)
    assertNull(events[0].actorUserId)
    assertNull(events[0].guestSessionId)
    assertEquals(guestId, events[1].guestSessionId)
    assertNull(events[1].actorUserId)
    assertEquals("2001:db8::1", events[1].ipAddress)
    assertEquals(DocumentActivityType.SHARE_ACCESSED, events[1].eventType)
    assertEquals(userId, events[2].actorUserId)
    assertNull(events[2].guestSessionId)
    assertEquals("203.0.113.10", events[2].ipAddress)
    assertEquals(DocumentActivityType.UPLOAD_COMPLETED, events[2].eventType)
    assertEquals(now, events[2].occurredAt)
    assertEquals(listOf(anonymous.id), repository.findRecentByDocumentId(documentId, 1).map { it.id })
}
