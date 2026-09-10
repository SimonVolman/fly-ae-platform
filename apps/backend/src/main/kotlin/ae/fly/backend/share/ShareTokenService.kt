package ae.fly.backend.share

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.auth.SecureHash
import ae.fly.backend.config.SecurityProperties
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
import ae.fly.backend.domain.ShareToken
import ae.fly.backend.repository.ShareTokenRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import java.security.SecureRandom
import java.time.Clock
import java.time.Instant
import java.util.Base64

@Service
class ShareTokenService(
    private val tokens: ShareTokenRepository,
    properties: SecurityProperties,
    private val clock: Clock,
) {
    data class TemporaryCode(
        val code: String,
        val expiresAt: Instant,
    )

    private val random = SecureRandom()
    private val encoder = Base64.getUrlEncoder().withoutPadding()
    private val hash = SecureHash(properties.shareEncryptionSecret)
    private val cipher = TokenCipher(properties.shareEncryptionSecret)
    private val shortShareEnabled = properties.shortShareEnabled
    private val shortShareTtl = properties.shortShareTtl

    fun create(document: Document): String {
        require(document.status == DocumentStatus.APPROVED) {
            "Share tokens can only be created for approved documents"
        }
        tokens.findByDocumentIdAndRevokedAtIsNull(document.id)?.let {
            return cipher.decrypt(it.tokenCiphertext)
        }

        val raw = ByteArray(32).also(random::nextBytes).let(encoder::encodeToString)
        tokens.save(
            ShareToken(
                document = document,
                tokenHash = hash.hex(raw),
                tokenPrefix = raw.take(12),
                tokenCiphertext = cipher.encrypt(raw),
                createdAt = clock.instant(),
            ),
        )
        return raw
    }

    fun rawFor(document: Document): String? =
        tokens.findByDocumentIdAndRevokedAtIsNull(document.id)
            ?.let { cipher.decrypt(it.tokenCiphertext) }

    fun resolve(raw: String): ShareToken =
        (tokens.findByTokenHashAndRevokedAtIsNull(hash.hex(raw))
            ?: resolveTemporaryCode(raw))
            ?.takeIf { it.document.status == DocumentStatus.APPROVED }
            ?: throw ApiProblem(HttpStatus.NOT_FOUND, "Share link not found.")

    fun createTemporaryCode(document: Document): TemporaryCode {
        if (!shortShareEnabled) {
            throw ApiProblem(HttpStatus.NOT_FOUND, "Temporary share codes are unavailable.")
        }
        require(document.status == DocumentStatus.APPROVED) {
            "Temporary share codes can only be created for approved documents"
        }
        val share = tokens.findByDocumentIdAndRevokedAtIsNull(document.id)
            ?: throw ApiProblem(HttpStatus.NOT_FOUND, "Share link not found.")
        val now = clock.instant()
        val activeCode = share.shortCodeCiphertext
        val activeCodeExpiresAt = share.shortCodeExpiresAt
        if (activeCode != null && activeCodeExpiresAt?.isAfter(now) == true) {
            return TemporaryCode(cipher.decrypt(activeCode), activeCodeExpiresAt)
        }
        val code = generateSequence(::randomTemporaryCode)
            .first { !tokens.shortCodeHashExists(hash.hex(it)) }
        val expiresAt = now.plus(shortShareTtl)
        share.shortCodeHash = hash.hex(code)
        share.shortCodeCiphertext = cipher.encrypt(code)
        share.shortCodeExpiresAt = expiresAt
        tokens.save(share)
        return TemporaryCode(code, expiresAt)
    }

    fun isTemporaryCode(raw: String): Boolean =
        shortShareEnabled && normalizeTemporaryCode(raw).matches(SHORT_CODE_PATTERN)

    private fun resolveTemporaryCode(raw: String): ShareToken? {
        if (!shortShareEnabled) return null
        val code = normalizeTemporaryCode(raw)
        if (!code.matches(SHORT_CODE_PATTERN)) return null
        return tokens.findByShortCodeHashAndRevokedAtIsNullAndShortCodeExpiresAtAfter(
            hash.hex(code),
            clock.instant(),
        )
    }

    private fun normalizeTemporaryCode(raw: String): String =
        raw.replace("-", "").trim().uppercase()

    private fun randomTemporaryCode(): String = buildString(SHORT_CODE_LENGTH) {
        repeat(SHORT_CODE_LENGTH) {
            append(SHORT_CODE_ALPHABET[random.nextInt(SHORT_CODE_ALPHABET.length)])
        }
    }

    fun revoke(document: Document) {
        tokens.findByDocumentIdAndRevokedAtIsNull(document.id)?.let {
            it.revokedAt = clock.instant()
            it.shortCodeHash = null
            it.shortCodeCiphertext = null
            it.shortCodeExpiresAt = null
            tokens.save(it)
        }
    }

    private companion object {
        const val SHORT_CODE_LENGTH = 8
        const val SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
        val SHORT_CODE_PATTERN = Regex("^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$")
    }
}
