ALTER TABLE documents DROP CONSTRAINT documents_pdf_mime;
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
            'video/mpeg'
        )
    );
