package ae.fly.backend.persistence.dynamodb

import software.amazon.awssdk.services.dynamodb.DynamoDbClient
import software.amazon.awssdk.services.dynamodb.model.AttributeValue
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest
import software.amazon.awssdk.services.dynamodb.model.QueryRequest
import java.time.Instant
import java.util.UUID

internal typealias DynamoItem = Map<String, AttributeValue>

internal fun text(value: String): AttributeValue = AttributeValue.builder().s(value).build()
internal fun number(value: Number): AttributeValue = AttributeValue.builder().n(value.toString()).build()
internal fun bool(value: Boolean): AttributeValue = AttributeValue.builder().bool(value).build()

internal fun dynamoKey(pk: String, sk: String): DynamoItem =
    mapOf(DYNAMO_PK to text(pk), DYNAMO_SK to text(sk))

internal fun DynamoItem.string(name: String): String =
    this[name]?.s() ?: error("DynamoDB item is missing '$name'")

internal fun DynamoItem.optionalString(name: String): String? {
    val value = this[name] ?: return null
    return value.takeUnless { it.nul() == true }?.s()
}

internal fun DynamoItem.uuid(name: String): UUID = UUID.fromString(string(name))
internal fun DynamoItem.instant(name: String): Instant = Instant.parse(string(name))
internal fun DynamoItem.optionalInstant(name: String): Instant? = optionalString(name)?.let(Instant::parse)
internal fun DynamoItem.long(name: String): Long = this[name]?.n()?.toLong()
    ?: error("DynamoDB item is missing '$name'")

internal fun DynamoItem.optionalLong(name: String): Long? = this[name]?.n()?.toLong()

internal fun DynamoItem.int(name: String): Int = this[name]?.n()?.toInt()
    ?: error("DynamoDB item is missing '$name'")

internal fun DynamoItem.boolean(name: String): Boolean = this[name]?.bool()
    ?: error("DynamoDB item is missing '$name'")

internal fun MutableMap<String, AttributeValue>.putOptional(name: String, value: String?) {
    if (value != null) put(name, text(value))
}

internal fun DynamoDbClient.get(tableName: String, pk: String, sk: String): DynamoItem? {
    val response = getItem(
        GetItemRequest.builder()
            .tableName(tableName)
            .key(dynamoKey(pk, sk))
            .consistentRead(true)
            .build(),
    )
    return response.item().takeIf(Map<*, *>::isNotEmpty)
}

internal fun DynamoDbClient.put(tableName: String, item: DynamoItem) {
    putItem(PutItemRequest.builder().tableName(tableName).item(item).build())
}

internal fun DynamoDbClient.queryAll(
    tableName: String,
    partitionValue: String,
    indexName: String? = null,
    scanForward: Boolean = true,
): List<DynamoItem> {
    val partitionName = if (indexName == null) DYNAMO_PK else DYNAMO_GSI1_PK
    val results = mutableListOf<DynamoItem>()
    var cursor: DynamoItem? = null
    do {
        val builder = QueryRequest.builder()
            .tableName(tableName)
            .keyConditionExpression("#partition = :partition")
            .expressionAttributeNames(mapOf("#partition" to partitionName))
            .expressionAttributeValues(mapOf(":partition" to text(partitionValue)))
            .scanIndexForward(scanForward)
        indexName?.let(builder::indexName)
        cursor?.takeIf(Map<*, *>::isNotEmpty)?.let(builder::exclusiveStartKey)

        val response = query(builder.build())
        results += response.items()
        cursor = response.lastEvaluatedKey()
    } while (!cursor.isNullOrEmpty())
    return results
}

internal fun sortableInstant(instant: Instant): String =
    instant.toEpochMilli().toString().padStart(19, '0')
