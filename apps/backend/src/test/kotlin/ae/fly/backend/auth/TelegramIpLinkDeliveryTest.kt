package ae.fly.backend.auth

import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.config.WebProperties
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mockStatic
import org.springframework.http.MediaType
import org.springframework.mock.http.client.MockClientHttpRequest
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.util.UUID

class TelegramIpLinkDeliveryTest {
    @Test
    fun `upload and share messages deliver clickable IPs without interpreting user text as markup`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        val properties = TelegramProperties(
            enabled = true, botToken = "test-token", botUsername = "FlyAeOtpBot",
            webhookSecret = "test-webhook-secret", environment = "prod",
        )
        val mapper = JsonMapper.builder().build()
        mockStatic(RestClient::class.java).use { factory ->
            factory.`when`<RestClient.Builder> { RestClient.builder() }.thenReturn(builder)
            val client = HttpTelegramBotClient(properties, WebProperties(maintenanceMode = true))
            for (ip in listOf("203.0.113.10", "2001:4860:4860::8888", null)) {
                server.expect(requestTo("https://api.telegram.org/bottest-token/sendMessage"))
                    .andExpect { request ->
                        val body = mapper.readTree((request as MockClientHttpRequest).bodyAsString)
                        val text = body["text"].asText()
                        assertTrue(text.startsWith("🚧🚧🚧 FLY.AE MAINTENANCE"))
                        assertTrue(text.contains("[PROD]"))
                        assertTrue(text.contains("<report>&[file].pdf"))
                        assertFalse(body.has("parse_mode"))
                        assertTrue(body["link_preview_options"]["is_disabled"].asBoolean())
                        if (ip == null) {
                            assertFalse(body.has("entities"))
                        } else {
                            assertEquals(1, body["entities"].size())
                            val entity = body["entities"][0]
                            assertEquals("text_link", entity["type"].asText())
                            assertEquals("https://proxycheck.io/lookup/$ip", entity["url"].asText())
                            val offset = entity["offset"].asInt()
                            assertEquals(ip, text.substring(offset, offset + entity["length"].asInt()))
                        }
                    }.andRespond(withSuccess("{\"ok\":true}", MediaType.APPLICATION_JSON))
                if (ip == "203.0.113.10") {
                    client.sendUploadNotification(123, TelegramUploadNotification(
                        uploader = "🚀 pilot@example.com", filename = "<report>&[file].pdf",
                        sizeBytes = 42, documentId = UUID.randomUUID(), uploadedAt = Instant.now(), ipAddress = ip,
                    ))
                } else {
                    client.sendAdminMessage(123, "🔗 SHARE-ССЫЛКА ИСПОЛЬЗОВАНА\nIP: ${ip ?: "не определён"}\nФайл: <report>&[file].pdf")
                }
                server.verify()
                server.reset()
            }
        }
    }
}
