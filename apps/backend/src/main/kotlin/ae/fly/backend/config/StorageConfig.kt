package ae.fly.backend.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import software.amazon.awssdk.services.s3.presigner.S3Presigner

@Configuration
class StorageConfig {
    @Bean
    fun s3Client(properties: StorageProperties): S3Client {
        val builder = S3Client.builder()
            .region(Region.of(properties.region))
            .credentialsProvider(credentials(properties))
            .serviceConfiguration(
                S3Configuration.builder()
                    .pathStyleAccessEnabled(properties.pathStyle)
                    .build(),
            )
        properties.endpoint?.let(builder::endpointOverride)
        return builder.build()
    }

    @Bean
    fun s3Presigner(properties: StorageProperties): S3Presigner {
        val builder = S3Presigner.builder()
            .region(Region.of(properties.region))
            .credentialsProvider(credentials(properties))
            .serviceConfiguration(
                S3Configuration.builder()
                    .pathStyleAccessEnabled(properties.pathStyle)
                    .build(),
            )
        properties.endpoint?.let(builder::endpointOverride)
        return builder.build()
    }

    private fun credentials(properties: StorageProperties): AwsCredentialsProvider {
        val accessKey = properties.accessKey?.takeIf(String::isNotBlank)
        val secretKey = properties.secretKey?.takeIf(String::isNotBlank)
        require((accessKey == null) == (secretKey == null)) {
            "S3 access key and secret key must either both be set or both be omitted"
        }
        return if (accessKey != null && secretKey != null) {
            StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey))
        } else {
            DefaultCredentialsProvider.builder().build()
        }
    }
}
