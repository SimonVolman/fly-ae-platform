# PostgreSQL database model

PostgreSQL is authoritative for local development and PostgreSQL-backed
deployments. It stores users, authentication attempts, document metadata,
processing state and share capability tokens. UUID primary keys are generated
by the application. V0-Prod uses the equivalent DynamoDB adapter described in
[`persistence.md`](./persistence.md).

```mermaid
erDiagram
    USER ||--o{ OTP_CODE : requests
    USER ||--o{ TERMS_ACCEPTANCE : accepts
    USER ||--o{ DOCUMENT : owns
    GUEST_SESSION ||--o| DOCUMENT : owns
    CATEGORY ||--o{ DOCUMENT : classifies
    DOCUMENT ||--o{ PROCESSING_JOB : processes
    DOCUMENT ||--o| SHARE_TOKEN : exposes

    USER {
      uuid id PK
      varchar email UK "nullable"
      bigint telegram_user_id UK "nullable"
      bigint telegram_chat_id "nullable"
      varchar telegram_username "nullable"
      timestamptz created_at
      timestamptz updated_at
    }
    OTP_CODE {
      uuid id PK
      varchar email
      varchar code_hash
      timestamptz expires_at
      timestamptz consumed_at
      integer failed_attempts
      timestamptz created_at
    }
    TELEGRAM_LOGIN_REQUEST {
      uuid id PK
      varchar token_hash UK
      varchar code_hash
      bigint telegram_user_id
      bigint telegram_chat_id
      varchar telegram_username
      timestamptz expires_at
      timestamptz consumed_at
      integer failed_attempts
      timestamptz created_at
    }
    TERMS_ACCEPTANCE {
      uuid id PK
      uuid user_id FK
      varchar document_type
      varchar version
      timestamptz accepted_at
    }
    GUEST_SESSION {
      uuid id PK
      varchar accepted_terms_version
      varchar accepted_privacy_version
      timestamptz accepted_at
      timestamptz expires_at
      timestamptz created_at
    }
    CATEGORY {
      uuid id PK
      varchar code UK
      varchar name
      boolean active
      integer display_order
    }
    DOCUMENT {
      uuid id PK
      uuid user_id FK "nullable"
      uuid guest_session_id FK,UK "nullable"
      uuid category_id FK
      varchar msn
      varchar original_filename
      varchar object_key UK
      varchar mime_type
      bigint size_bytes
      varchar status
      varchar multipart_upload_id
      varchar failure_reason
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }
    PROCESSING_JOB {
      uuid id PK
      uuid document_id FK
      varchar status
      integer attempt
      varchar error_code
      timestamptz created_at
      timestamptz started_at
      timestamptz completed_at
    }
    SHARE_TOKEN {
      uuid id PK
      uuid document_id FK,UK
      varchar token_hash UK
      varchar token_prefix
      text token_ciphertext
      timestamptz created_at
      timestamptz revoked_at
    }
```

`documents_exactly_one_owner` requires either `user_id` or `guest_session_id`,
never both. `documents_one_per_guest` limits each guest capability to one
document. `users_exactly_one_login_identity` requires either email or Telegram
user ID, never both. `telegram_login_requests` stores only HMAC values for the
deep-link token and OTP; the browser holds the request UUID while the raw token
exists only in a short-lived `t.me` URL.

## Document transitions

```text
CREATED → UPLOADING → PENDING → PROCESSING → APPROVED
                                  ├────────→ REJECTED
                                  └────────→ FAILED

Any owner-controlled non-terminal or terminal state → DELETED
```

Only `APPROVED` documents may own an active `ShareToken`.

## Seed categories

V0 starts with the four categories represented in the approved UI kit:

1. Aircraft
2. APU
3. Engine
4. Landing Gear
