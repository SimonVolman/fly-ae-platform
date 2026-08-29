package ae.fly.backend.integration

import ae.fly.backend.config.PersistenceProperties
import ae.fly.backend.config.PersistenceType
import ae.fly.backend.auth.AuthenticatedGuest
import ae.fly.backend.auth.CreateGuestSessionRequest
import ae.fly.backend.auth.GuestSessionService
import ae.fly.backend.auth.GuestSessionTokenService
import ae.fly.backend.document.CreateDocumentRequest
import ae.fly.backend.document.DocumentService
import ae.fly.backend.repository.CategoryRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.localstack.LocalStackContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.utility.DockerImageName

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("v0-prod")
@Testcontainers(disabledWithoutDocker = true)
class V0ProdDynamoContextTest {
    @Autowired
    private lateinit var persistence: PersistenceProperties

    @Autowired
    private lateinit var categories: CategoryRepository

    @Autowired
    private lateinit var guestSessions: GuestSessionService

    @Autowired
    private lateinit var guestTokens: GuestSessionTokenService

    @Autowired
    private lateinit var documents: DocumentService

    @Test
    fun `v0 prod starts without PostgreSQL and seeds DynamoDB categories`() {
        assertEquals(PersistenceType.DYNAMODB, persistence.type)
        assertEquals(
            listOf("AIRCRAFT", "APU", "ENGINE", "LANDING_GEAR", "JUST_DOCUMENT"),
            categories.findAllByActiveTrueOrderByDisplayOrderAsc().map { it.code },
        )

        val guest = guestSessions.create(
            CreateGuestSessionRequest(
                acceptedLegal = true,
                termsVersion = "customer-v1",
                privacyVersion = "customer-v1",
            ),
        )
        val guestId = guestTokens.verify(guest.accessToken)?.guestSessionId
            ?: error("Guest token was not accepted")
        val category = categories.findAllByActiveTrueOrderByDisplayOrderAsc().first()
        val document = documents.create(
            AuthenticatedGuest(guestId),
            CreateDocumentRequest(
                categoryId = category.id,
                msn = "34567",
                filename = "v0-prod.pdf",
                mimeType = "application/pdf",
                sizeBytes = 42,
            ),
        )
        assertEquals("34567", document.msn)
    }

    companion object {
        @Container
        @JvmStatic
        val localstack = LocalStackContainer(
            DockerImageName.parse("localstack/localstack:4.3.0"),
        ).withServices("dynamodb")

        @DynamicPropertySource
        @JvmStatic
        fun dynamoProperties(registry: DynamicPropertyRegistry) {
            registry.add("fly.persistence.dynamodb.endpoint") {
                localstack.endpoint.toString()
            }
            registry.add("fly.persistence.dynamodb.region", localstack::getRegion)
            registry.add("fly.persistence.dynamodb.table-name") { "fly-ae-context-test" }
            registry.add("fly.persistence.dynamodb.create-table") { "true" }
            registry.add("fly.persistence.dynamodb.access-key", localstack::getAccessKey)
            registry.add("fly.persistence.dynamodb.secret-key", localstack::getSecretKey)
            registry.add("fly.security.session-secret") {
                "test-session-secret-with-at-least-32-characters"
            }
            registry.add("fly.security.otp-pepper") {
                "test-otp-pepper-with-at-least-32-characters"
            }
            registry.add("fly.security.share-encryption-secret") {
                "test-share-encryption-secret-at-least-32-characters"
            }
        }
    }
}
