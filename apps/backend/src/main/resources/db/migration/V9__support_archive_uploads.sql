ALTER TABLE documents DROP CONSTRAINT documents_supported_mime;
ALTER TABLE documents
    ADD CONSTRAINT documents_supported_mime CHECK (
        mime_type IN (
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/heic',
            'image/heif',
            'video/mp4',
            'video/x-m4v',
            'video/quicktime',
            'video/webm',
            'video/x-msvideo',
            'video/mpeg',
            'application/zip',
            'application/x-zip-compressed',
            'application/x-7z-compressed',
            'application/vnd.rar',
            'application/x-rar-compressed',
            'application/x-tar',
            'application/gzip',
            'application/x-gzip',
            'application/x-bzip2',
            'application/x-xz'
        )
    );
