import assert from "node:assert/strict";
import test from "node:test";

import { storageUploadUrl } from "../app/upload-url.ts";

const signedUrl = "https://documents.s3.me-central-1.amazonaws.com/file?signature=test";

test("relative production API uploads directly to the signed storage URL", () => {
  assert.equal(storageUploadUrl(signedUrl, "/api/v1", "dev.fly.ae"), signedUrl);
  assert.equal(storageUploadUrl(signedUrl, "/api/v1", "fly.ae"), signedUrl);
});

test("local development API keeps using the upload proxy", () => {
  assert.equal(
    storageUploadUrl(signedUrl, "/api/v1", "127.0.0.1"),
    "/__s3_proxy?url=" + encodeURIComponent(signedUrl),
  );
  assert.equal(
    storageUploadUrl(signedUrl, "http://localhost:8080/api/v1", "localhost"),
    "http://localhost:8080/__s3_proxy?url=" + encodeURIComponent(signedUrl),
  );
});
