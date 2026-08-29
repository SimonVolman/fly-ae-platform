package ae.fly.backend.integration

import ae.fly.backend.config.PersistenceProperties
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
