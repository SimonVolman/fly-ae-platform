package ae.fly.backend.share

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test

class TokenCipherTest {
    private val cipher = TokenCipher("test-share-secret-that-is-at-least-32-characters")

    @Test
    fun `encrypts share tokens with a random nonce and decrypts them`() {
        val token = "a-cryptographically-random-share-token"

        val first = cipher.encrypt(token)
        val second = cipher.encrypt(token)

        assertNotEquals(token, first)
        assertNotEquals(first, second)
        assertEquals(token, cipher.decrypt(first))
        assertEquals(token, cipher.decrypt(second))
    }
}
