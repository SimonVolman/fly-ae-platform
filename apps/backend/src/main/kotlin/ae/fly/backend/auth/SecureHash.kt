package ae.fly.backend.auth

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class SecureHash(secret: String) {
    private val key = SecretKeySpec(secret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256")

    fun digest(value: String): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(key)
            doFinal(value.toByteArray(StandardCharsets.UTF_8))
        }

    fun hex(value: String): String = digest(value).joinToString("") { "%02x".format(it) }

    fun matches(value: String, expectedHex: String): Boolean =
        MessageDigest.isEqual(
            hex(value).toByteArray(StandardCharsets.UTF_8),
            expectedHex.toByteArray(StandardCharsets.UTF_8),
        )
}
