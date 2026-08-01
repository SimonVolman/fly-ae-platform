package ae.fly.backend.auth

import ae.fly.backend.config.SecurityProperties
import org.springframework.stereotype.Service
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Clock
import java.time.Instant
import java.util.Base64
import java.util.UUID

data class GuestSessionIdentity(
    val guestSessionId: UUID,
    val expiresAt: Instant,
)

@Service
class GuestSessionTokenService(
    properties: SecurityProperties,
    private val clock: Clock,
) {
    private val hash = SecureHash("${properties.sessionSecret}:guest-session")
    private val ttl = properties.guestSessionTtl
    private val random = SecureRandom()
    private val encoder = Base64.getUrlEncoder().withoutPadding()
    private val decoder = Base64.getUrlDecoder()

    fun issue(guestSessionId: UUID): Pair<String, Instant> {
        val expiresAt = clock.instant().plus(ttl)
        val nonce = ByteArray(24).also(random::nextBytes)
        val payload = "$guestSessionId|${expiresAt.epochSecond}|${encoder.encodeToString(nonce)}"
        val encodedPayload = encoder.encodeToString(payload.toByteArray(StandardCharsets.UTF_8))
        val signature = encoder.encodeToString(hash.digest(encodedPayload))
        return "gst_$encodedPayload.$signature" to expiresAt
    }

    fun verify(token: String): GuestSessionIdentity? {
        if (!token.startsWith("gst_")) return null
        val pieces = token.removePrefix("gst_").split('.')
        if (pieces.size != 2) return null

        val expected = hash.digest(pieces[0])
        val actual = runCatching { decoder.decode(pieces[1]) }.getOrNull() ?: return null
        if (!MessageDigest.isEqual(expected, actual)) return null

        val payload = runCatching {
            String(decoder.decode(pieces[0]), StandardCharsets.UTF_8)
        }.getOrNull() ?: return null
        val fields = payload.split('|')
        if (fields.size != 3) return null

        val guestSessionId = runCatching { UUID.fromString(fields[0]) }.getOrNull()
            ?: return null
        val expiresAt = runCatching { Instant.ofEpochSecond(fields[1].toLong()) }.getOrNull()
            ?: return null
        if (!expiresAt.isAfter(clock.instant())) return null

        return GuestSessionIdentity(guestSessionId, expiresAt)
    }
}
