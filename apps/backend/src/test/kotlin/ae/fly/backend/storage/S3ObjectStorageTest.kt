package ae.fly.backend.storage

import ae.fly.backend.config.StorageProperties
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import java.time.Duration

class S3ObjectStorageTest {
    @Test
    fun `arbitrary files download as attachments instead of rendering active content`() {
        S3Presigner.builder()
            .region(Region.EU_CENTRAL_1)
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("test", "test")))
            .build().use { presigner ->
                val storage = S3ObjectStorage(
                    mock(S3Client::class.java), presigner, StorageProperties(bucket = "test-documents"),
                )
                val query = storage.signDownload("documents/example.html", Duration.ofMinutes(15)).rawQuery
                assertTrue(query.contains("response-content-disposition=attachment"))
                assertTrue(query.contains("response-content-type=application%2Foctet-stream"))
            }
    }
}
