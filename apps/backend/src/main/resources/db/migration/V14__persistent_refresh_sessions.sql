CREATE TABLE refresh_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    rotated_at TIMESTAMPTZ,
    successor_id UUID,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX refresh_sessions_family_idx ON refresh_sessions (family_id);
CREATE INDEX refresh_sessions_user_idx ON refresh_sessions (user_id);
