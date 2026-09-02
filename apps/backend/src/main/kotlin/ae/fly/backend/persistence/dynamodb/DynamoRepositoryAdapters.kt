package ae.fly.backend.persistence.dynamodb

import ae.fly.backend.config.PersistenceProperties
import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
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
import org.springframework.stereotype.Repository
import software.amazon.awssdk.services.dynamodb.DynamoDbClient
import software.amazon.awssdk.services.dynamodb.model.Put
import software.amazon.awssdk.services.dynamodb.model.TransactWriteItem
import software.amazon.awssdk.services.dynamodb.model.TransactWriteItemsRequest
import java.time.Instant
import java.util.UUID

private const val PROFILE = "PROFILE"

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoUserRepository(
    private val client: DynamoDbClient,
    properties: PersistenceProperties,
) : UserRepository {
    private val table = properties.dynamodb.tableName

    override fun findById(id: UUID): User? =
        client.get(table, "USER#$id", PROFILE)?.toUser()

    override fun findRecent(limit: Int): List<User> =
        client.scanAll(
            tableName = table,
            filterExpression = "#type = :type",
            expressionAttributeNames = mapOf("#type" to "type"),
            expressionAttributeValues = mapOf(":type" to text("USER")),
        ).map { it.toUser() }
            .sortedByDescending(User::updatedAt)
            .take(limit)

    override fun existsById(id: UUID): Boolean = findById(id) != null

    override fun findByEmail(email: String): User? {
        val lookup = client.get(table, "EMAIL#${email.lowercase()}", "USER") ?: return null
        return findById(lookup.uuid("userId"))
    }

    override fun findByTelegramUserId(telegramUserId: Long): User? {
        val lookup = client.get(table, "TELEGRAM_USER#$telegramUserId", "USER") ?: return null
        return findById(lookup.uuid("userId"))
    }

    override fun save(user: User): User {
        val normalizedEmail = user.email?.trim()?.lowercase()
        val telegramUserId = user.telegramUserId
        require((normalizedEmail == null) xor (telegramUserId == null)) {
            "A user must have exactly one login identity"
        }
        val lookupPk = normalizedEmail?.let { "EMAIL#$it" }
            ?: "TELEGRAM_USER#$telegramUserId"
        val existingLookup = client.get(table, lookupPk, "USER")
        if (existingLookup != null && existingLookup.uuid("userId") != user.id) {
            error("A user already exists for this login identity")
        }

        val userItem = user.toDynamoItem(normalizedEmail)
        if (existingLookup != null) {
            client.put(table, userItem)
            return user
        }

        val lookupItem = mapOf(
            DYNAMO_PK to text(lookupPk),
            DYNAMO_SK to text("USER"),
            "type" to text(if (normalizedEmail != null) "USER_EMAIL" else "USER_TELEGRAM"),
            "userId" to text(user.id.toString()),
        )
        client.transactWriteItems(
            TransactWriteItemsRequest.builder()
                .transactItems(
                    transactPut(
                        table,
                        userItem,
                        "attribute_not_exists(#pk)",
                        mapOf("#pk" to DYNAMO_PK),
                    ),
                    transactPut(
                        table,
                        lookupItem,
                        "attribute_not_exists(#pk)",
                        mapOf("#pk" to DYNAMO_PK),
                    ),
                )
                .build(),
        )
        return user
    }

    private fun User.toDynamoItem(normalizedEmail: String?): DynamoItem = buildMap {
        put(DYNAMO_PK, text("USER#$id"))
        put(DYNAMO_SK, text(PROFILE))
        put("type", text("USER"))
        put("id", text(id.toString()))
        putOptional("email", normalizedEmail)
        telegramUserId?.let { put("telegramUserId", number(it)) }
        telegramChatId?.let { put("telegramChatId", number(it)) }
        putOptional("telegramUsername", telegramUsername)
        put("createdAt", text(createdAt.toString()))
        put("updatedAt", text(updatedAt.toString()))
    }

    private fun DynamoItem.toUser() = User(
        id = uuid("id"),
        email = optionalString("email"),
        telegramUserId = optionalLong("telegramUserId"),
        telegramChatId = optionalLong("telegramChatId"),
        telegramUsername = optionalString("telegramUsername"),
        createdAt = instant("createdAt"),
        updatedAt = instant("updatedAt"),
    )
}

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoGuestSessionRepository(
    private val client: DynamoDbClient,
    properties: PersistenceProperties,
) : GuestSessionRepository {
    private val table = properties.dynamodb.tableName

    override fun findById(id: UUID): GuestSession? =
        client.get(table, "GUEST#$id", "SESSION")?.toGuestSession()

    override fun existsByIdAndExpiresAtAfter(id: UUID, instant: Instant): Boolean =
        findById(id)?.expiresAt?.isAfter(instant) == true

    override fun save(guestSession: GuestSession): GuestSession {
        client.put(
            table,
            mapOf(
                DYNAMO_PK to text("GUEST#${guestSession.id}"),
                DYNAMO_SK to text("SESSION"),
                "type" to text("GUEST_SESSION"),
                "id" to text(guestSession.id.toString()),
                "acceptedTermsVersion" to text(guestSession.acceptedTermsVersion),
                "acceptedPrivacyVersion" to text(guestSession.acceptedPrivacyVersion),
                "acceptedAt" to text(guestSession.acceptedAt.toString()),
                "expiresAt" to text(guestSession.expiresAt.toString()),
                DYNAMO_TTL to number(guestSession.expiresAt.epochSecond),
                "createdAt" to text(guestSession.createdAt.toString()),
            ),
        )
        return guestSession
    }

    private fun DynamoItem.toGuestSession() = GuestSession(
        id = uuid("id"),
        acceptedTermsVersion = string("acceptedTermsVersion"),
        acceptedPrivacyVersion = string("acceptedPrivacyVersion"),
        acceptedAt = instant("acceptedAt"),
        expiresAt = instant("expiresAt"),
        createdAt = instant("createdAt"),
    )
}

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoCategoryRepository(
    private val client: DynamoDbClient,
    properties: PersistenceProperties,
) : CategoryRepository {
    private val table = properties.dynamodb.tableName

    override fun findAllByActiveTrueOrderByDisplayOrderAsc(): List<Category> =
        client.queryAll(table, "CATEGORY")
            .asSequence()
            .filter { it.string("type") == "CATEGORY" }
            .map { it.toCategory() }
            .filter(Category::active)
            .sortedBy(Category::displayOrder)
            .toList()

    override fun findByIdAndActiveTrue(id: UUID): Category? =
        client.get(table, "CATEGORY_ID#$id", PROFILE)
            ?.toCategory()
            ?.takeIf(Category::active)

    override fun save(category: Category): Category {
        val attributes = category.attributes()
        client.put(
            table,
            attributes + mapOf(
                DYNAMO_PK to text("CATEGORY"),
                DYNAMO_SK to text(
                    "ORDER#${category.displayOrder.toString().padStart(6, '0')}#${category.id}",
                ),
            ),
        )
        client.put(
            table,
            attributes + mapOf(
                DYNAMO_PK to text("CATEGORY_ID#${category.id}"),
                DYNAMO_SK to text(PROFILE),
            ),
        )
        return category
    }

    private fun Category.attributes(): DynamoItem = mapOf(
        "type" to text("CATEGORY"),
        "id" to text(id.toString()),
        "code" to text(code),
        "name" to text(name),
        "active" to bool(active),
        "displayOrder" to number(displayOrder),
    )

    private fun DynamoItem.toCategory() = Category(
        id = uuid("id"),
        code = string("code"),
        name = string("name"),
        active = boolean("active"),
        displayOrder = int("displayOrder"),
    )
}

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoDocumentRepository(
    private val client: DynamoDbClient,
    properties: PersistenceProperties,
) : DocumentRepository {
    private val table = properties.dynamodb.tableName

    override fun findById(id: UUID): Document? =
        client.get(table, "DOCUMENT#$id", "METADATA")?.toDocument()

    override fun findRecent(limit: Int): List<Document> =
        client.scanAll(
            tableName = table,
            filterExpression = "#type = :type",
            expressionAttributeNames = mapOf("#type" to "type"),
            expressionAttributeValues = mapOf(":type" to text("DOCUMENT")),
        ).map { it.toDocument() }
            .filter { it.deletedAt == null }
            .sortedByDescending(Document::createdAt)
            .take(limit)

    override fun findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId: UUID): List<Document> =
        client.queryAll(
            tableName = table,
            partitionValue = "OWNER#USER#$userId",
            indexName = DYNAMO_GSI1,
            scanForward = false,
        ).map { it.toDocument() }.filter { it.deletedAt == null }

    override fun findByIdAndUserIdAndDeletedAtIsNull(id: UUID, userId: UUID): Document? =
        findById(id)?.takeIf { it.user?.id == userId && it.deletedAt == null }

    override fun findByIdAndGuestSessionIdAndDeletedAtIsNull(
        id: UUID,
        guestSessionId: UUID,
    ): Document? = findById(id)?.takeIf {
        it.guestSession?.id == guestSessionId && it.deletedAt == null
    }

    override fun existsByGuestSessionId(guestSessionId: UUID): Boolean =
        client.queryAll(
            tableName = table,
            partitionValue = "OWNER#GUEST#$guestSessionId",
            indexName = DYNAMO_GSI1,
        ).isNotEmpty()

    override fun save(document: Document): Document {
        client.put(table, document.toDynamoItem())
        return document
    }

    private fun Document.toDynamoItem(): DynamoItem = buildMap {
        put(DYNAMO_PK, text("DOCUMENT#$id"))
        put(DYNAMO_SK, text("METADATA"))
        put("type", text("DOCUMENT"))
        put("id", text(id.toString()))
        user?.let {
            put("userId", text(it.id.toString()))
            put(DYNAMO_GSI1_PK, text("OWNER#USER#${it.id}"))
        }
        guestSession?.let {
            put("guestSessionId", text(it.id.toString()))
            put(DYNAMO_GSI1_PK, text("OWNER#GUEST#${it.id}"))
        }
        put(DYNAMO_GSI1_SK, text("DOCUMENT#${sortableInstant(createdAt)}#$id"))
        put("categoryId", text(category.id.toString()))
        put("categoryCode", text(category.code))
        put("categoryName", text(category.name))
        put("categoryActive", bool(category.active))
        put("categoryDisplayOrder", number(category.displayOrder))
        put("msn", text(msn))
        put("originalFilename", text(originalFilename))
        put("objectKey", text(objectKey))
        put("mimeType", text(mimeType))
        put("sizeBytes", number(sizeBytes))
        put("status", text(status.name))
        putOptional("multipartUploadId", multipartUploadId)
        putOptional("failureReason", failureReason)
        put("createdAt", text(createdAt.toString()))
        put("updatedAt", text(updatedAt.toString()))
        putOptional("deletedAt", deletedAt?.toString())
    }

    private fun DynamoItem.toDocument(): Document {
        val userId = optionalString("userId")?.let(UUID::fromString)
        val guestId = optionalString("guestSessionId")?.let(UUID::fromString)
        return Document(
            id = uuid("id"),
            user = userId?.let { User(id = it) },
            guestSession = guestId?.let { GuestSession(id = it) },
            category = Category(
                id = uuid("categoryId"),
                code = string("categoryCode"),
                name = string("categoryName"),
                active = boolean("categoryActive"),
                displayOrder = int("categoryDisplayOrder"),
            ),
            msn = string("msn"),
            originalFilename = string("originalFilename"),
            objectKey = string("objectKey"),
            mimeType = string("mimeType"),
            sizeBytes = long("sizeBytes"),
            status = DocumentStatus.valueOf(string("status")),
            multipartUploadId = optionalString("multipartUploadId"),
            failureReason = optionalString("failureReason"),
            createdAt = instant("createdAt"),
            updatedAt = instant("updatedAt"),
            deletedAt = optionalInstant("deletedAt"),
        )
    }
}

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoOtpCodeRepository(
    private val client: DynamoDbClient,
    properties: PersistenceProperties,
) : OtpCodeRepository {
    private val table = properties.dynamodb.tableName

    override fun findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(email: String): OtpCode? =
        findAllByEmailAndConsumedAtIsNull(email).maxByOrNull(OtpCode::createdAt)

    override fun findAllByEmailAndConsumedAtIsNull(email: String): List<OtpCode> =
        client.queryAll(table, "OTP#${email.lowercase()}", scanForward = false)
            .map { it.toOtpCode() }
            .filter { it.consumedAt == null }

    override fun save(otpCode: OtpCode): OtpCode {
        client.put(
            table,
            buildMap {
                put(DYNAMO_PK, text("OTP#${otpCode.email.lowercase()}"))
                put(
                    DYNAMO_SK,
                    text("CODE#${sortableInstant(otpCode.createdAt)}#${otpCode.id}"),
                )
                put("type", text("OTP"))
                put("id", text(otpCode.id.toString()))
                put("email", text(otpCode.email.lowercase()))
                put("codeHash", text(otpCode.codeHash))
                put("expiresAt", text(otpCode.expiresAt.toString()))
                put(DYNAMO_TTL, number(otpCode.expiresAt.epochSecond))
                putOptional("consumedAt", otpCode.consumedAt?.toString())
                put("failedAttempts", number(otpCode.failedAttempts))
                put("createdAt", text(otpCode.createdAt.toString()))
            },
        )
        return otpCode
    }

    private fun DynamoItem.toOtpCode() = OtpCode(
        id = uuid("id"),
        email = string("email"),
        codeHash = string("codeHash"),
        expiresAt = instant("expiresAt"),
        consumedAt = optionalInstant("consumedAt"),
        failedAttempts = int("failedAttempts"),
        createdAt = instant("createdAt"),
    )
}

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoTelegramLoginRequestRepository(
    private val client: DynamoDbClient,
    properties: PersistenceProperties,
) : TelegramLoginRequestRepository {
    private val table = properties.dynamodb.tableName

    override fun findById(id: UUID): TelegramLoginRequest? =
        client.get(table, requestPk(id), "REQUEST")?.toTelegramLoginRequest()

    override fun findByTokenHashAndConsumedAtIsNull(tokenHash: String): TelegramLoginRequest? {
        val lookup = client.get(table, tokenPk(tokenHash), "REQUEST") ?: return null
        return findById(lookup.uuid("requestId"))
            ?.takeIf { it.consumedAt == null }
    }

    override fun save(request: TelegramLoginRequest): TelegramLoginRequest {
        client.put(
            table,
            buildMap {
                put(DYNAMO_PK, text(requestPk(request.id)))
                put(DYNAMO_SK, text("REQUEST"))
                put("type", text("TELEGRAM_LOGIN_REQUEST"))
                put("id", text(request.id.toString()))
                put("tokenHash", text(request.tokenHash))
                putOptional("codeHash", request.codeHash)
                request.telegramUserId?.let { put("telegramUserId", number(it)) }
                request.telegramChatId?.let { put("telegramChatId", number(it)) }
                putOptional("telegramUsername", request.telegramUsername)
                put("expiresAt", text(request.expiresAt.toString()))
                put(DYNAMO_TTL, number(request.expiresAt.epochSecond))
                putOptional("consumedAt", request.consumedAt?.toString())
                put("failedAttempts", number(request.failedAttempts))
                put("createdAt", text(request.createdAt.toString()))
            },
        )
        client.put(
            table,
            mapOf(
                DYNAMO_PK to text(tokenPk(request.tokenHash)),
                DYNAMO_SK to text("REQUEST"),
                "type" to text("TELEGRAM_LOGIN_TOKEN_LOOKUP"),
                "requestId" to text(request.id.toString()),
                DYNAMO_TTL to number(request.expiresAt.epochSecond),
            ),
        )
        return request
    }

    private fun DynamoItem.toTelegramLoginRequest() = TelegramLoginRequest(
        id = uuid("id"),
        tokenHash = string("tokenHash"),
        codeHash = optionalString("codeHash"),
        telegramUserId = optionalLong("telegramUserId"),
        telegramChatId = optionalLong("telegramChatId"),
        telegramUsername = optionalString("telegramUsername"),
        expiresAt = instant("expiresAt"),
        consumedAt = optionalInstant("consumedAt"),
        failedAttempts = int("failedAttempts"),
        createdAt = instant("createdAt"),
    )

    private fun requestPk(id: UUID) = "TELEGRAM_LOGIN#$id"
    private fun tokenPk(tokenHash: String) = "TELEGRAM_LOGIN_TOKEN#$tokenHash"
}

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoTermsAcceptanceRepository(
    private val client: DynamoDbClient,
    properties: PersistenceProperties,
) : TermsAcceptanceRepository {
    private val table = properties.dynamodb.tableName

    override fun existsByUserIdAndDocumentTypeAndVersion(
        userId: UUID,
        documentType: String,
        version: String,
    ): Boolean = client.get(table, "USER#$userId", termsKey(documentType, version)) != null

    override fun save(termsAcceptance: TermsAcceptance): TermsAcceptance {
        client.put(
            table,
            mapOf(
                DYNAMO_PK to text("USER#${termsAcceptance.user.id}"),
                DYNAMO_SK to text(termsKey(termsAcceptance.documentType, termsAcceptance.version)),
                "type" to text("TERMS_ACCEPTANCE"),
                "id" to text(termsAcceptance.id.toString()),
                "userId" to text(termsAcceptance.user.id.toString()),
                "documentType" to text(termsAcceptance.documentType),
                "version" to text(termsAcceptance.version),
                "acceptedAt" to text(termsAcceptance.acceptedAt.toString()),
            ),
        )
        return termsAcceptance
    }

    private fun termsKey(documentType: String, version: String) =
        "TERMS#${documentType.uppercase()}#$version"
}

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoProcessingJobRepository(
    private val client: DynamoDbClient,
    properties: PersistenceProperties,
) : ProcessingJobRepository {
    private val table = properties.dynamodb.tableName

    override fun save(processingJob: ProcessingJob): ProcessingJob {
        client.put(
            table,
            buildMap {
                put(DYNAMO_PK, text("DOCUMENT#${processingJob.document.id}"))
                put(
                    DYNAMO_SK,
                    text("JOB#${sortableInstant(processingJob.createdAt)}#${processingJob.id}"),
                )
                put("type", text("PROCESSING_JOB"))
                put("id", text(processingJob.id.toString()))
                put("documentId", text(processingJob.document.id.toString()))
                put("status", text(processingJob.status.name))
                put("attempt", number(processingJob.attempt))
                putOptional("errorCode", processingJob.errorCode)
                put("createdAt", text(processingJob.createdAt.toString()))
                putOptional("startedAt", processingJob.startedAt?.toString())
                putOptional("completedAt", processingJob.completedAt?.toString())
            },
        )
        return processingJob
    }
}

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoShareTokenRepository(
    private val client: DynamoDbClient,
    private val documents: DocumentRepository,
    properties: PersistenceProperties,
) : ShareTokenRepository {
    private val table = properties.dynamodb.tableName

    override fun findByTokenHashAndRevokedAtIsNull(tokenHash: String): ShareToken? =
        client.get(table, "SHARE_TOKEN#$tokenHash", "TOKEN")
            ?.toShareToken()
            ?.takeIf { it.revokedAt == null }

    override fun findByDocumentIdAndRevokedAtIsNull(documentId: UUID): ShareToken? {
        val lookup = client.get(table, "DOCUMENT#$documentId", "SHARE") ?: return null
        return findByTokenHashAndRevokedAtIsNull(lookup.string("tokenHash"))
    }

    override fun save(shareToken: ShareToken): ShareToken {
        val documentId = shareToken.document.id
        val lookupKey = dynamoKey("DOCUMENT#$documentId", "SHARE")
        val existingLookup = client.get(table, "DOCUMENT#$documentId", "SHARE")
        if (existingLookup != null && existingLookup.string("tokenHash") != shareToken.tokenHash) {
            error("A share token already exists for this document")
        }

        val tokenItem = buildMap {
            put(DYNAMO_PK, text("SHARE_TOKEN#${shareToken.tokenHash}"))
            put(DYNAMO_SK, text("TOKEN"))
            put("type", text("SHARE_TOKEN"))
            put("id", text(shareToken.id.toString()))
            put("documentId", text(documentId.toString()))
            put("tokenHash", text(shareToken.tokenHash))
            put("tokenPrefix", text(shareToken.tokenPrefix))
            put("tokenCiphertext", text(shareToken.tokenCiphertext))
            put("createdAt", text(shareToken.createdAt.toString()))
            putOptional("revokedAt", shareToken.revokedAt?.toString())
        }
        val lookupItem = lookupKey + mapOf(
            "type" to text("DOCUMENT_SHARE_LOOKUP"),
            "tokenHash" to text(shareToken.tokenHash),
        )
        val lookupCondition = if (existingLookup == null) "attribute_not_exists(#pk)" else null
        client.transactWriteItems(
            TransactWriteItemsRequest.builder()
                .transactItems(
                    transactPut(table, tokenItem),
                    transactPut(
                        table,
                        lookupItem,
                        lookupCondition,
                        lookupCondition?.let { mapOf("#pk" to DYNAMO_PK) } ?: emptyMap(),
                    ),
                )
                .build(),
        )
        return shareToken
    }

    private fun DynamoItem.toShareToken(): ShareToken? {
        val document = documents.findById(uuid("documentId")) ?: return null
        return ShareToken(
            id = uuid("id"),
            document = document,
            tokenHash = string("tokenHash"),
            tokenPrefix = string("tokenPrefix"),
            tokenCiphertext = string("tokenCiphertext"),
            createdAt = instant("createdAt"),
            revokedAt = optionalInstant("revokedAt"),
        )
    }
}

private fun transactPut(
    tableName: String,
    item: DynamoItem,
    conditionExpression: String? = null,
    expressionAttributeNames: Map<String, String> = emptyMap(),
): TransactWriteItem {
    val builder = Put.builder().tableName(tableName).item(item)
    conditionExpression?.let(builder::conditionExpression)
    if (expressionAttributeNames.isNotEmpty()) {
        builder.expressionAttributeNames(expressionAttributeNames)
    }
    return TransactWriteItem.builder().put(builder.build()).build()
}
