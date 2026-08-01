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
import java.util.Base64

@Service
class ShareTokenService(
    private val tokens: ShareTokenRepository,
    properties: SecurityProperties,
    private val clock: Clock,
) {
    private val random = SecureRandom()
    private val encoder = Base64.getUrlEncoder().withoutPadding()
    private val hash = SecureHash(properties.shareEncryptionSecret)
    private val cipher = TokenCipher(properties.shareEncryptionSecret)

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
        tokens.findByTokenHashAndRevokedAtIsNull(hash.hex(raw))
            ?.takeIf { it.document.status == DocumentStatus.APPROVED }
            ?: throw ApiProblem(HttpStatus.NOT_FOUND, "Share link not found.")

    fun revoke(document: Document) {
        tokens.findByDocumentIdAndRevokedAtIsNull(document.id)?.let {
            it.revokedAt = clock.instant()
            tokens.save(it)
        }
    }
}
