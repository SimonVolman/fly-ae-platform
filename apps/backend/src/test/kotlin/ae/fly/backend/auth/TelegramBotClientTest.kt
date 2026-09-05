package ae.fly.backend.auth

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class TelegramBotClientTest {
    @Test
    fun `adds a prominent warning while the site is in maintenance mode`() {
        val message = withMaintenanceBanner("Original response", maintenanceMode = true)

        assertTrue(message.startsWith("🚧🚧🚧 FLY.AE MAINTENANCE 🚧🚧🚧"))
        assertTrue(message.contains("САЙТ ВРЕМЕННО НЕДОСТУПЕН"))
        assertTrue(message.endsWith("Original response"))
    }

    @Test
    fun `keeps Telegram responses unchanged in application mode`() {
        assertEquals(
            "Original response",
            withMaintenanceBanner("Original response", maintenanceMode = false),
        )
    }

    @Test
    fun `adds normalized environment header to admin notifications`() {
        assertEquals(
            "[DEV]\nOriginal response",
            withEnvironmentHeader("Original response", " dev "),
        )
        assertEquals(
            "[PROD]\nOriginal response",
            withEnvironmentHeader("Original response", "prod"),
        )
    }
}
