# V0-PROD deployment

## Цель

Развернуть минимальную production-версию fly.ae с минимальными постоянными
расходами. В V0-PROD нет LLM, SQS и отдельного worker: после успешной проверки
загрузки документ автоматически получает статус `APPROVED`.

Система должна поддерживать:

1. выбор категории документа и ввод MSN;
2. первую гостевую загрузку PDF до 10 МБ без email;
3. авторизацию через email OTP;
4. загрузку PDF напрямую в приватное хранилище;
5. создание защищённой share-ссылки;
6. просмотр My Documents;
7. удаление документа и файла;
8. хранение production-данных в DynamoDB.

## Рекомендуемая архитектура

Самая дешёвая схема V0-PROD:

```text
Static frontend
+ CloudFront
+ API Gateway HTTP API
+ одна AWS Lambda
+ DynamoDB on-demand
+ приватный S3
+ Amazon SES
```

Поток запросов:

```text
Пользователь
    |
    +-- HTTPS ----> CloudFront ----> S3 с frontend
    |
    +-- REST API -> API Gateway HTTP API -> Lambda
    |                                         |
    |                                         +-- DynamoDB
    |                                         +-- S3 Documents
    |                                         +-- Amazon SES
    |
    +-- PDF ---------------------------------> S3 Documents
                      напрямую по presigned URL
```

В схеме отсутствуют постоянно работающие серверы. Не используются EC2,
Lightsail, ECS, Kubernetes, ALB, RDS, NAT Gateway и VPC.

## Регион

Все AWS-ресурсы размещаются в одном регионе:

```text
eu-central-1 — Frankfurt
```

Размещение в UAE для V0 не требуется. Один регион упрощает инфраструктуру и
исключает межрегиональный трафик.

## Frontend

- Next.js и TypeScript;
- production build размещается в приватном S3 bucket;
- CloudFront предоставляет HTTPS и доставку сайта;
- ACM предоставляет TLS-сертификат;
- основной адрес — `https://fly.ae`;
- CloudFront получает файлы из S3 через Origin Access Control;
- DNS можно оставить у текущего регистратора, чтобы не оплачивать Route 53
  Hosted Zone.

Для статического размещения динамический маршрут `/share/{token}` должен быть
клиентским: страница загружается как часть статического frontend, после чего
запрашивает документ через backend API.

Если текущую сборку нельзя сразу сделать статической, frontend можно временно
оставить на существующем хостинге. Backend и хранилища AWS от этого не меняются.

## Backend

Backend запускается как одна AWS Lambda за API Gateway HTTP API:

- Kotlin и Java 21;
- Spring Boot;
- профиль `v0-prod`;
- один монолитный Lambda handler для существующего REST API;
- без Provisioned Concurrency;
- без VPC.

Начальные настройки Lambda:

```text
Architecture: arm64
Memory: 1024 MB
Timeout: 30 seconds
Provisioned concurrency: 0
```

Если какая-либо библиотека несовместима с ARM64, используется `x86_64`.
Предпочтителен ZIP deployment с управляемым Java 21 runtime. Container image
остаётся запасным вариантом.

Перед deployment необходимо добавить совместимый с API Gateway Lambda handler
и проверить cold start Spring Boot-приложения.

Публичный API размещается, например, по адресу:

```text
https://api.fly.ae
```

Основные группы endpoint:

```text
/api/categories
/api/auth/otp/request
/api/auth/otp/verify
/api/guest/session
/api/documents
/api/uploads
/api/shares
```

На API Gateway настраиваются CORS, throttling и access logs без OTP, секретов и
содержимого документов.

## Загрузка документов

PDF не проходит через Lambda или API Gateway:

1. frontend создаёт upload session через backend;
2. backend проверяет пользователя, MIME-тип и размер;
3. backend возвращает presigned multipart URLs;
4. браузер загружает PDF непосредственно в приватный S3 bucket;
5. frontend сообщает backend о завершении загрузки;
6. backend проверяет объект и его размер;
7. создаётся или обновляется запись документа;
8. документ получает статус `APPROVED`;
9. создаётся криптографически случайный share token.

Ограничения:

```text
Первая гостевая загрузка: до 10 МБ
Авторизованная загрузка: до 100 МБ
Тип файла: application/pdf
Количество файлов: один документ за одну операцию
Presigned URL TTL: не более одного часа
```

Ограничения проверяются и во frontend, и в backend.

## S3 Documents

Рекомендуемое имя bucket:

```text
fly-ae-v0-prod-documents
```

Настройки:

- Block Public Access включён;
- SSE-S3 encryption;
- CORS разрешает только production frontend;
- lifecycle rule удаляет незавершённые multipart uploads через один день;
- IAM-доступ выдаётся только backend Lambda;
- содержимое документов не попадает в логи.

При удалении документа backend удаляет объект из S3, переводит документ в
`DELETED` и делает прежнюю share-ссылку недействительной.

## DynamoDB

В V0-PROD используется уже предусмотренный DynamoDB persistence adapter:

```text
Table: fly-ae-v0-prod
Billing mode: PAY_PER_REQUEST
```

В одной таблице хранятся:

- пользователи;
- OTP metadata;
- принятие Terms;
- категории;
- документы и их статусы;
- гостевые сессии;
- share tokens;
- данные upload session;
- служебные записи обработки.

PDF хранятся только в S3. Для OTP и гостевых сессий используется DynamoDB TTL.

Обязательные настройки таблицы:

- server-side encryption;
- Point-in-Time Recovery;
- защита от удаления в CloudFormation;
- on-demand capacity;
- один GSI для документов пользователя;
- conditional writes для уникального email, гостевой загрузки и share token.

Локально приложение продолжает использовать PostgreSQL:

```text
local/default -> PostgreSQL
v0-prod       -> DynamoDB
```

## Email OTP

Production-отправка OTP выполняется через Amazon SES. До запуска необходимо:

1. подтвердить домен `fly.ae`;
2. настроить DKIM;
3. вывести SES account из sandbox;
4. реализовать production-адаптер `EmailSender`;
5. настроить адрес, например `no-reply@fly.ae`.

OTP является одноразовым, ограничен по времени, хранится только в безопасном
виде и никогда не выводится в production-логах.

## Share-ссылки

Публичная ссылка имеет вид:

```text
https://fly.ae/share/{random-token}
```

Backend находит token в DynamoDB, проверяет статус `APPROVED` и возвращает
короткоживущий presigned S3 GET URL. S3 bucket остаётся приватным.

## Обработка документов в V0

В V0-PROD не используются SQS, отдельный worker, PDFBox, LLM и AI-классификация.
После проверки загрузки backend выполняет детерминированный переход:

```text
UPLOADING -> PENDING -> APPROVED
```

Интерфейсы `JobQueue` и `DocumentClassifier` сохраняются для будущего подключения
SQS и AI без изменения публичного REST API.

## Секреты и IAM

Для минимальной стоимости используются encrypted Lambda environment variables
или Standard Parameters в SSM Parameter Store. Secrets Manager для V0 не нужен.

Секретами являются:

- ключ подписи пользовательских сессий;
- OTP pepper;
- guest-session signing key;
- share-token pepper;
- служебные настройки email.

Постоянные AWS access keys в production не используются. Lambda обращается к
DynamoDB, S3 и SES через IAM Role с минимально необходимыми разрешениями.

Минимальные переменные окружения:

```text
SPRING_PROFILES_ACTIVE=v0-prod
FLY_PERSISTENCE=dynamodb

FLY_DYNAMODB_REGION=eu-central-1
FLY_DYNAMODB_TABLE=fly-ae-v0-prod
FLY_DYNAMODB_CREATE_TABLE=false

FLY_S3_REGION=eu-central-1
FLY_S3_BUCKET=fly-ae-v0-prod-documents

FLY_PUBLIC_BASE_URL=https://fly.ae
FLY_ALLOWED_ORIGINS=https://fly.ae,https://www.fly.ae

FLY_SESSION_SECRET=...
FLY_OTP_PEPPER=...
FLY_GUEST_SECRET=...
FLY_SHARE_TOKEN_PEPPER=...

FLY_EMAIL_FROM=no-reply@fly.ae
```

`AWS_ACCESS_KEY_ID` и `AWS_SECRET_ACCESS_KEY` в Lambda не задаются.

## Rate limiting

API Gateway предоставляет общее ограничение запросов. Для OTP, guest session и
upload endpoints нужны счётчики в DynamoDB с TTL и conditional updates.

Текущий in-memory limiter недостаточен для Lambda, поскольку одновременно могут
работать несколько экземпляров функции.

Ограничиваются:

- запрос OTP по email;
- запрос OTP по IP;
- создание гостевых сессий;
- начало upload;
- открытие share-ссылок.

AWS WAF в V0 не подключается из-за постоянной ежемесячной стоимости.

## Логи и контроль расходов

Используется CloudWatch Logs:

```text
Log retention: 7-14 дней
Application log level: INFO
Hibernate SQL logs: выключены
Документы и OTP: не логируются
```

Минимальные alarms:

- Lambda errors;
- API Gateway 5xx;
- Lambda throttles;
- выполнение Lambda рядом с timeout.

AWS Budget:

```text
Первое предупреждение: $10
Второе предупреждение: $25
```

## Infrastructure as Code

Инфраструктура описывается через AWS SAM/CloudFormation. Один V0-PROD stack
включает:

- DynamoDB table;
- private documents S3 bucket;
- Lambda execution role;
- backend Lambda;
- API Gateway HTTP API;
- CloudWatch log groups;
- frontend S3 bucket;
- CloudFront distribution;
- IAM policies;
- outputs с URL API и CloudFront.

Существующий шаблон `infra/aws/v0-prod-dynamodb.yml` включается в общий SAM
template или переносится в него. ECR требуется только при использовании Lambda
container image.

## CI/CD

Deployment выполняется через GitHub Actions после push в `main` или вручную:

1. запустить backend tests;
2. запустить frontend tests и lint;
3. собрать backend;
4. собрать frontend;
5. собрать SAM package;
6. обновить CloudFormation stack;
7. загрузить frontend в S3;
8. обновить CloudFront cache;
9. выполнить smoke tests.

Используются только окружения `local` и `v0-prod`. Отдельное staging-окружение в
V0 не создаётся.

GitHub Actions получает доступ к AWS через GitHub OIDC и краткоживущую IAM Role.
Постоянные AWS keys в GitHub Secrets не сохраняются.

## Порядок первого deployment

1. Подготовить AWS account и бюджетные уведомления.
2. Подтвердить домен в SES.
3. Добавить Lambda handler к backend.
4. Реализовать production `EmailSender`.
5. Перенести rate limiting в DynamoDB.
6. Создать общий SAM/CloudFormation stack.
7. Развернуть DynamoDB и S3.
8. Развернуть Lambda и API Gateway.
9. Собрать и разместить frontend.
10. Подключить `fly.ae` и `api.fly.ae`.
11. Проверить CORS и IAM.
12. Выполнить полный smoke test.

## Критерии готовности

### UP-001 — авторизация

- пользователь запрашивает OTP;
- получает письмо;
- вводит OTP;
- создаётся пользовательская сессия.

### UP-002 — авторизованная загрузка

- пользователь выбирает категорию и вводит MSN;
- загружает PDF до 100 МБ;
- документ получает статус `APPROVED`;
- появляется share-ссылка;
- документ отображается в My Documents.

### UP-003 — первая гостевая загрузка

- новый пользователь не вводит email;
- загружает PDF до 10 МБ;
- получает share-ссылку;
- повторная гостевая загрузка требует авторизации.

### Share и Delete

- ссылка открывает только `APPROVED` документ;
- неизвестный или удалённый token не предоставляет файл;
- S3 bucket остаётся непубличным;
- удаление документа удаляет PDF из S3;
- прежняя share-ссылка перестаёт работать.

## Ориентировочная стоимость

При небольшом V0-трафике:

| Компонент | Ожидаемо в месяц |
| --- | ---: |
| Lambda | $0-1 |
| API Gateway | $0-1 |
| DynamoDB | $0-1 |
| SES | несколько центов |
| S3 | зависит от объёма PDF |
| CloudFront/frontend | $0-1 при малом трафике |
| CloudWatch | $0-1 |
| ACM | $0 |
| **Ориентир всего** | **$1-5/месяц** |

Отдельно оплачиваются домен, хранение большого количества PDF, исходящий трафик
при скачивании документов и возможные налоги AWS.

Ориентировочная трудоёмкость подготовки и проверки deployment: 35-60 часов.
Основной технический риск — адаптация текущего Spring Boot-приложения под Lambda
и контроль cold start.
