package ae.fly.backend.share

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.config.SecurityProperties
import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
import ae.fly.backend.domain.ShareToken
import ae.fly.backend.repository.ShareTokenRepository
import ae.fly.backend.support.MutableClock
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import java.time.Duration
import java.time.Instant
import java.util.UUID

class ShareTokenServiceTest {
    private val clock = MutableClock(Instant.parse("2026-09-10T08:00:00Z"))
    private val repository = InMemoryShareTokenRepository()

    @Test
    fun `temporary code is human readable and expires after fifteen minutes`() {
        val document = approvedDocument()
        val share = ShareToken(
            document = document,
            tokenHash = "permanent-hash",
            tokenPrefix = "permanent",
            tokenCiphertext = "ciphertext",
            createdAt = clock.instant(),
        )
        repository.current = share
        val service = service(enabled = true)

        val temporary = service.createTemporaryCode(document)

        assertEquals(8, temporary.code.length)
        assertEquals(true, temporary.code.matches(Regex("^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$")))
        assertEquals(clock.instant().plus(Duration.ofMinutes(15)), temporary.expiresAt)
        val formatted = temporary.code.chunked(4).joinToString("-")
        assertSame(share, service.resolve(formatted.lowercase()))

        clock.advance(Duration.ofMinutes(15))
        val expired = assertThrows(ApiProblem::class.java) { service.resolve(formatted) }
        assertEquals(HttpStatus.NOT_FOUND, expired.status)
    }

    @Test
    fun `temporary codes stay disabled when the environment flag is off`() {
        val error = assertThrows(ApiProblem::class.java) {
            service(enabled = false).createTemporaryCode(approvedDocument())
        }

        assertEquals(HttpStatus.NOT_FOUND, error.status)
    }

    private fun service(enabled: Boolean) = ShareTokenService(
        tokens = repository,
        properties = SecurityProperties(
            sessionSecret = "test-session-secret-that-is-long-enough",
            otpPepper = "test-otp-pepper-that-is-long-enough",
            shareEncryptionSecret = "test-share-secret-that-is-long-enough",
            shortShareEnabled = enabled,
        ),
        clock = clock,
    )

    private fun approvedDocument() = Document(
        id = UUID.randomUUID(),
        category = Category(name = "Engine"),
        originalFilename = "engine.pdf",
        objectKey = "documents/engine.pdf",
        mimeType = "application/pdf",
        sizeBytes = 2_048,
        status = DocumentStatus.APPROVED,
    )

    private class InMemoryShareTokenRepository : ShareTokenRepository {
        var current: ShareToken? = null

        override fun findByTokenHashAndRevokedAtIsNull(tokenHash: String): ShareToken? = null

        override fun findByDocumentIdAndRevokedAtIsNull(documentId: UUID): ShareToken? =
            current?.takeIf { it.document.id == documentId && it.revokedAt == null }

        override fun findByShortCodeHashAndRevokedAtIsNullAndShortCodeExpiresAtAfter(
            shortCodeHash: String,
            instant: Instant,
        ): ShareToken? = current?.takeIf {
            it.shortCodeHash == shortCodeHash &&
                it.revokedAt == null &&
                it.shortCodeExpiresAt?.isAfter(instant) == true
        }

        override fun shortCodeHashExists(shortCodeHash: String): Boolean =
            current?.shortCodeHash == shortCodeHash

        override fun save(shareToken: ShareToken): ShareToken {
            current = shareToken
            return shareToken
        }
    }
}
