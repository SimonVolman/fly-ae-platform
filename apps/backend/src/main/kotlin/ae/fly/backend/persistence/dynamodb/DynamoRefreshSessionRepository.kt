package ae.fly.backend.persistence.dynamodb

import ae.fly.backend.config.PersistenceProperties
import ae.fly.backend.domain.RefreshSession
import ae.fly.backend.repository.RefreshSessionRepository
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Repository
import software.amazon.awssdk.services.dynamodb.DynamoDbClient
import software.amazon.awssdk.services.dynamodb.model.Put
import software.amazon.awssdk.services.dynamodb.model.TransactWriteItem
import software.amazon.awssdk.services.dynamodb.model.TransactWriteItemsRequest
import software.amazon.awssdk.services.dynamodb.model.TransactionCanceledException
import software.amazon.awssdk.services.dynamodb.model.Update
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest
import java.time.Instant
import java.util.UUID

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoRefreshSessionRepository(
    private val client: DynamoDbClient,
    properties: PersistenceProperties,
) : RefreshSessionRepository {
    private val table = properties.dynamodb.tableName

    override fun findById(id: UUID): RefreshSession? =
        client.get(table, "REFRESH#$id", "SESSION")?.toRefreshSession()

    override fun findByTokenHash(tokenHash: String): RefreshSession? {
        val lookup = client.get(table, "REFRESH_TOKEN#$tokenHash", "SESSION") ?: return null
        return findById(lookup.uuid("sessionId"))
    }

    override fun save(session: RefreshSession): RefreshSession {
        client.put(table, session.toItem())
        client.put(table, session.toLookupItem())
        return session
    }

    override fun rotate(currentId: UUID, rotatedAt: Instant, successor: RefreshSession): Boolean = try {
        client.transactWriteItems(
            TransactWriteItemsRequest.builder()
                .transactItems(
                    TransactWriteItem.builder()
                        .update(
                            Update.builder()
                                .tableName(table)
                                .key(dynamoKey("REFRESH#$currentId", "SESSION"))
                                .updateExpression("SET #rotatedAt = :rotatedAt, #successorId = :successorId")
                                .conditionExpression(
                                    "attribute_not_exists(#rotatedAt) AND attribute_not_exists(#revokedAt)",
                                )
                                .expressionAttributeNames(
                                    mapOf(
                                        "#rotatedAt" to "rotatedAt",
                                        "#successorId" to "successorId",
                                        "#revokedAt" to "revokedAt",
                                    ),
                                )
                                .expressionAttributeValues(
                                    mapOf(
                                        ":rotatedAt" to text(rotatedAt.toString()),
                                        ":successorId" to text(successor.id.toString()),
                                    ),
                                )
                                .build(),
                        )
                        .build(),
                    TransactWriteItem.builder()
                        .put(
                            Put.builder()
                                .tableName(table)
                                .item(successor.toItem())
                                .conditionExpression("attribute_not_exists(#pk)")
                                .expressionAttributeNames(mapOf("#pk" to DYNAMO_PK))
                                .build(),
                        )
                        .build(),
                    TransactWriteItem.builder()
                        .put(
                            Put.builder()
                                .tableName(table)
                                .item(successor.toLookupItem())
                                .conditionExpression("attribute_not_exists(#pk)")
                                .expressionAttributeNames(mapOf("#pk" to DYNAMO_PK))
                                .build(),
                        )
                        .build(),
                )
                .build(),
        )
        true
    } catch (_: TransactionCanceledException) {
        false
    }

    override fun revokeFamily(familyId: UUID, revokedAt: Instant) {
        client.queryAll(table, "REFRESH_FAMILY#$familyId", DYNAMO_GSI1).forEach { item ->
            client.updateItem(
                UpdateItemRequest.builder()
                    .tableName(table)
                    .key(dynamoKey(item.string(DYNAMO_PK), item.string(DYNAMO_SK)))
                    .updateExpression("SET #revokedAt = :revokedAt")
                    .expressionAttributeNames(mapOf("#revokedAt" to "revokedAt"))
                    .expressionAttributeValues(mapOf(":revokedAt" to text(revokedAt.toString())))
                    .build(),
            )
        }
    }

    private fun RefreshSession.toItem(): DynamoItem = buildMap {
        put(DYNAMO_PK, text("REFRESH#$id"))
        put(DYNAMO_SK, text("SESSION"))
        put(DYNAMO_GSI1_PK, text("REFRESH_FAMILY#$familyId"))
        put(DYNAMO_GSI1_SK, text("SESSION#${sortableInstant(createdAt)}#$id"))
        put("type", text("REFRESH_SESSION"))
        put("id", text(id.toString()))
        put("userId", text(userId.toString()))
        put("familyId", text(familyId.toString()))
        put("tokenHash", text(tokenHash))
        put("expiresAt", text(expiresAt.toString()))
        put("createdAt", text(createdAt.toString()))
        putOptional("rotatedAt", rotatedAt?.toString())
        putOptional("successorId", successorId?.toString())
        putOptional("revokedAt", revokedAt?.toString())
        put(DYNAMO_TTL, number(expiresAt.epochSecond))
    }

    private fun RefreshSession.toLookupItem(): DynamoItem = mapOf(
        DYNAMO_PK to text("REFRESH_TOKEN#$tokenHash"),
        DYNAMO_SK to text("SESSION"),
        "type" to text("REFRESH_TOKEN"),
        "sessionId" to text(id.toString()),
        DYNAMO_TTL to number(expiresAt.epochSecond),
    )

    private fun DynamoItem.toRefreshSession() = RefreshSession(
        id = uuid("id"),
        userId = uuid("userId"),
        familyId = uuid("familyId"),
        tokenHash = string("tokenHash"),
        expiresAt = instant("expiresAt"),
        createdAt = instant("createdAt"),
        rotatedAt = optionalInstant("rotatedAt"),
        successorId = optionalString("successorId")?.let(UUID::fromString),
        revokedAt = optionalInstant("revokedAt"),
    )
}
