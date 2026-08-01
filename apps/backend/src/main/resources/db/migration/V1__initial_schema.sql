CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE otp_codes (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT otp_codes_failed_attempts_non_negative CHECK (failed_attempts >= 0)
);

CREATE INDEX otp_codes_email_created_idx ON otp_codes (email, created_at DESC);

CREATE TABLE terms_acceptances (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    document_type VARCHAR(32) NOT NULL,
    version VARCHAR(32) NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT terms_acceptances_once UNIQUE (user_id, document_type, version)
);

CREATE TABLE categories (
    id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE documents (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    category_id UUID NOT NULL REFERENCES categories (id),
    msn VARCHAR(64) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    object_key VARCHAR(768) NOT NULL UNIQUE,
    mime_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL,
    status VARCHAR(24) NOT NULL,
    multipart_upload_id VARCHAR(512),
    failure_reason VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT documents_size_range CHECK (size_bytes > 0 AND size_bytes <= 104857600),
    CONSTRAINT documents_pdf_mime CHECK (mime_type = 'application/pdf'),
    CONSTRAINT documents_status CHECK (
        status IN (
            'CREATED',
            'UPLOADING',
            'PENDING',
            'PROCESSING',
            'APPROVED',
            'REJECTED',
            'FAILED',
            'DELETED'
        )
    )
);

CREATE INDEX documents_user_created_idx ON documents (user_id, created_at DESC);
CREATE INDEX documents_status_idx ON documents (status) WHERE deleted_at IS NULL;

CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents (id),
    status VARCHAR(24) NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 0,
    error_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT processing_jobs_attempt_non_negative CHECK (attempt >= 0),
    CONSTRAINT processing_jobs_status CHECK (
        status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')
    )
);

CREATE INDEX processing_jobs_document_idx ON processing_jobs (document_id, created_at DESC);
CREATE INDEX processing_jobs_pending_idx ON processing_jobs (status, created_at)
    WHERE status IN ('QUEUED', 'RUNNING');

CREATE TABLE share_tokens (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL UNIQUE REFERENCES documents (id),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_prefix VARCHAR(12) NOT NULL,
    token_ciphertext TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX share_tokens_prefix_idx ON share_tokens (token_prefix)
    WHERE revoked_at IS NULL;
