package ae.fly.backend.document

const val SUPPORTED_UPLOAD_FILENAME_PATTERN =
    "(?i)^.+\\.(pdf|jpe?g|png|gif|webp|heic|heif|mp4|m4v|mov|webm|avi|mpeg|mpg|zip|7z|rar|tar|gz|tgz|bz2|tbz2|xz|txz)$"

const val SUPPORTED_UPLOAD_MIME_PATTERN =
    "^(application/pdf|image/jpeg|image/png|image/gif|image/webp|image/heic|image/heif|video/mp4|video/x-m4v|video/quicktime|video/webm|video/x-msvideo|video/mpeg|application/zip|application/x-zip-compressed|application/x-7z-compressed|application/vnd.rar|application/x-rar-compressed|application/x-tar|application/gzip|application/x-gzip|application/x-bzip2|application/x-xz)$"

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
    "application/zip" to setOf("zip"),
    "application/x-zip-compressed" to setOf("zip"),
    "application/x-7z-compressed" to setOf("7z"),
    "application/vnd.rar" to setOf("rar"),
    "application/x-rar-compressed" to setOf("rar"),
    "application/x-tar" to setOf("tar"),
    "application/gzip" to setOf("gz", "tgz"),
    "application/x-gzip" to setOf("gz", "tgz"),
    "application/x-bzip2" to setOf("bz2", "tbz2"),
    "application/x-xz" to setOf("xz", "txz"),
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
        "application/zip", "application/x-zip-compressed" ->
            prefix.startsWithBytes(0x50, 0x4B, 0x03, 0x04) ||
                prefix.startsWithBytes(0x50, 0x4B, 0x05, 0x06) ||
                prefix.startsWithBytes(0x50, 0x4B, 0x07, 0x08)
        "application/x-7z-compressed" ->
            prefix.startsWithBytes(0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C)
        "application/vnd.rar", "application/x-rar-compressed" ->
            prefix.startsWithBytes(0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00) ||
                prefix.startsWithBytes(0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00)
        "application/x-tar" -> prefix.ascii(257, 5) == "ustar"
        "application/gzip", "application/x-gzip" -> prefix.startsWithBytes(0x1F, 0x8B)
        "application/x-bzip2" -> prefix.ascii(0, 3) == "BZh"
        "application/x-xz" -> prefix.startsWithBytes(0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00)
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
