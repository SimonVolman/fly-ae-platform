package ae.fly.backend.integration

import org.flywaydb.core.Flyway
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.DriverManager

@Testcontainers(disabledWithoutDocker = true)
class FlywayPostgresIntegrationTest {
    @Test
    fun `migrations create the V0 schema and seed categories`() {
        val result = Flyway.configure()
            .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
            .load()
            .migrate()

        assertEquals("10", result.targetSchemaVersion)

        DriverManager.getConnection(
            postgres.jdbcUrl,
            postgres.username,
            postgres.password,
        ).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(
                    "select count(*) from information_schema.tables " +
                        "where table_schema = 'public' and table_name in " +
                        "('users', 'otp_codes', 'terms_acceptances', 'categories', " +
                        "'documents', 'processing_jobs', 'share_tokens', 'guest_sessions', " +
                        "'telegram_login_requests')",
                ).use { rows ->
                    rows.next()
                    assertEquals(9, rows.getInt(1))
                }

                statement.executeQuery("select count(*) from categories").use { rows ->
                    rows.next()
                    assertEquals(5, rows.getInt(1))
                }

                statement.executeQuery(
                    "select count(*) from pg_constraint " +
                        "where conname = 'documents_one_per_guest'",
                ).use { rows ->
                    rows.next()
                    assertEquals(0, rows.getInt(1))
                }
            }
        }
    }

    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:16.9-alpine")
            .withDatabaseName("flyae_test")
            .withUsername("flyae")
            .withPassword("flyae")
    }
}
