package ae.fly.backend.auth

import ae.fly.backend.config.SecurityProperties
import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.domain.TelegramLoginRequest
import ae.fly.backend.domain.User
import ae.fly.backend.repository.TelegramLoginRequestRepository
import ae.fly.backend.repository.TermsAcceptanceRepository
import ae.fly.backend.repository.UserRepository
import ae.fly.backend.support.MutableClock
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.anyLong
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.time.Duration
import java.time.Instant
import java.util.UUID

class TelegramOtpServiceTest {
    private val loginRequests = mock(TelegramLoginRequestRepository::class.java)
    private val users = mock(UserRepository::class.java)
    private val terms = mock(TermsAcceptanceRepository::class.java)
    private val botClient = CapturingTelegramBotClient()
    private val clock = MutableClock(Instant.parse("2026-08-28T10:00:00Z"))
    private val security = SecurityProperties(
        sessionSecret = "test-session-secret-that-is-long-enough",
        otpPepper = "test-otp-pepper-that-is-long-enough",
        shareEncryptionSecret = "test-share-secret-that-is-long-enough",
        otpTtl = Duration.ofMinutes(10),
    )
    private val telegram = TelegramProperties(
        enabled = true,
        botToken = "123456789:test-bot-token",
        botUsername = "FlyAeOtpBot",
        webhookSecret = "test_webhook_secret_123456789",
    )
    private val sessionTokens = SessionTokenService(security, clock)
    private val service = TelegramOtpService(
        loginRequests,
        users,
        terms,
        sessionTokens,
        botClient,
        telegram,
        security,
        clock,
    )

    @Test
    fun `creates a Telegram identity and session after bot OTP verification`() {
        var pending: TelegramLoginRequest? = null
        var savedUser: User? = null
        `when`(
            loginRequests.save(any(TelegramLoginRequest::class.java) ?: TelegramLoginRequest()),
        ).thenAnswer {
            (it.arguments[0] as TelegramLoginRequest).also { value -> pending = value }
        }
        `when`(loginRequests.findByTokenHashAndConsumedAtIsNull(anyString()))
            .thenAnswer { pending }
        `when`(
            loginRequests.findById(any(UUID::class.java) ?: UUID.randomUUID()),
        ).thenAnswer { pending }
        `when`(users.findByTelegramUserId(anyLong())).thenReturn(null)
        `when`(users.save(any(User::class.java) ?: User())).thenAnswer {
            (it.arguments[0] as User).also { value -> savedUser = value }
        }
        `when`(
            terms.existsByUserIdAndDocumentTypeAndVersion(
                any(UUID::class.java) ?: UUID.randomUUID(),
                anyString(),
                anyString(),
            ),
        ).thenReturn(false)

        val accepted = service.requestLogin()
        val startToken = accepted.telegramStartUrl.substringAfter("?start=")

        assertEquals("https://t.me/FlyAeOtpBot?start=$startToken", accepted.telegramStartUrl)
        assertEquals(32, startToken.length)
        assertFalse(accepted.telegramStartUrl.contains(accepted.requestId.toString()))

        service.handle(
            TelegramMessage(
                text = "/start $startToken",
                chat = TelegramChat(id = 42, type = "private"),
                from = TelegramUser(id = 991, username = "test_pilot"),
            ),
        )

        assertEquals(42, botClient.otpChatId)
        assertEquals(6, botClient.code?.length)
        assertEquals(991, pending?.telegramUserId)
        assertNotNull(pending?.codeHash)
        assertNull(pending?.consumedAt)

        val response = service.verify(
            TelegramOtpVerification(
                requestId = accepted.requestId,
                code = requireNotNull(botClient.code),
                acceptedLegal = true,
                termsVersion = "customer-v1",
                privacyVersion = "customer-v1",
            ),
        )

        assertEquals(991, savedUser?.telegramUserId)
        assertEquals("test_pilot", savedUser?.telegramUsername)
        assertEquals(AuthenticationMethod.TELEGRAM, response.user.authenticationMethod)
        assertEquals("@test_pilot", response.user.displayName)
        assertTrue(sessionTokens.verify(response.accessToken) != null)
        assertNotNull(pending?.consumedAt)
    }

    @Test
    fun `rejects an invalid webhook secret`() {
        assertThrows(RuntimeException::class.java) {
            service.verifyWebhookSecret("wrong-secret")
        }
    }

    private class CapturingTelegramBotClient : TelegramBotClient {
        var otpChatId: Long? = null
        var code: String? = null

        override fun sendOtp(chatId: Long, code: String, ttl: Duration) {
            otpChatId = chatId
            this.code = code
        }

        override fun sendInvalidLink(chatId: Long) = Unit

        override fun sendInstructions(chatId: Long) = Unit

        override fun sendUploadNotification(
            chatId: Long,
            notification: TelegramUploadNotification,
        ) = Unit
    }
}
