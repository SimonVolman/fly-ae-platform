package ae.fly.backend.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.net.URI

@ConfigurationProperties("fly.persistence")
data class PersistenceProperties(
    val type: PersistenceType = PersistenceType.POSTGRES,
    val dynamodb: DynamoDbProperties = DynamoDbProperties(),
)

enum class PersistenceType {
    POSTGRES,
    DYNAMODB,
}

data class DynamoDbProperties(
    val endpoint: URI? = null,
    val region: String = "eu-central-1",
    val tableName: String = "fly-ae-v0",
    val createTable: Boolean = false,
    val accessKey: String? = null,
    val secretKey: String? = null,
)
