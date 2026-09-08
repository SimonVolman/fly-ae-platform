package ae.fly.backend.security

import com.amazonaws.serverless.proxy.RequestReader
import com.amazonaws.serverless.proxy.model.HttpApiV2ProxyRequestContext
import jakarta.servlet.ServletRequest
import jakarta.servlet.ServletRequestWrapper
import jakarta.servlet.http.HttpServletRequest
import java.net.InetAddress

/** Use API Gateway's trusted context, never a caller-supplied forwarding header. */
fun clientIpAddress(request: HttpServletRequest): String? {
    val gateway = request.getAttribute(RequestReader.HTTP_API_CONTEXT_PROPERTY)
    if (gateway is HttpApiV2ProxyRequestContext) return numericIpAddress(gateway.http?.sourceIp)

    // Spring's ForwardedHeaderFilter may wrap remoteAddr using untrusted headers.
    var original: ServletRequest = request
    while (original is ServletRequestWrapper) original = original.request
    return numericIpAddress(original.remoteAddr)
}

internal fun numericIpAddress(value: String?): String? {
    if (value.isNullOrBlank() || value.length > 45) return null
    if (':' in value) {
        if (!value.matches(Regex("[0-9a-fA-F:.]+"))) return null
        return try {
            // The numeric-only check above prevents DNS lookups and rejects zone identifiers.
            InetAddress.getByName(value)
            value
        } catch (_: IllegalArgumentException) {
            null
        } catch (_: java.net.UnknownHostException) {
            null
        }
    }
    val parts = value.split('.')
    return value.takeIf {
        parts.size == 4 && parts.all { part ->
            part.matches(Regex("[0-9]{1,3}")) && part.toInt() in 0..255
        }
    }
}
