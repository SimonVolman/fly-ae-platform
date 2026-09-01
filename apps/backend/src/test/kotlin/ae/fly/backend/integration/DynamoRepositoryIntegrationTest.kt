package ae.fly.backend.integration

import ae.fly.backend.config.DynamoDbProperties
import ae.fly.backend.config.PersistenceProperties
import ae.fly.backend.config.PersistenceType
import ae.fly.backend.domain.Category
import ae.fly.backend.domain.Document
import ae.fly.backend.domain.DocumentStatus
import ae.fly.backend.domain.GuestSession
import ae.fly.backend.domain.OtpCode
import ae.fly.backend.domain.ShareToken
import ae.fly.backend.domain.TermsAcceptance
import ae.fly.backend.domain.TelegramLoginRequest
import ae.fly.backend.domain.User
import ae.fly.backend.persistence.dynamodb.DynamoCategoryRepository
import ae.fly.backend.persistence.dynamodb.DynamoDbConfig
import ae.fly.backend.persistence.dynamodb.DynamoDocumentRepository
import ae.fly.backend.persistence.dynamodb.DynamoGuestSessionRepository
import ae.fly.backend.persistence.dynamodb.DynamoOtpCodeRepository
import ae.fly.backend.persistence.dynamodb.DynamoShareTokenRepository
import ae.fly.backend.persistence.dynamodb.DynamoTermsAcceptanceRepository
import ae.fly.backend.persistence.dynamodb.DynamoTelegramLoginRequestRepository
import ae.fly.backend.persistence.dynamodb.DynamoUserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.localstack.LocalStackContainer
import org.testcontainers.utility.DockerImageName
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.dynamodb.DynamoDbClient
import java.time.Instant
import java.util.UUID

@Testcontainers(disabledWithoutDocker = true)
class DynamoRepositoryIntegrationTest {
    private lateinit var client: DynamoDbClient
    private lateinit var properties: PersistenceProperties

    @BeforeEach
    fun createTable() {
        client = DynamoDbClient.builder()
            .endpointOverride(localstack.endpoint)
            .region(Region.of(localstack.region))
            .credentialsProvider(
                StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(localstack.accessKey, localstack.secretKey),
                ),
            )
            .build()
        val tableName = "fly-ae-test-${UUID.randomUUID()}"
        properties = PersistenceProperties(
            type = PersistenceType.DYNAMODB,
            dynamodb = DynamoDbProperties(
                endpoint = localstack.endpoint,
                region = localstack.region,
                tableName = tableName,
                accessKey = localstack.accessKey,
                secretKey = localstack.secretKey,
            ),
        )
        client.createTable(DynamoDbConfig().createTableRequest(tableName))
        client.waiter().waitUntilTableExists { it.tableName(tableName) }
    }

    @Test
    fun `dynamo adapters preserve the V0 repository contract`() {
        val users = DynamoUserRepository(client, properties)
        val guests = DynamoGuestSessionRepository(client, properties)
        val categories = DynamoCategoryRepository(client, properties)
        val documents = DynamoDocumentRepository(client, properties)
        val otpCodes = DynamoOtpCodeRepository(client, properties)
        val telegramLoginRequests = DynamoTelegramLoginRequestRepository(client, properties)
        val terms = DynamoTermsAcceptanceRepository(client, properties)
        val shares = DynamoShareTokenRepository(client, documents, properties)
        val now = Instant.parse("2026-08-02T12:00:00Z")

        val user = users.save(User(email = "pilot@fly.ae", createdAt = now, updatedAt = now))
        assertEquals(user.id, users.findByEmail("pilot@fly.ae")?.id)
        assertTrue(users.existsById(user.id))
        val telegramUser = users.save(
            User(
                telegramUserId = 991,
                telegramChatId = 42,
                telegramUsername = "test_pilot",
                createdAt = now,
                updatedAt = now,
            ),
        )
        assertEquals(telegramUser.id, users.findByTelegramUserId(991)?.id)

        val guest = guests.save(
            GuestSession(
                acceptedTermsVersion = "customer-v1",
                acceptedPrivacyVersion = "customer-v1",
                acceptedAt = now,
                expiresAt = now.plusSeconds(3600),
                createdAt = now,
            ),
        )
        assertTrue(guests.existsByIdAndExpiresAtAfter(guest.id, now))

        val category = categories.save(
            Category(code = "AIRCRAFT", name = "Aircraft", displayOrder = 10),
        )
        assertEquals(category.id, categories.findByIdAndActiveTrue(category.id)?.id)
        assertEquals(listOf("AIRCRAFT"), categories.findAllByActiveTrueOrderByDisplayOrderAsc().map { it.code })

        val userDocument = documents.save(
            Document(
                user = user,
                category = category,
                msn = "34567",
                originalFilename = "amm.pdf",
                objectKey = "users/${user.id}/amm.pdf",
                mimeType = "application/pdf",
                sizeBytes = 42,
                status = DocumentStatus.APPROVED,
                createdAt = now,
                updatedAt = now,
            ),
        )
        assertEquals(
            userDocument.id,
            documents.findByIdAndUserIdAndDeletedAtIsNull(userDocument.id, user.id)?.id,
        )
        assertEquals(
            listOf(userDocument.id),
            documents.findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.id).map { it.id },
        )

        val guestDocument = documents.save(
            Document(
                guestSession = guest,
                category = category,
                msn = "98765",
                originalFilename = "guest.pdf",
                objectKey = "guests/${guest.id}/guest.pdf",
                mimeType = "application/pdf",
                sizeBytes = 21,
                createdAt = now,
                updatedAt = now,
            ),
        )
        assertTrue(documents.existsByGuestSessionId(guest.id))
        assertEquals(
            guestDocument.id,
            documents.findByIdAndGuestSessionIdAndDeletedAtIsNull(guestDocument.id, guest.id)?.id,
        )
        val secondGuestDocument = documents.save(
            Document(
                guestSession = guest,
                category = category,
                msn = "98765",
                originalFilename = "inspection.mp4",
                objectKey = "guests/${guest.id}/inspection.mp4",
                mimeType = "video/mp4",
                sizeBytes = 42,
                createdAt = now,
                updatedAt = now,
            ),
        )
        assertEquals(
            secondGuestDocument.id,
            documents.findByIdAndGuestSessionIdAndDeletedAtIsNull(secondGuestDocument.id, guest.id)?.id,
        )

        val otp = otpCodes.save(
            OtpCode(
                email = requireNotNull(user.email),
                codeHash = "a".repeat(64),
                expiresAt = now.plusSeconds(600),
                createdAt = now,
            ),
        )
        assertEquals(
            otp.id,
            otpCodes.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(requireNotNull(user.email))?.id,
        )
        otp.consumedAt = now.plusSeconds(1)
        otpCodes.save(otp)
        assertNull(
            otpCodes.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(requireNotNull(user.email)),
        )

        val telegramRequest = telegramLoginRequests.save(
            TelegramLoginRequest(
                tokenHash = "c".repeat(64),
                codeHash = "d".repeat(64),
                telegramUserId = telegramUser.telegramUserId,
                telegramChatId = telegramUser.telegramChatId,
                expiresAt = now.plusSeconds(600),
                createdAt = now,
            ),
        )
        assertEquals(
            telegramRequest.id,
            telegramLoginRequests.findByTokenHashAndConsumedAtIsNull(telegramRequest.tokenHash)?.id,
        )
        assertEquals(telegramRequest.id, telegramLoginRequests.findById(telegramRequest.id)?.id)
        telegramRequest.consumedAt = now.plusSeconds(1)
        telegramLoginRequests.save(telegramRequest)
        assertNull(
            telegramLoginRequests.findByTokenHashAndConsumedAtIsNull(telegramRequest.tokenHash),
        )

        val acceptance = terms.save(
            TermsAcceptance(
                user = user,
                documentType = "TERMS",
                version = "customer-v1",
                acceptedAt = now,
            ),
        )
        assertNotNull(acceptance)
        assertTrue(
            terms.existsByUserIdAndDocumentTypeAndVersion(
                user.id,
                "TERMS",
                "customer-v1",
            ),
        )

        val share = shares.save(
            ShareToken(
                document = userDocument,
                tokenHash = "b".repeat(64),
                tokenPrefix = "prefix123456",
                tokenCiphertext = "ciphertext",
                createdAt = now,
            ),
        )
        assertEquals(share.id, shares.findByTokenHashAndRevokedAtIsNull(share.tokenHash)?.id)
        assertEquals(share.id, shares.findByDocumentIdAndRevokedAtIsNull(userDocument.id)?.id)
        share.revokedAt = now.plusSeconds(2)
        shares.save(share)
        assertNull(shares.findByTokenHashAndRevokedAtIsNull(share.tokenHash))
    }

    companion object {
        @Container
        @JvmStatic
        val localstack = LocalStackContainer(
            DockerImageName.parse("localstack/localstack:4.3.0"),
        ).withServices("dynamodb")
    }
}
