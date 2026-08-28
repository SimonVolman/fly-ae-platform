ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN telegram_user_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN telegram_chat_id BIGINT;
ALTER TABLE users ADD COLUMN telegram_username VARCHAR(64);
ALTER TABLE users ADD CONSTRAINT users_exactly_one_login_identity CHECK (
    (email IS NOT NULL AND telegram_user_id IS NULL)
    OR (email IS NULL AND telegram_user_id IS NOT NULL)
);

CREATE TABLE telegram_login_requests (
    id UUID PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    code_hash VARCHAR(64),
    telegram_user_id BIGINT,
    telegram_chat_id BIGINT,
    telegram_username VARCHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX telegram_login_requests_expires_idx
    ON telegram_login_requests (expires_at)
    WHERE consumed_at IS NULL;
