ALTER TABLE share_tokens
    ADD COLUMN short_code_hash VARCHAR(64),
    ADD COLUMN short_code_ciphertext TEXT,
    ADD COLUMN short_code_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX share_tokens_short_code_hash_idx
    ON share_tokens (short_code_hash)
    WHERE short_code_hash IS NOT NULL AND revoked_at IS NULL;

ALTER TABLE share_tokens
    ADD CONSTRAINT share_tokens_short_code_complete CHECK (
        (short_code_hash IS NULL AND short_code_ciphertext IS NULL AND short_code_expires_at IS NULL)
        OR
        (short_code_hash IS NOT NULL AND short_code_ciphertext IS NOT NULL AND short_code_expires_at IS NOT NULL)
    );
