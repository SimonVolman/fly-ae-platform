package ae.fly.backend.document

const val SUPPORTED_UPLOAD_FILENAME_PATTERN =
    "(?i)^.+\\.(pdf|jpe?g|png|gif|webp|heic|heif|mp4|m4v|mov|webm|avi|mpeg|mpg)$"

const val SUPPORTED_UPLOAD_MIME_PATTERN =
    "^(application/pdf|image/jpeg|image/png|image/gif|image/webp|image/heic|image/heif|video/mp4|video/x-m4v|video/quicktime|video/webm|video/x-msvideo|video/mpeg)$"

private val extensionsByMimeType = mapOf(
    "application/pdf" to setOf("pdf"),
    "image/jpeg" to setOf("jpg", "jpeg"),
    "image/png" to setOf("png"),
    "image/gif" to setOf("gif"),
    "image/webp" to setOf("webp"),
    "image/heic" to setOf("heic"),
    "image/heif" to setOf("heif"),
    "video/mp4" to setOf("mp4", "m4v"),
    "video/x-m4v" to setOf("m4v"),
    "video/quicktime" to setOf("mov"),
    "video/webm" to setOf("webm"),
    "video/x-msvideo" to setOf("avi"),
    "video/mpeg" to setOf("mpeg", "mpg"),
)

fun isSupportedUpload(filename: String, mimeType: String): Boolean {
    val extension = filename.substringAfterLast('.', "").lowercase()
    return extensionsByMimeType[mimeType.lowercase()]?.contains(extension) == true
}

fun hasValidUploadSignature(mimeType: String, prefix: ByteArray): Boolean =
    when (mimeType.lowercase()) {
        "application/pdf" -> prefix.ascii(0, 5) == "%PDF-"
        "image/jpeg" -> prefix.startsWithBytes(0xFF, 0xD8, 0xFF)
        "image/png" -> prefix.startsWithBytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        "image/gif" -> prefix.ascii(0, 6) in setOf("GIF87a", "GIF89a")
        "image/webp" -> prefix.ascii(0, 4) == "RIFF" && prefix.ascii(8, 4) == "WEBP"
        "image/heic", "image/heif" ->
            prefix.ascii(4, 4) == "ftyp" &&
                prefix.ascii(8, 4) in setOf(
                    "heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1",
                )
        "video/mp4", "video/x-m4v" -> prefix.ascii(4, 4) == "ftyp"
        "video/quicktime" ->
            prefix.ascii(4, 4) in setOf("ftyp", "moov", "mdat", "wide", "free")
        "video/webm" -> prefix.startsWithBytes(0x1A, 0x45, 0xDF, 0xA3)
        "video/x-msvideo" -> prefix.ascii(0, 4) == "RIFF" && prefix.ascii(8, 4) == "AVI "
        "video/mpeg" ->
            prefix.startsWithBytes(0x00, 0x00, 0x01, 0xBA) ||
                prefix.startsWithBytes(0x00, 0x00, 0x01, 0xB3)
        else -> false
    }

private fun ByteArray.ascii(offset: Int, length: Int): String? {
    if (size < offset + length) return null
    return copyOfRange(offset, offset + length).toString(Charsets.US_ASCII)
}

private fun ByteArray.startsWithBytes(vararg expected: Int): Boolean =
    size >= expected.size && expected.indices.all { index ->
        this[index].toInt() and 0xFF == expected[index]
    }
