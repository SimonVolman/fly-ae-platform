# Document activity and administrator notifications

Successful multipart upload completion and successful public share resolution record
the document ID, event type, server UTC timestamp, client IP (IPv4 or IPv6), and
authenticated user ID or guest session ID when available. Anonymous visitors have
neither identity field. Share resolution means a download URL was issued; it does
not prove that the visitor downloaded the complete file from S3.

IP comes from API Gateway HTTP API v2 `requestContext.http.sourceIp`. Local servlet
requests use the original connection address before forwarded-header wrappers.
Caller-supplied `Forwarded` and `X-Forwarded-For` headers are not trusted. An invalid
or unavailable IP is stored as null and displayed as “не определён”.

Telegram upload notifications include the uploader and IP. Share notifications
show the owner and visitor separately, plus IP. User identity uses email, Telegram
username, or user ID; unknown visitors are displayed as “Гость”. IP is not used to
guess identity. Public share pages optionally send the existing, unexpired session
token to the backend; session storage is per tab and no additional sign-in is
required. Download links to S3 never receive the application session token.

PostgreSQL migration V11 creates `document_activities`. DynamoDB stores events in
the existing table under `pk=DOCUMENT_ACTIVITY#<documentId>` and
`sk=EVENT#<sortable epoch milliseconds>#<eventId>`. Both adapters support retrieving
recent events for a document. There is no public activity endpoint, and activity
details are not included in the public share response.

Events persist independently of Telegram being enabled or delivery succeeding.
Database failures are logged without failing the upload or share request;
PostgreSQL audit writes use their own transaction. Activity rows contain scalar
IDs, so deleting a document or expiring a guest session does not remove its history.
No automatic expiration is configured for these events.
