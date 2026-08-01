package ae.fly.backend.ports

import java.net.URI
import java.time.Duration

data class MultipartUpload(
    val uploadId: String,
    val key: String,
)

data class CompletedPart(
    val partNumber: Int,
    val etag: String,
)

data class StoredObjectMetadata(
    val contentType: String?,
    val contentLength: Long,
)

interface ObjectStorage {
    fun createMultipart(key: String, contentType: String): MultipartUpload
    fun signPart(key: String, uploadId: String, partNumber: Int, ttl: Duration): URI
    fun completeMultipart(key: String, uploadId: String, parts: List<CompletedPart>)
    fun abortMultipart(key: String, uploadId: String)
    fun metadata(key: String): StoredObjectMetadata
    fun readPrefix(key: String, bytes: Int): ByteArray
    fun signDownload(key: String, ttl: Duration): URI
    fun delete(key: String)
}
