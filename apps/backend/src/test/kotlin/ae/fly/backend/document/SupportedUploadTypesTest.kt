package ae.fly.backend.document

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class SupportedUploadTypesTest {
    @Test
    fun `accepts supported archive extensions and mime types`() {
        assertTrue(isSupportedUpload("records.zip", "application/zip"))
        assertTrue(isSupportedUpload("records.7z", "application/x-7z-compressed"))
        assertTrue(isSupportedUpload("records.rar", "application/vnd.rar"))
        assertTrue(isSupportedUpload("records.tar", "application/x-tar"))
        assertTrue(isSupportedUpload("records.tgz", "application/gzip"))
        assertTrue(isSupportedUpload("records.tbz2", "application/x-bzip2"))
        assertTrue(isSupportedUpload("records.txz", "application/x-xz"))
        assertFalse(isSupportedUpload("records.zip", "application/x-7z-compressed"))
    }

    @Test
    fun `validates archive signatures`() {
        assertTrue(hasValidUploadSignature("application/zip", bytes(0x50, 0x4B, 0x03, 0x04)))
        assertTrue(
            hasValidUploadSignature(
                "application/x-7z-compressed",
                bytes(0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C),
            ),
        )
        assertTrue(
            hasValidUploadSignature(
                "application/vnd.rar",
                bytes(0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00),
            ),
        )
        val tarHeader = ByteArray(512)
        "ustar".toByteArray().copyInto(tarHeader, destinationOffset = 257)
        assertTrue(hasValidUploadSignature("application/x-tar", tarHeader))
        assertTrue(hasValidUploadSignature("application/gzip", bytes(0x1F, 0x8B)))
        assertTrue(hasValidUploadSignature("application/x-bzip2", "BZh".toByteArray()))
        assertTrue(
            hasValidUploadSignature(
                "application/x-xz",
                bytes(0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00),
            ),
        )
        assertFalse(hasValidUploadSignature("application/zip", "not-a-zip".toByteArray()))
    }

    private fun bytes(vararg values: Int) = ByteArray(values.size) { index -> values[index].toByte() }
}
