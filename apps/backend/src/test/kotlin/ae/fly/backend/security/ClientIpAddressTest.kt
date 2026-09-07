package ae.fly.backend.security

import com.amazonaws.serverless.proxy.RequestReader
import com.amazonaws.serverless.proxy.model.HttpApiV2HttpContext
import com.amazonaws.serverless.proxy.model.HttpApiV2ProxyRequestContext
import jakarta.servlet.http.HttpServletRequestWrapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockHttpServletRequest

class ClientIpAddressTest {
    @Test
    fun `gateway source IP overrides forwarding headers and servlet wrappers`() {
        val request = MockHttpServletRequest().apply {
            remoteAddr = "10.0.0.1"
            addHeader("X-Forwarded-For", "198.51.100.99")
            addHeader("Forwarded", "for=198.51.100.99")
            setAttribute(RequestReader.HTTP_API_CONTEXT_PROPERTY, HttpApiV2ProxyRequestContext().apply {
                http = HttpApiV2HttpContext().apply { sourceIp = "2001:db8::1234" }
            })
        }
        val wrapper = object : HttpServletRequestWrapper(request) {
            override fun getRemoteAddr() = "198.51.100.99"
        }
        assertEquals("2001:db8::1234", clientIpAddress(wrapper))
    }

    @Test
    fun `local fallback ignores spoofed forwarded remote address`() {
        val request = MockHttpServletRequest().apply { remoteAddr = "203.0.113.10" }
        val wrapper = object : HttpServletRequestWrapper(request) {
            override fun getRemoteAddr() = "198.51.100.99"
        }
        assertEquals("203.0.113.10", clientIpAddress(wrapper))
    }

    @Test
    fun `invalid addresses and hostnames are not accepted`() {
        listOf("", "example.com", "256.1.1.1", "1.2.3", "1.2.3.4, 5.6.7.8", "fe80::1%eth0", "2001:::1", "203.0.113.10\nIP: fake").forEach {
            assertNull(clientIpAddress(MockHttpServletRequest().apply { remoteAddr = it }), it)
        }
    }

    @Test
    fun `missing gateway IP does not fall back to servlet address`() {
        val request = MockHttpServletRequest().apply {
            remoteAddr = "203.0.113.10"
            setAttribute(RequestReader.HTTP_API_CONTEXT_PROPERTY, HttpApiV2ProxyRequestContext())
        }
        assertNull(clientIpAddress(request))
    }
}
