CREATE TABLE guest_sessions (
    id UUID PRIMARY KEY,
    accepted_terms_version VARCHAR(32) NOT NULL,
    accepted_privacy_version VARCHAR(32) NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE documents
    ALTER COLUMN user_id DROP NOT NULL,
    ADD COLUMN guest_session_id UUID REFERENCES guest_sessions (id),
    ADD CONSTRAINT documents_exactly_one_owner CHECK (
        (user_id IS NOT NULL AND guest_session_id IS NULL)
        OR (user_id IS NULL AND guest_session_id IS NOT NULL)
    ),
    ADD CONSTRAINT documents_one_per_guest UNIQUE (guest_session_id);

CREATE INDEX guest_sessions_expires_idx ON guest_sessions (expires_at);
CREATE INDEX documents_guest_created_idx
    ON documents (guest_session_id, created_at DESC)
    WHERE guest_session_id IS NOT NULL;
