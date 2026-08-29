ALTER TABLE documents DROP CONSTRAINT documents_size_range;
ALTER TABLE documents
    ADD CONSTRAINT documents_size_range
    CHECK (size_bytes > 0 AND size_bytes <= 262144000);
