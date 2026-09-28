package ae.fly.backend.auth

import ae.fly.backend.config.SecurityProperties
import ae.fly.backend.domain.RefreshSession
import ae.fly.backend.domain.User
import ae.fly.backend.repository.RefreshSessionRepository
import ae.fly.backend.repository.UserRepository
import org.springframework.stereotype.Service
import java.security.SecureRandom
import java.time.Clock
import java.time.Instant
import java.util.Base64
import java.util.UUID

data class LoginSession(
    val response: SessionResponse,
    val refreshToken: String,
    val refreshExpiresAt: Instant,
)

data class RefreshedSession(
    val response: SessionResponse,
    /** Present only for the request which won the token rotation. */
    val replacementRefreshToken: String? = null,
    val refreshExpiresAt: Instant? = null,
)

@Service
class PersistentSessionService(
    private val refreshSessions: RefreshSessionRepository,
    private val users: UserRepository,
    private val accessTokens: SessionTokenService,
    properties: SecurityProperties,
    private val clock: Clock,
) {
    private val hash = SecureHash("${properties.sessionSecret}:refresh-session")
    private val refreshTtl = properties.refreshSessionTtl
    private val reuseGrace = properties.refreshReuseGrace
    private val random = SecureRandom()
    private val encoder = Base64.getUrlEncoder().withoutPadding()

    fun login(user: User): LoginSession {
        val now = clock.instant()
        val rawToken = newRawToken()
        val session = RefreshSession(
            userId = user.id,
            tokenHash = hash.hex(rawToken),
            expiresAt = now.plus(refreshTtl),
            createdAt = now,
        )
        refreshSessions.save(session)
        return LoginSession(sessionResponse(user), rawToken, session.expiresAt)
    }

    fun refresh(rawToken: String?): RefreshedSession? {
        val current = rawToken
            ?.takeIf { it.matches(REFRESH_TOKEN_PATTERN) }
            ?.let { refreshSessions.findByTokenHash(hash.hex(it)) }
            ?: return null
        val now = clock.instant()
        if (current.revokedAt != null || !current.expiresAt.isAfter(now)) return null
        val user = users.findById(current.userId) ?: return null

        if (current.rotatedAt != null) {
            return recoverConcurrentRefresh(current, user, now)
        }

        val nextRawToken = newRawToken()
        val successor = RefreshSession(
            userId = current.userId,
            familyId = current.familyId,
            tokenHash = hash.hex(nextRawToken),
            expiresAt = current.expiresAt,
            createdAt = now,
        )
        if (refreshSessions.rotate(current.id, now, successor)) {
            return RefreshedSession(sessionResponse(user), nextRawToken, successor.expiresAt)
        }

        // A second tab may have rotated the cookie between our read and CAS.
        val raced = refreshSessions.findById(current.id) ?: return null
        return if (raced.rotatedAt != null) {
            recoverConcurrentRefresh(raced, user, now)
        } else {
            null
        }
    }

    fun logout(rawToken: String?) {
        val session = rawToken
            ?.takeIf { it.matches(REFRESH_TOKEN_PATTERN) }
            ?.let { refreshSessions.findByTokenHash(hash.hex(it)) }
            ?: return
        refreshSessions.revokeFamily(session.familyId, clock.instant())
    }

    private fun recoverConcurrentRefresh(
        current: RefreshSession,
        user: User,
        now: Instant,
    ): RefreshedSession? {
        val successor = current.successorId?.let(refreshSessions::findById)
        if (
            current.rotatedAt?.plus(reuseGrace)?.isAfter(now) == true &&
            successor != null &&
            successor.familyId == current.familyId &&
            successor.revokedAt == null &&
            successor.expiresAt.isAfter(now)
        ) {
            // Do not overwrite the winning tab's Set-Cookie header.
            return RefreshedSession(sessionResponse(user))
        }

        // A stale credential outside the short concurrency window is token reuse.
        refreshSessions.revokeFamily(current.familyId, now)
        return null
    }

    private fun sessionResponse(user: User): SessionResponse {
        val (accessToken, expiresAt) = accessTokens.issue(user.id)
        return SessionResponse(
            accessToken = accessToken,
            expiresAt = expiresAt,
            user = SessionUser(
                id = user.id,
                email = user.email,
                telegramUsername = user.telegramUsername,
                displayName = user.email ?: user.telegramUsername ?: "fly.ae user",
                authenticationMethod = AuthenticationMethod.EMAIL,
            ),
        )
    }

    private fun newRawToken(): String = encoder.encodeToString(ByteArray(48).also(random::nextBytes))

    companion object {
        private val REFRESH_TOKEN_PATTERN = Regex("^[A-Za-z0-9_-]{48,128}$")
    }
}
