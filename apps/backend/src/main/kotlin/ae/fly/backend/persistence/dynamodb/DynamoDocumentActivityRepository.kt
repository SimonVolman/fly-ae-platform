package ae.fly.backend.persistence.dynamodb

import ae.fly.backend.config.PersistenceProperties
import ae.fly.backend.domain.DocumentActivity
import ae.fly.backend.domain.DocumentActivityType
import ae.fly.backend.repository.DocumentActivityRepository
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Repository
import software.amazon.awssdk.services.dynamodb.DynamoDbClient
import software.amazon.awssdk.services.dynamodb.model.QueryRequest
import java.util.UUID

@Repository
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoDocumentActivityRepository(
    private val client: DynamoDbClient,
    properties: PersistenceProperties,
) : DocumentActivityRepository {
    private val table = properties.dynamodb.tableName

    override fun save(activity: DocumentActivity): DocumentActivity {
        client.put(table, buildMap {
            putAll(dynamoKey("DOCUMENT_ACTIVITY#${activity.documentId}", "EVENT#${sortableInstant(activity.occurredAt)}#${activity.id}"))
            put("type", text("DOCUMENT_ACTIVITY"))
            put("id", text(activity.id.toString()))
            put("documentId", text(activity.documentId.toString()))
            put("eventType", text(activity.eventType.name))
            put("occurredAt", text(activity.occurredAt.toString()))
            putOptional("ipAddress", activity.ipAddress)
            putOptional("actorUserId", activity.actorUserId?.toString())
            putOptional("guestSessionId", activity.guestSessionId?.toString())
        })
        return activity
    }

    override fun findRecentByDocumentId(documentId: UUID, limit: Int): List<DocumentActivity> {
        require(limit > 0)
        return client.query(
            QueryRequest.builder().tableName(table)
                .keyConditionExpression("#pk = :pk")
                .expressionAttributeNames(mapOf("#pk" to DYNAMO_PK))
                .expressionAttributeValues(mapOf(":pk" to text("DOCUMENT_ACTIVITY#$documentId")))
                .scanIndexForward(false).consistentRead(true).limit(limit).build(),
        ).items().map { item ->
            DocumentActivity(
                id = item.uuid("id"),
                documentId = item.uuid("documentId"),
                eventType = DocumentActivityType.valueOf(item.string("eventType")),
                occurredAt = item.instant("occurredAt"),
                ipAddress = item.optionalString("ipAddress"),
                actorUserId = item.optionalString("actorUserId")?.let(UUID::fromString),
                guestSessionId = item.optionalString("guestSessionId")?.let(UUID::fromString),
            )
        }
    }
}
