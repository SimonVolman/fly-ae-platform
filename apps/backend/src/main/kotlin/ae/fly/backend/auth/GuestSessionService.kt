package ae.fly.backend.auth

import ae.fly.backend.config.DocumentProperties
import ae.fly.backend.domain.GuestSession
import ae.fly.backend.repository.GuestSessionRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.util.UUID

@Service
class GuestSessionService(
    private val guestSessions: GuestSessionRepository,
    private val tokens: GuestSessionTokenService,
    private val documentProperties: DocumentProperties,
    private val clock: Clock,
) {
    @Transactional
    fun create(request: CreateGuestSessionRequest): GuestSessionResponse {
        val now = clock.instant()
        val id = UUID.randomUUID()
        val (token, expiresAt) = tokens.issue(id)
        guestSessions.save(
            GuestSession(
                id = id,
                acceptedTermsVersion = request.termsVersion.trim(),
                acceptedPrivacyVersion = request.privacyVersion.trim(),
                acceptedAt = now,
                expiresAt = expiresAt,
                createdAt = now,
            ),
        )
        return GuestSessionResponse(token, expiresAt, documentProperties.guestMaxFileSizeBytes)
    }
}
