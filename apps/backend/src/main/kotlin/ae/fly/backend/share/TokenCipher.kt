package ae.fly.backend.share

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class TokenCipher(secret: String) {
    private val random = SecureRandom()
    private val encoder = Base64.getUrlEncoder().withoutPadding()
    private val decoder = Base64.getUrlDecoder()
    private val key = SecretKeySpec(
        MessageDigest.getInstance("SHA-256")
            .digest(secret.toByteArray(StandardCharsets.UTF_8)),
        "AES",
    )

    fun encrypt(value: String): String {
        val iv = ByteArray(12).also(random::nextBytes)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
        val encrypted = cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
        return encoder.encodeToString(iv + encrypted)
    }

    fun decrypt(value: String): String {
        val bytes = decoder.decode(value)
        require(bytes.size > 28) { "Invalid encrypted share token" }
        val iv = bytes.copyOfRange(0, 12)
        val encrypted = bytes.copyOfRange(12, bytes.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
        return String(cipher.doFinal(encrypted), StandardCharsets.UTF_8)
    }
}
