package ae.fly.backend.persistence.postgres

import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.GuestSession
import ae.fly.backend.domain.OtpCode
import ae.fly.backend.domain.ProcessingJob
import ae.fly.backend.domain.ShareToken
import ae.fly.backend.domain.TermsAcceptance
import ae.fly.backend.domain.TelegramLoginRequest
import ae.fly.backend.domain.User
import ae.fly.backend.repository.CategoryRepository
import ae.fly.backend.repository.DocumentRepository
import ae.fly.backend.repository.GuestSessionRepository
import ae.fly.backend.repository.OtpCodeRepository
import ae.fly.backend.repository.ProcessingJobRepository
import ae.fly.backend.repository.ShareTokenRepository
import ae.fly.backend.repository.TermsAcceptanceRepository
import ae.fly.backend.repository.TelegramLoginRequestRepository
import ae.fly.backend.repository.UserRepository
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Repository
import java.time.Instant
import java.util.UUID

private const val POSTGRES_PROPERTY = "fly.persistence.type"

interface JpaUserRepository : JpaRepository<User, UUID> {
    fun findAllByOrderByUpdatedAtDesc(pageable: Pageable): List<User>
    fun findByEmail(email: String): User?
    fun findByTelegramUserId(telegramUserId: Long): User?
}

interface JpaGuestSessionRepository : JpaRepository<GuestSession, UUID> {
    fun existsByIdAndExpiresAtAfter(id: UUID, instant: Instant): Boolean
}

interface JpaCategoryRepository : JpaRepository<Category, UUID> {
    fun findAllByActiveTrueOrderByDisplayOrderAsc(): List<Category>
    fun findByIdAndActiveTrue(id: UUID): Category?
}

interface JpaDocumentRepository : JpaRepository<Document, UUID> {
    fun findAllByDeletedAtIsNullOrderByCreatedAtDesc(pageable: Pageable): List<Document>
    fun findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId: UUID): List<Document>
    fun findByIdAndUserIdAndDeletedAtIsNull(id: UUID, userId: UUID): Document?
    fun findByIdAndGuestSessionIdAndDeletedAtIsNull(id: UUID, guestSessionId: UUID): Document?
    fun existsByGuestSessionId(guestSessionId: UUID): Boolean
}

interface JpaOtpCodeRepository : JpaRepository<OtpCode, UUID> {
    fun findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(email: String): OtpCode?
    fun findAllByEmailAndConsumedAtIsNull(email: String): List<OtpCode>
}

interface JpaTelegramLoginRequestRepository : JpaRepository<TelegramLoginRequest, UUID> {
    fun findByTokenHashAndConsumedAtIsNull(tokenHash: String): TelegramLoginRequest?
}

interface JpaTermsAcceptanceRepository : JpaRepository<TermsAcceptance, UUID> {
    fun existsByUserIdAndDocumentTypeAndVersion(
        userId: UUID,
        documentType: String,
        version: String,
    ): Boolean
}

interface JpaProcessingJobRepository : JpaRepository<ProcessingJob, UUID>

interface JpaShareTokenRepository : JpaRepository<ShareToken, UUID> {
    @EntityGraph(attributePaths = ["document", "document.category"])
    fun findByTokenHashAndRevokedAtIsNull(tokenHash: String): ShareToken?
    fun findByDocumentIdAndRevokedAtIsNull(documentId: UUID): ShareToken?
}

@Repository
@ConditionalOnProperty(name = [POSTGRES_PROPERTY], havingValue = "postgres", matchIfMissing = true)
class PostgresUserRepository(
    private val delegate: JpaUserRepository,
) : UserRepository {
    override fun findById(id: UUID): User? = delegate.findById(id).orElse(null)
    override fun findRecent(limit: Int): List<User> =
        delegate.findAllByOrderByUpdatedAtDesc(PageRequest.of(0, limit))
    override fun existsById(id: UUID): Boolean = delegate.existsById(id)
    override fun findByEmail(email: String): User? = delegate.findByEmail(email)
    override fun findByTelegramUserId(telegramUserId: Long): User? =
        delegate.findByTelegramUserId(telegramUserId)
    override fun save(user: User): User = delegate.save(user)
}

@Repository
@ConditionalOnProperty(name = [POSTGRES_PROPERTY], havingValue = "postgres", matchIfMissing = true)
class PostgresGuestSessionRepository(
    private val delegate: JpaGuestSessionRepository,
) : GuestSessionRepository {
    override fun findById(id: UUID): GuestSession? = delegate.findById(id).orElse(null)
    override fun existsByIdAndExpiresAtAfter(id: UUID, instant: Instant): Boolean =
        delegate.existsByIdAndExpiresAtAfter(id, instant)

    override fun save(guestSession: GuestSession): GuestSession = delegate.save(guestSession)
}

@Repository
@ConditionalOnProperty(name = [POSTGRES_PROPERTY], havingValue = "postgres", matchIfMissing = true)
class PostgresCategoryRepository(
    private val delegate: JpaCategoryRepository,
) : CategoryRepository {
    override fun findAllByActiveTrueOrderByDisplayOrderAsc(): List<Category> =
        delegate.findAllByActiveTrueOrderByDisplayOrderAsc()

    override fun findByIdAndActiveTrue(id: UUID): Category? = delegate.findByIdAndActiveTrue(id)
    override fun save(category: Category): Category = delegate.save(category)
}

@Repository
@ConditionalOnProperty(name = [POSTGRES_PROPERTY], havingValue = "postgres", matchIfMissing = true)
class PostgresDocumentRepository(
    private val delegate: JpaDocumentRepository,
) : DocumentRepository {
    override fun findById(id: UUID): Document? = delegate.findById(id).orElse(null)

    override fun findRecent(limit: Int): List<Document> =
        delegate.findAllByDeletedAtIsNullOrderByCreatedAtDesc(PageRequest.of(0, limit))

    override fun findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId: UUID): List<Document> =
        delegate.findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)

    override fun findByIdAndUserIdAndDeletedAtIsNull(id: UUID, userId: UUID): Document? =
        delegate.findByIdAndUserIdAndDeletedAtIsNull(id, userId)

    override fun findByIdAndGuestSessionIdAndDeletedAtIsNull(
        id: UUID,
        guestSessionId: UUID,
    ): Document? = delegate.findByIdAndGuestSessionIdAndDeletedAtIsNull(id, guestSessionId)

    override fun existsByGuestSessionId(guestSessionId: UUID): Boolean =
        delegate.existsByGuestSessionId(guestSessionId)

    override fun save(document: Document): Document = delegate.save(document)
}

@Repository
@ConditionalOnProperty(name = [POSTGRES_PROPERTY], havingValue = "postgres", matchIfMissing = true)
class PostgresOtpCodeRepository(
    private val delegate: JpaOtpCodeRepository,
) : OtpCodeRepository {
    override fun findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(email: String): OtpCode? =
        delegate.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(email)

    override fun findAllByEmailAndConsumedAtIsNull(email: String): List<OtpCode> =
        delegate.findAllByEmailAndConsumedAtIsNull(email)

    override fun save(otpCode: OtpCode): OtpCode = delegate.save(otpCode)
}

@Repository
@ConditionalOnProperty(name = [POSTGRES_PROPERTY], havingValue = "postgres", matchIfMissing = true)
class PostgresTelegramLoginRequestRepository(
    private val delegate: JpaTelegramLoginRequestRepository,
) : TelegramLoginRequestRepository {
    override fun findById(id: UUID): TelegramLoginRequest? = delegate.findById(id).orElse(null)

    override fun findByTokenHashAndConsumedAtIsNull(tokenHash: String): TelegramLoginRequest? =
        delegate.findByTokenHashAndConsumedAtIsNull(tokenHash)

    override fun save(request: TelegramLoginRequest): TelegramLoginRequest = delegate.save(request)
}

@Repository
@ConditionalOnProperty(name = [POSTGRES_PROPERTY], havingValue = "postgres", matchIfMissing = true)
class PostgresTermsAcceptanceRepository(
    private val delegate: JpaTermsAcceptanceRepository,
) : TermsAcceptanceRepository {
    override fun existsByUserIdAndDocumentTypeAndVersion(
        userId: UUID,
        documentType: String,
        version: String,
    ): Boolean = delegate.existsByUserIdAndDocumentTypeAndVersion(userId, documentType, version)

    override fun save(termsAcceptance: TermsAcceptance): TermsAcceptance = delegate.save(termsAcceptance)
}

@Repository
@ConditionalOnProperty(name = [POSTGRES_PROPERTY], havingValue = "postgres", matchIfMissing = true)
class PostgresProcessingJobRepository(
    private val delegate: JpaProcessingJobRepository,
) : ProcessingJobRepository {
    override fun save(processingJob: ProcessingJob): ProcessingJob = delegate.save(processingJob)
}

@Repository
@ConditionalOnProperty(name = [POSTGRES_PROPERTY], havingValue = "postgres", matchIfMissing = true)
class PostgresShareTokenRepository(
    private val delegate: JpaShareTokenRepository,
) : ShareTokenRepository {
    override fun findByTokenHashAndRevokedAtIsNull(tokenHash: String): ShareToken? =
        delegate.findByTokenHashAndRevokedAtIsNull(tokenHash)

    override fun findByDocumentIdAndRevokedAtIsNull(documentId: UUID): ShareToken? =
        delegate.findByDocumentIdAndRevokedAtIsNull(documentId)

    override fun save(shareToken: ShareToken): ShareToken = delegate.save(shareToken)
}
