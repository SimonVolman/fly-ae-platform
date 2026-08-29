package ae.fly.backend.persistence.dynamodb

import ae.fly.backend.config.PersistenceProperties
import ae.fly.backend.domain.Category
import ae.fly.backend.repository.CategoryRepository
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.dynamodb.DynamoDbClient
import software.amazon.awssdk.services.dynamodb.model.AttributeDefinition
import software.amazon.awssdk.services.dynamodb.model.BillingMode
import software.amazon.awssdk.services.dynamodb.model.CreateTableRequest
import software.amazon.awssdk.services.dynamodb.model.GlobalSecondaryIndex
import software.amazon.awssdk.services.dynamodb.model.KeySchemaElement
import software.amazon.awssdk.services.dynamodb.model.KeyType
import software.amazon.awssdk.services.dynamodb.model.Projection
import software.amazon.awssdk.services.dynamodb.model.ProjectionType
import software.amazon.awssdk.services.dynamodb.model.ResourceNotFoundException
import software.amazon.awssdk.services.dynamodb.model.ScalarAttributeType
import java.util.UUID

const val DYNAMO_PERSISTENCE_PROPERTY = "fly.persistence.type"
const val DYNAMO_PK = "pk"
const val DYNAMO_SK = "sk"
const val DYNAMO_GSI1 = "gsi1"
const val DYNAMO_GSI1_PK = "gsi1pk"
const val DYNAMO_GSI1_SK = "gsi1sk"
const val DYNAMO_TTL = "ttlEpochSeconds"

@Configuration
@ConditionalOnProperty(name = [DYNAMO_PERSISTENCE_PROPERTY], havingValue = "dynamodb")
class DynamoDbConfig {
    @Bean(destroyMethod = "close")
    fun dynamoDbClient(properties: PersistenceProperties): DynamoDbClient {
        val dynamo = properties.dynamodb
        val builder = DynamoDbClient.builder()
            .region(Region.of(dynamo.region))

        val accessKey = dynamo.accessKey?.takeIf(String::isNotBlank)
        val secretKey = dynamo.secretKey?.takeIf(String::isNotBlank)
        if ((accessKey == null) != (secretKey == null)) {
            error("DynamoDB access key and secret key must either both be set or both be omitted")
        }
        builder.credentialsProvider(
            if (accessKey != null && secretKey != null) {
                StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey))
            } else {
                DefaultCredentialsProvider.builder().build()
            },
        )
        dynamo.endpoint?.let(builder::endpointOverride)
        return builder.build()
    }

    @Bean
    fun dynamoTableInitializer(
        client: DynamoDbClient,
        properties: PersistenceProperties,
        categories: CategoryRepository,
    ) = ApplicationRunner {
        val dynamo = properties.dynamodb
        if (dynamo.createTable && !tableExists(client, dynamo.tableName)) {
            client.createTable(createTableRequest(dynamo.tableName))
            client.waiter().waitUntilTableExists { it.tableName(dynamo.tableName) }
        }

        seedCategories(categories)
    }

    private fun tableExists(client: DynamoDbClient, tableName: String): Boolean =
        try {
            client.describeTable { it.tableName(tableName) }
            true
        } catch (_: ResourceNotFoundException) {
            false
        }

    internal fun createTableRequest(tableName: String): CreateTableRequest =
        CreateTableRequest.builder()
            .tableName(tableName)
            .billingMode(BillingMode.PAY_PER_REQUEST)
            .attributeDefinitions(
                AttributeDefinition.builder()
                    .attributeName(DYNAMO_PK)
                    .attributeType(ScalarAttributeType.S)
                    .build(),
                AttributeDefinition.builder()
                    .attributeName(DYNAMO_SK)
                    .attributeType(ScalarAttributeType.S)
                    .build(),
                AttributeDefinition.builder()
                    .attributeName(DYNAMO_GSI1_PK)
                    .attributeType(ScalarAttributeType.S)
                    .build(),
                AttributeDefinition.builder()
                    .attributeName(DYNAMO_GSI1_SK)
                    .attributeType(ScalarAttributeType.S)
                    .build(),
            )
            .keySchema(
                KeySchemaElement.builder().attributeName(DYNAMO_PK).keyType(KeyType.HASH).build(),
                KeySchemaElement.builder().attributeName(DYNAMO_SK).keyType(KeyType.RANGE).build(),
            )
            .globalSecondaryIndexes(
                GlobalSecondaryIndex.builder()
                    .indexName(DYNAMO_GSI1)
                    .keySchema(
                        KeySchemaElement.builder()
                            .attributeName(DYNAMO_GSI1_PK)
                            .keyType(KeyType.HASH)
                            .build(),
                        KeySchemaElement.builder()
                            .attributeName(DYNAMO_GSI1_SK)
                            .keyType(KeyType.RANGE)
                            .build(),
                    )
                    .projection(
                        Projection.builder().projectionType(ProjectionType.ALL).build(),
                    )
                    .build(),
            )
            .build()

    private fun seedCategories(categories: CategoryRepository) {
        listOf(
            Category(
                id = UUID.fromString("7b42604e-d3f8-4bb5-9480-36c451c8f141"),
                code = "AIRCRAFT",
                name = "Aircraft",
                displayOrder = 10,
            ),
            Category(
                id = UUID.fromString("d78f3618-37b6-4959-9346-3e34ef42f4d2"),
                code = "APU",
                name = "APU",
                displayOrder = 20,
            ),
            Category(
                id = UUID.fromString("e7870801-60b0-47fb-baf2-86ce800ecb1f"),
                code = "ENGINE",
                name = "Engine",
                displayOrder = 30,
            ),
            Category(
                id = UUID.fromString("d5a0ada0-3c80-4ea0-8188-73c5d55a6d26"),
                code = "LANDING_GEAR",
                name = "Landing Gear",
                displayOrder = 40,
            ),
            Category(
                id = UUID.fromString("420c86a3-3ec4-4ea2-96f7-53f8a42ef679"),
                code = "JUST_DOCUMENT",
                name = "Just Document",
                displayOrder = 50,
            ),
        ).forEach(categories::save)
    }
}
