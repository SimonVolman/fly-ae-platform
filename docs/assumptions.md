# V0 assumptions

These assumptions keep the first fly.ae release inside the agreed V0 scope. They
must be revisited when production infrastructure and customer legal copy are
available.

1. **Java 21** is the backend runtime. Spring Boot 4.1 and Gradle 8.14+ require a
   modern JDK; the repository ships a Gradle Wrapper so a machine-wide Gradle
   installation is not required.
2. **One document per upload flow.** The frontend may show multiple historical
   documents, but each upload session represents exactly one PDF and one
   `Document` record.
3. **PDF only, owner-specific limit.** Guest uploads are limited to 100 MiB;
   authenticated uploads are limited to 3 GiB. The browser validates
   first; the backend repeats filename, MIME and size checks before signing and
   verifies the stored object after multipart completion.
4. **Email OTP and scoped guest access.** A successful OTP verification returns
   a short-lived user bearer token. A guest may instead receive a short-lived
   `gst_` bearer capability after accepting Terms and Privacy. It owns exactly
   one document and cannot list My Documents. Passwords do not exist.
5. **Development OTP delivery is local.** The development sender writes the OTP
   to the backend console. Production profiles never log OTP values.
6. **Processing is asynchronous behind an interface.** Local V0 uses an
   in-process queue and deterministic classifier. The production adapter
   boundary is compatible with a future SQS worker without requiring SQS in the
   happy path.
7. **V0 classification approves valid text PDFs deterministically.** The domain
   retains `REJECTED` and `FAILED` states for the future PDFBox/LLM worker.
8. **MinIO is the local S3 implementation.** It uses a private bucket and the
   same AWS SDK interfaces as production S3.
9. **Share links have no product-level expiry in V0.** Object upload signatures
   expire after one hour. The manual revoke and share TTL features remain out of
   scope.
10. **Legal copy is not production-approved.** The Terms route contains an
    English draft dated 15 August 2026; operator details, governing jurisdiction,
    UAE legal review and any required Arabic version remain outstanding. The
    Privacy route remains a placeholder. Acceptance storage is implemented for
    both documents.
11. **Existing UI work is preserved.** The fly.ae design system moves into
    `apps/web` and remains the source for all V0 screens.
12. **OpenAI Sites remains a frontend preview target.** The authoritative V0
    local runtime is Docker Compose because the Kotlin API, PostgreSQL and S3
    emulator cannot run inside the current static frontend deployment.
