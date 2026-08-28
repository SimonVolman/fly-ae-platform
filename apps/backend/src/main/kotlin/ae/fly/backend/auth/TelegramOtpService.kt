package ae.fly.backend.auth

import ae.fly.backend.api.ApiProblem
import ae.fly.backend.config.SecurityProperties
import ae.fly.backend.config.TelegramProperties
import ae.fly.backend.domain.TelegramLoginRequest
import ae.fly.backend.domain.TermsAcceptance
import ae.fly.backend.domain.User
import ae.fly.backend.repository.TelegramLoginRequestRepository
import ae.fly.backend.repository.TermsAcceptanceRepository
import ae.fly.backend.repository.UserRepository
import jakarta.validation.constraints.AssertTrue
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Clock
import java.time.Instant
import java.util.Base64
import java.util.UUID

@Service
class TelegramOtpService(
    private val loginRequests: TelegramLoginRequestRepository,
    private val users: UserRepository,
    private val termsAcceptances: TermsAcceptanceRepository,
    private val sessionTokens: SessionTokenService,
    private val botClient: TelegramBotClient,
    private val telegram: TelegramProperties,
    private val security: SecurityProperties,
    private val clock: Clock,
) {
    private val random = SecureRandom()
    private val hash = SecureHash(security.otpPepper)
    val isEnabled: Boolean
        get() = telegram.enabled

    @Transactional
    fun requestLogin(): TelegramLoginAccepted {
        requireEnabled()
        val now = clock.instant()
        val token = ByteArray(24).also(random::nextBytes).let {
            Base64.getUrlEncoder().withoutPadding().encodeToString(it)
        }
        val request = loginRequests.save(
            TelegramLoginRequest(
                tokenHash = startTokenHash(token),
                expiresAt = now.plus(security.otpTtl),
                createdAt = now,
            ),
        )
        return TelegramLoginAccepted(
            requestId = request.id,
            telegramStartUrl = "https://t.me/${telegram.botUsername}?start=$token",
            expiresAt = request.expiresAt,
        )
    }

    fun verifyWebhookSecret(candidate: String?) {
        requireEnabled(HttpStatus.NOT_FOUND)
        val expectedBytes = telegram.webhookSecret.toByteArray(StandardCharsets.UTF_8)
        val candidateBytes = candidate?.toByteArray(StandardCharsets.UTF_8) ?: byteArrayOf()
        if (!MessageDigest.isEqual(expectedBytes, candidateBytes)) {
            throw ApiProblem(HttpStatus.UNAUTHORIZED, "The Telegram webhook secret is invalid.")
        }
    }

    @Transactional
    fun handle(message: TelegramMessage) {
        if (message.chat.type != "private") return
        val command = START_COMMAND.matchEntire(message.text?.trim().orEmpty()) ?: return
        val token = command.groupValues.getOrNull(1).orEmpty()
        if (token.isBlank()) {
            botClient.sendInstructions(message.chat.id)
            return
        }

        val now = clock.instant()
        val pending = loginRequests.findByTokenHashAndConsumedAtIsNull(startTokenHash(token))
        val telegramUser = message.from
        if (
            pending == null ||
            !pending.isUsable(now, security.otpMaxAttempts) ||
            telegramUser == null ||
            telegramUser.id <= 0
        ) {
            botClient.sendInvalidLink(message.chat.id)
            return
        }

        val code = random.nextInt(1_000_000).toString().padStart(6, '0')
        pending.codeHash = hash.hex("telegram:${pending.id}:$code")
        pending.telegramUserId = telegramUser.id
        pending.telegramChatId = message.chat.id
        pending.telegramUsername = telegramUser.username?.take(64)
        pending.failedAttempts = 0
        loginRequests.save(pending)
        botClient.sendOtp(message.chat.id, code, security.otpTtl)
    }

    @Transactional
    fun verify(request: TelegramOtpVerification): SessionResponse {
        requireEnabled()
        val now = clock.instant()
        val pending = loginRequests.findById(request.requestId) ?: unauthorized()
        val codeHash = pending.codeHash
        val telegramUserId = pending.telegramUserId
        val telegramChatId = pending.telegramChatId
        if (
            !pending.isUsable(now, security.otpMaxAttempts) ||
            codeHash == null ||
            telegramUserId == null ||
            telegramChatId == null
        ) {
            unauthorized()
        }
        if (!hash.matches("telegram:${pending.id}:${request.code}", codeHash)) {
            pending.failedAttempts += 1
            loginRequests.save(pending)
            unauthorized()
        }

        pending.consumedAt = now
        loginRequests.save(pending)

        val user = users.findByTelegramUserId(telegramUserId)?.apply {
            this.telegramChatId = telegramChatId
            telegramUsername = pending.telegramUsername
            updatedAt = now
        } ?: User(
            telegramUserId = telegramUserId,
            telegramChatId = telegramChatId,
            telegramUsername = pending.telegramUsername,
            createdAt = now,
            updatedAt = now,
        )
        users.save(user)
        recordLegalAcceptance(user, "TERMS", request.termsVersion)
        recordLegalAcceptance(user, "PRIVACY", request.privacyVersion)

        val (token, expiresAt) = sessionTokens.issue(user.id)
        val username = user.telegramUsername
        return SessionResponse(
            accessToken = token,
            expiresAt = expiresAt,
            user = SessionUser(
                id = user.id,
                email = null,
                telegramUsername = username,
                displayName = username?.let { "@$it" } ?: "Telegram user",
                authenticationMethod = AuthenticationMethod.TELEGRAM,
            ),
        )
    }

    private fun recordLegalAcceptance(user: User, type: String, version: String) {
        if (!termsAcceptances.existsByUserIdAndDocumentTypeAndVersion(user.id, type, version)) {
            termsAcceptances.save(
                TermsAcceptance(
                    user = user,
                    documentType = type,
                    version = version,
                    acceptedAt = clock.instant(),
                ),
            )
        }
    }

    private fun startTokenHash(token: String): String = hash.hex("telegram-login:$token")

    private fun requireEnabled(status: HttpStatus = HttpStatus.SERVICE_UNAVAILABLE) {
        if (!telegram.enabled) {
            throw ApiProblem(status, "Telegram sign-in is not configured.")
        }
    }

    private fun unauthorized(): Nothing =
        throw ApiProblem(HttpStatus.UNAUTHORIZED, "The Telegram OTP is invalid or expired.")

    companion object {
        private val START_COMMAND = Regex(
            "^/start(?:@[A-Za-z0-9_]{5,32})?(?:\\s+([A-Za-z0-9_-]{1,64}))?$",
        )
    }
}

data class TelegramLoginAccepted(
    val requestId: UUID,
    val telegramStartUrl: String,
    val expiresAt: Instant,
)

data class TelegramOtpVerification(
    val requestId: UUID,

    @field:Pattern(regexp = "^[0-9]{6}$")
    val code: String,

    @field:AssertTrue(message = "Terms and Privacy must be accepted")
    val acceptedLegal: Boolean,

    @field:NotBlank
    @field:Size(max = 32)
    val termsVersion: String,

    @field:NotBlank
    @field:Size(max = 32)
    val privacyVersion: String,
)

data class TelegramUpdate(
    val message: TelegramMessage? = null,
)

data class TelegramMessage(
    val text: String? = null,
    val chat: TelegramChat = TelegramChat(),
    val from: TelegramUser? = null,
)

data class TelegramChat(
    val id: Long = 0,
    val type: String = "",
)

data class TelegramUser(
    val id: Long = 0,
    val username: String? = null,
)
