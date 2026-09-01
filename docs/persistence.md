# Persistence adapters

fly.ae has one application model and two persistence adapters. REST endpoints,
authentication, document rules, S3 multipart upload and sharing do not depend on
the selected database.

```text
controllers and services
        |
repository contracts
        |
        +-- PostgreSQL adapter: Spring Data JPA + Flyway
        +-- DynamoDB adapter: AWS SDK + single-table keys
```

## Environment selection

Local development defaults to PostgreSQL:

```text
SPRING_PROFILES_ACTIVE=local
FLY_PERSISTENCE=postgres
```

V0-Prod defaults to DynamoDB and disables JDBC, Hibernate, Flyway and Spring
Data repository auto-configuration:

```text
SPRING_PROFILES_ACTIVE=v0-prod
FLY_PERSISTENCE=dynamodb
FLY_DYNAMODB_REGION=eu-central-1
FLY_DYNAMODB_TABLE=fly-ae-v0-prod
```

The persistence setting selects an adapter, while the profiles supply safe
environment defaults. The current `v0-prod` profile also disables the
relational auto-configurations required for a DynamoDB-only runtime. Local and
test profiles keep the PostgreSQL default.

On AWS, leave DynamoDB and S3 access keys empty. The AWS SDK then uses the
execution role. Explicit keys and a custom endpoint are only for local tests.

## DynamoDB keys

The V0 table uses `pk` and `sk`, plus the `gsi1` index for documents by owner.

| Item | `pk` | `sk` |
|---|---|---|
| User | `USER#{id}` | `PROFILE` |
| Email lookup | `EMAIL#{email}` | `USER` |
| Telegram-user lookup | `TELEGRAM_USER#{telegramUserId}` | `USER` |
| Terms acceptance | `USER#{id}` | `TERMS#{type}#{version}` |
| Guest session | `GUEST#{id}` | `SESSION` |
| Category list item | `CATEGORY` | `ORDER#{order}#{id}` |
| Category lookup | `CATEGORY_ID#{id}` | `PROFILE` |
| Document | `DOCUMENT#{id}` | `METADATA` |
| OTP | `OTP#{email}` | `CODE#{createdAt}#{id}` |
| Telegram login request | `TELEGRAM_LOGIN#{requestId}` | `REQUEST` |
| Telegram login-token lookup | `TELEGRAM_LOGIN_TOKEN#{tokenHash}` | `REQUEST` |
| Share token | `SHARE_TOKEN#{hash}` | `TOKEN` |
| Share-by-document lookup | `DOCUMENT#{id}` | `SHARE` |
| Processing job | `DOCUMENT#{id}` | `JOB#{createdAt}#{id}` |

Guest sessions, OTP items and Telegram login requests contain the `ttlEpochSeconds` attribute. The
application still checks `expiresAt` because DynamoDB TTL deletion is
asynchronous.

Conditional transactional writes preserve V0 invariants that PostgreSQL
enforces with unique constraints: unique email or Telegram user ID and a
single share token per document. Guest sessions may own multiple documents.

## Infrastructure

`infra/aws/v0-prod-dynamodb.yml` creates the on-demand encrypted table with
point-in-time recovery, TTL and retain-on-delete protection.

The application does not create the production table. `FLY_DYNAMODB_CREATE_TABLE`
is only for integration tests and disposable local DynamoDB instances.

## Tests

- service unit tests use the repository contracts;
- Flyway integration tests verify the PostgreSQL schema;
- LocalStack integration tests exercise the DynamoDB adapter;
- the `v0-prod` context test proves that the application starts without a
  PostgreSQL datasource and seeds the four document categories.

LocalStack and PostgreSQL integration tests are skipped when Docker is not
available.
