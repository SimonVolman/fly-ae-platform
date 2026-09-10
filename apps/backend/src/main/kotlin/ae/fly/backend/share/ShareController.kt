package ae.fly.backend.share

import ae.fly.backend.activity.DocumentActivityRecorder
import ae.fly.backend.auth.FlyPrincipal
import ae.fly.backend.config.StorageProperties
import ae.fly.backend.domain.DocumentActivityType
import ae.fly.backend.ports.ObjectStorage
import ae.fly.backend.security.RateLimiter
import ae.fly.backend.security.clientIpAddress
import jakarta.servlet.http.HttpServletRequest
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

data class SharedDocumentResponse(
    val category: String,
    val msn: String,
    val filename: String,
    val sizeBytes: Long,
    val downloadUrl: String,
)

@RestController
@RequestMapping("/api/v1/shares")
class ShareController(
    private val shareTokens: ShareTokenService,
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
    private val rateLimiter: RateLimiter,
    private val accessNotifier: ShareAccessNotifier,
    private val activities: DocumentActivityRecorder,
) {
    @GetMapping("/{token}")
    fun resolve(
        @PathVariable token: String,
        request: HttpServletRequest,
        authentication: Authentication? = null,
    ): SharedDocumentResponse {
        val ipAddress = clientIpAddress(request)
        val temporaryCode = shareTokens.isTemporaryCode(token)
        rateLimiter.check(
            if (temporaryCode) "temporary-share:${ipAddress ?: "unknown"}" else "share:${ipAddress ?: "unknown"}",
            if (temporaryCode) 10 else 60,
            Duration.ofMinutes(1),
        )
        val share = shareTokens.resolve(token)
        val document = share.document
        val download = storage.signDownload(
            document.objectKey,
            storageProperties.downloadSignatureTtl,
        )
        val visitor = authentication?.takeIf { it.isAuthenticated }?.principal as? FlyPrincipal
        activities.record(document.id, DocumentActivityType.SHARE_ACCESSED, visitor, ipAddress)
        accessNotifier.accessed(document, visitor, ipAddress)
        return SharedDocumentResponse(
            category = document.category.name,
            msn = document.msn,
            filename = document.originalFilename,
            sizeBytes = document.sizeBytes,
            downloadUrl = download.toString(),
        )
    }
}
