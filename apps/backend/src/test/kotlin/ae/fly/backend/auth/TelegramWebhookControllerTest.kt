package ae.fly.backend.auth

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.config.WebProperties
import ae.fly.backend.security.RateLimiter
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.time.Clock

class TelegramWebhookControllerTest {
    private val telegram = TelegramProperties(
        enabled = true,
        botToken = "test-token",
        botUsername = "FlyAeOtpBot",
        webhookSecret = "test_webhook_secret_123456789",
    )
    private val bot = mock(TelegramBotClient::class.java)
    private val admin = mock(TelegramAdminCommandService::class.java)
    private val limiter = mock(RateLimiter::class.java)
    private val controller = TelegramWebhookController(telegram, bot, admin, limiter)

    @Test
    fun `email is the only login channel even when the bot is enabled`() {
        val mvc = MockMvcBuilders.standaloneSetup(
            controller,
            OtpController(
                mock(OtpService::class.java),
                limiter,
                RefreshSessionCookie(WebProperties()),
                Clock.systemUTC(),
            ),
        ).build()

        mvc.perform(get("/api/v1/auth/otp/options"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.emailEnabled").value(true))
            .andExpect(jsonPath("$.telegramEnabled").value(false))
        mvc.perform(post("/api/v1/auth/telegram/request"))
            .andExpect(status().isNotFound)
        mvc.perform(post("/api/v1/auth/telegram/verify"))
            .andExpect(status().isNotFound)
        verifyNoInteractions(bot, admin)
    }

    @Test
    fun `rejects missing and invalid webhook secrets before processing commands`() {
        for (secret in listOf(null, "wrong-secret")) {
            assertThrows(ApiProblem::class.java) {
                controller.receiveUpdate(secret, update("/admin"))
            }
        }
        verifyNoInteractions(bot, admin, limiter)
    }

    @Test
    fun `disabled bot rejects webhook updates`() {
        val disabled = TelegramWebhookController(telegram.copy(enabled = false), bot, admin, limiter)
        assertThrows(ApiProblem::class.java) {
            disabled.receiveUpdate(telegram.webhookSecret, update("/admin"))
        }
        verifyNoInteractions(bot, admin, limiter)
    }

    @Test
    fun `keeps authenticated administrator commands working`() {
        val update = update("/admin")
        val message = requireNotNull(update.message)
        `when`(admin.handle(message)).thenReturn(true)

        assertEquals(200, controller.receiveUpdate(telegram.webhookSecret, update).statusCode.value())

        verify(admin).handle(message)
        verifyNoInteractions(bot)
    }

    @Test
    fun `old login deep links only receive email sign-in instructions`() {
        controller.receiveUpdate(telegram.webhookSecret, update("/start old-login-token"))

        verify(bot).sendInstructions(42)
    }

    @Test
    fun `does not respond to start commands in a group`() {
        val update = TelegramUpdate(TelegramMessage(text = "/start", chat = TelegramChat(42, "group")))
        controller.receiveUpdate(telegram.webhookSecret, update)
        verifyNoInteractions(bot)
    }

    private fun update(text: String) = TelegramUpdate(
        TelegramMessage(text = text, chat = TelegramChat(42, "private")),
    )
}
