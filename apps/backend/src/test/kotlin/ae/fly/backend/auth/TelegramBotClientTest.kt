package ae.fly.backend.auth

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class TelegramBotClientTest {
    @Test
    fun `links only IP text using UTF-16 offsets after environment and maintenance prefixes`() {
        for (maintenance in listOf(false, true)) {
            for (ip in listOf("203.0.113.10", "2001:4860:4860::8888")) {
                val text = withMaintenanceBanner(
                    withEnvironmentHeader("🔗 Ссылка использована\nПосетитель: 🚀 pilot@example.com\nIP: $ip\nФайл: $ip.pdf", "prod"),
                    maintenance,
                )
                val entity = ipAddressLinkEntities(text).single()
                assertEquals("text_link", entity["type"])
                assertEquals("https://proxycheck.io/lookup/$ip", entity["url"])
                assertEquals(text.indexOf("IP: ") + 4, entity["offset"])
                val offset = entity["offset"] as Int
                val length = entity["length"] as Int
                assertEquals(ip, text.substring(offset, offset + length))
            }
        }
    }

    @Test
    fun `unknown invalid and unrelated addresses do not become links`() {
        for (value in listOf("не определён", "", "999.1.1.1", "2001:::1", "example.com", "8.8.8.8/path", "8.8.8.8?email=private", "fe80::1%eth0")) {
            assertTrue(ipAddressLinkEntities("IP: $value\nФайл: report.pdf").isEmpty(), value)
        }
        assertTrue(ipAddressLinkEntities("Файл: 8.8.8.8.pdf\nПользователь: IP: 8.8.8.8").isEmpty())
    }

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
