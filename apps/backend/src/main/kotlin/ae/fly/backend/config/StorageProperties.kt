package ae.fly.backend.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.net.URI
import java.time.Duration

@ConfigurationProperties("fly.storage")
data class StorageProperties(
    val endpoint: URI? = null,
    val region: String = "us-east-1",
    val bucket: String,
    val accessKey: String,
    val secretKey: String,
    val pathStyle: Boolean = false,
    val uploadSignatureTtl: Duration = Duration.ofHours(1),
    val downloadSignatureTtl: Duration = Duration.ofMinutes(15),
)
