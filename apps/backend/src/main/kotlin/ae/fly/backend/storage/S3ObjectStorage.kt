package ae.fly.backend.storage

import ae.fly.backend.config.StorageProperties
import ae.fly.backend.ports.CompletedPart
import ae.fly.backend.ports.MultipartUpload
import ae.fly.backend.ports.ObjectStorage
import ae.fly.backend.ports.StoredObjectMetadata
import org.springframework.stereotype.Component
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.AbortMultipartUploadRequest
import software.amazon.awssdk.services.s3.model.CompleteMultipartUploadRequest
import software.amazon.awssdk.services.s3.model.CompletedMultipartUpload
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadRequest
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.HeadObjectRequest
import software.amazon.awssdk.services.s3.model.UploadPartRequest
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import software.amazon.awssdk.services.s3.presigner.model.UploadPartPresignRequest
import java.net.URI
import java.time.Duration

@Component
class S3ObjectStorage(
    private val s3: S3Client,
    private val presigner: S3Presigner,
    private val properties: StorageProperties,
) : ObjectStorage {
    override fun createMultipart(key: String, contentType: String): MultipartUpload {
        val response = s3.createMultipartUpload(
            CreateMultipartUploadRequest.builder()
                .bucket(properties.bucket)
                .key(key)
                .contentType(contentType)
                .build(),
        )
        return MultipartUpload(response.uploadId(), key)
    }

    override fun signPart(
        key: String,
        uploadId: String,
        partNumber: Int,
        ttl: Duration,
    ): URI {
        val request = UploadPartRequest.builder()
            .bucket(properties.bucket)
            .key(key)
            .uploadId(uploadId)
            .partNumber(partNumber)
            .build()
        return presigner.presignUploadPart(
            UploadPartPresignRequest.builder()
                .signatureDuration(ttl)
                .uploadPartRequest(request)
                .build(),
        ).url().toURI()
    }

    override fun completeMultipart(
        key: String,
        uploadId: String,
        parts: List<CompletedPart>,
    ) {
        val completed = parts
            .sortedBy(CompletedPart::partNumber)
            .map {
                software.amazon.awssdk.services.s3.model.CompletedPart.builder()
                    .partNumber(it.partNumber)
                    .eTag(it.etag)
                    .build()
            }
        s3.completeMultipartUpload(
            CompleteMultipartUploadRequest.builder()
                .bucket(properties.bucket)
                .key(key)
                .uploadId(uploadId)
                .multipartUpload(
                    CompletedMultipartUpload.builder().parts(completed).build(),
                )
                .build(),
        )
    }

    override fun abortMultipart(key: String, uploadId: String) {
        s3.abortMultipartUpload(
            AbortMultipartUploadRequest.builder()
                .bucket(properties.bucket)
                .key(key)
                .uploadId(uploadId)
                .build(),
        )
    }

    override fun metadata(key: String): StoredObjectMetadata {
        val response = s3.headObject(
            HeadObjectRequest.builder().bucket(properties.bucket).key(key).build(),
        )
        return StoredObjectMetadata(response.contentType(), response.contentLength())
    }

    override fun readPrefix(key: String, bytes: Int): ByteArray =
        s3.getObjectAsBytes(
            GetObjectRequest.builder()
                .bucket(properties.bucket)
                .key(key)
                .range("bytes=0-${bytes - 1}")
                .build(),
        ).asByteArray()

    override fun signDownload(key: String, ttl: Duration): URI {
        val request = GetObjectRequest.builder()
            .bucket(properties.bucket)
            .key(key)
            .build()
        return presigner.presignGetObject(
            GetObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .getObjectRequest(request)
                .build(),
        ).url().toURI()
    }

    override fun delete(key: String) {
        s3.deleteObject(
            DeleteObjectRequest.builder().bucket(properties.bucket).key(key).build(),
        )
    }
}
