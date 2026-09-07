package ae.fly.backend.integration

import ae.fly.backend.config.PersistenceProperties
import ae.fly.backend.activity.DocumentActivityRecorder
import ae.fly.backend.domain.DocumentActivityType
import ae.fly.backend.repository.DocumentActivityRepository
import ae.fly.backend.support.assertDocumentActivityContract
import ae.fly.backend.config.PersistenceType
import ae.fly.backend.domain.User
import ae.fly.backend.repository.CategoryRepository
import ae.fly.backend.repository.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class PostgresPersistenceContextTest {
    @Autowired
    private lateinit var persistence: PersistenceProperties

    @Autowired
    private lateinit var categories: CategoryRepository

    @Autowired
    private lateinit var users: UserRepository

    @Autowired
    private lateinit var activities: DocumentActivityRepository

    @Autowired
    private lateinit var recorder: DocumentActivityRecorder

    @Autowired
    private lateinit var transactions: PlatformTransactionManager

    @Test
    fun `document activities persist users guests IPs and chronological history`() {
        assertDocumentActivityContract(activities)
    }

    @Test
    fun `failed activity write does not roll back the outer transaction`() {
        val user = User(email = "audit-isolation-${UUID.randomUUID()}@example.com")
        TransactionTemplate(transactions).executeWithoutResult {
            users.save(user)
            recorder.record(UUID.randomUUID(), DocumentActivityType.SHARE_ACCESSED, null, "x".repeat(46))
        }
        assertEquals(user.id, users.findById(user.id)?.id)
    }

    @Test
    fun `local persistence starts with PostgreSQL adapters`() {
        assertEquals(PersistenceType.POSTGRES, persistence.type)
        assertEquals(5, categories.findAllByActiveTrueOrderByDisplayOrderAsc().size)

        val user = users.save(User(email = "postgres-adapter@fly.ae"))
        assertEquals(user.id, users.findByEmail(requireNotNull(user.email))?.id)
    }

    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:16.9-alpine")
            .withDatabaseName("flyae_adapter_test")
            .withUsername("flyae")
            .withPassword("flyae")

        @DynamicPropertySource
        @JvmStatic
        fun postgresProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
        }
    }
}
