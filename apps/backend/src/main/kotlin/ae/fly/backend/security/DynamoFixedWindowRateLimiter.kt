package ae.fly.backend.security

import ae.fly.backend.config.PersistenceProperties
import ae.fly.backend.persistence.dynamodb.DYNAMO_PK
import ae.fly.backend.persistence.dynamodb.DYNAMO_SK
import ae.fly.backend.persistence.dynamodb.DYNAMO_TTL
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Service
import software.amazon.awssdk.services.dynamodb.DynamoDbClient
import software.amazon.awssdk.services.dynamodb.model.AttributeValue
import software.amazon.awssdk.services.dynamodb.model.ConditionalCheckFailedException
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Clock
import java.time.Duration

@Service
@Profile("v0-prod")
class DynamoFixedWindowRateLimiter(
    private val client: DynamoDbClient,
    private val properties: PersistenceProperties,
    private val clock: Clock,
) : RateLimiter {
    override fun check(key: String, limit: Int, duration: Duration) {
        require(limit > 0) { "Rate limit must be positive" }
        val durationSeconds = duration.seconds
        require(durationSeconds > 0) { "Rate limit duration must be positive" }

        val now = clock.instant().epochSecond
        val windowStart = now - (now % durationSeconds)
        val windowEnd = windowStart + durationSeconds
        val itemKey = mapOf(
            DYNAMO_PK to text("RATE_LIMIT#${sha256(key)}"),
            DYNAMO_SK to text("WINDOW#$windowStart"),
        )

        try {
            client.updateItem(
                UpdateItemRequest.builder()
                    .tableName(properties.dynamodb.tableName)
                    .key(itemKey)
                    .updateExpression(
                        "SET #ttl = :ttl, #startedAt = :startedAt ADD #requestCount :one",
                    )
                    .conditionExpression(
                        "attribute_not_exists(#requestCount) OR #requestCount < :limit",
                    )
                    .expressionAttributeNames(
                        mapOf(
                            "#ttl" to DYNAMO_TTL,
                            "#startedAt" to "windowStartedAtEpochSeconds",
                            "#requestCount" to "requestCount",
                        ),
                    )
                    .expressionAttributeValues(
                        mapOf(
                            ":ttl" to number(windowEnd + TTL_GRACE_SECONDS),
                            ":startedAt" to number(windowStart),
                            ":one" to number(1),
                            ":limit" to number(limit),
                        ),
                    )
                    .build(),
            )
        } catch (_: ConditionalCheckFailedException) {
            throw RateLimitExceeded((windowEnd - now).coerceAtLeast(1))
        }
    }

    private fun sha256(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(StandardCharsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    private fun text(value: String): AttributeValue =
        AttributeValue.builder().s(value).build()

    private fun number(value: Number): AttributeValue =
        AttributeValue.builder().n(value.toString()).build()

    private companion object {
        const val TTL_GRACE_SECONDS = 86_400L
    }
}
