-- Scalar IDs preserve the event even if a document or guest session is later removed.
CREATE TABLE document_activities (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL,
    event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('UPLOAD_COMPLETED', 'SHARE_ACCESSED')),
    occurred_at TIMESTAMPTZ NOT NULL,
    ip_address VARCHAR(45),
    actor_user_id UUID,
    guest_session_id UUID,
    CHECK (actor_user_id IS NULL OR guest_session_id IS NULL)
);

CREATE INDEX idx_document_activities_document_time
    ON document_activities (document_id, occurred_at DESC, id DESC);
