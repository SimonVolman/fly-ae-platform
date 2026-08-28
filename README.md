# fly.ae V0

Рабочая V0 сервиса загрузки и отправки авиационных PDF-документов. Реализованы
два полных сценария: первая гостевая загрузка до 10 MiB без email и загрузка до
100 MiB через OTP, доставляемый по email или через Telegram-бота. Оба проходят
прямой multipart upload в приватный S3,
проверку PDF, локальную асинхронную обработку, `APPROVED`, share-ссылку и
удаление. Авторизованный путь также включает My Documents.

## Структура

```text
/apps/web       Next.js, React, TypeScript, Uppy
/apps/backend   Kotlin, Spring Boot REST API, PostgreSQL/DynamoDB adapters, AWS SDK
/apps/worker    граница будущего отдельного worker
/infra          PostgreSQL, MinIO и backend в Docker Compose
/docs           архитектура, БД, OpenAPI и дизайн-система
/scripts        воспроизводимая проверка happy path
```

В V0 worker работает внутри backend-процесса через `JobQueue` и Spring
after-commit event. Интерфейсы `ObjectStorage`, `JobQueue`, `EmailSender` и
`DocumentClassifier` отделяют локальные реализации от будущих S3/SQS/email/LLM
адаптеров.

## Требования

- Node.js `>=22.13.0`;
- JDK 21;
- Docker с Compose;
- свободные порты `3000`, `8080`, `55432`, `9000`, `9001`.

На macOS с Homebrew JDK можно добавить к командам backend:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21
```

## Локальный запуск

1. Установить frontend-зависимости:

   ```bash
   npm install
   ```

2. Поднять PostgreSQL и приватный MinIO bucket:

   ```bash
   docker compose -f infra/docker-compose.yml up -d postgres minio minio-init
   ```

3. Запустить backend:

   ```bash
   ./scripts/start-backend.sh
   ```

   Альтернативная команда: `npm run backend`. Скрипт сам выбирает Java 21,
   очищает старые build-файлы, проверяет порт `8080` и не запускает PostgreSQL
   или MinIO.

   Flyway применит миграции и добавит категории Aircraft, APU, Engine и Landing
   Gear. В local profile одноразовый OTP выводится только в консоль backend.

4. В другом терминале запустить web:

   ```bash
   npm run dev
   ```

5. Открыть [http://localhost:3000](http://localhost:3000).

Локальные адреса:

| Сервис | URL |
|---|---|
| Web | http://localhost:3000 |
| REST API | http://localhost:8080/api/v1 |
| Health | http://localhost:8080/actuator/health |
| OpenAPI | http://localhost:8080/openapi.yaml |
| MinIO S3 | http://localhost:9000 |
| MinIO Console | http://localhost:9001 |
| PostgreSQL | localhost:55432 |

## Telegram OTP

Telegram является необязательным самостоятельным способом входа без email:

```text
Log in → Telegram → одноразовая t.me-ссылка → Start → OTP от бота
→ ввести OTP в браузере → отдельная Telegram-учётная запись fly.ae
```

Браузер хранит случайный `requestId`, а одноразовая `t.me`-ссылка содержит другой
случайный токен на 10 минут. Бот связывает запрос с Telegram user ID и отправляет
шестизначный код только в private chat. Сессия создаётся лишь при совпадении
`requestId` и кода; в БД сохраняются HMAC токена и кода. Webhook принимается
только с настроенным `X-Telegram-Bot-Api-Secret-Token`.

Email- и Telegram-идентичности в V0 являются отдельными аккаунтами. Их
объединение в один профиль пока не реализовано.

Для подключения:

1. Создайте бота через `@BotFather` и получите token и username без `@`.
2. Сгенерируйте webhook secret, например `openssl rand -hex 24`.
3. Настройте переменные:

   ```bash
   FLY_TELEGRAM_ENABLED=true
   FLY_TELEGRAM_BOT_TOKEN=123456789:replace-me
   FLY_TELEGRAM_BOT_USERNAME=FlyAeOtpBot
   FLY_TELEGRAM_WEBHOOK_SECRET=replace-with-random-url-safe-secret
   ```

4. После публикации backend на HTTPS зарегистрируйте webhook один раз:

   ```bash
   FLY_API_BASE_URL=https://replace-with-api-gateway-host
   curl --fail --request POST \
     "https://api.telegram.org/bot${FLY_TELEGRAM_BOT_TOKEN}/setWebhook" \
     --data-urlencode "url=${FLY_API_BASE_URL}/api/v1/auth/telegram/webhook" \
     --data-urlencode "secret_token=${FLY_TELEGRAM_WEBHOOK_SECRET}" \
     --data-urlencode 'allowed_updates=["message"]'
   ```

Для локальной проверки понадобится HTTPS tunnel до backend `:8080`; в параметре
`url` укажите публичный tunnel URL с путём `/api/v1/auth/telegram/webhook`.
Telegram остаётся скрытым в UI, пока `FLY_TELEGRAM_ENABLED=false`.

Конфигурация и перечень production secrets находятся в
[`.env.example`](./.env.example). Local profile имеет безопасные для локальной
разработки значения по умолчанию; production должен передавать собственные
секреты через environment variables.

Локальная разработка всегда использует PostgreSQL. Профиль `v0-prod` выбирает
DynamoDB и не запускает JDBC, Hibernate или Flyway. Оба варианта реализуют один
набор repository-контрактов, поэтому REST API и frontend остаются одинаковыми.
Подробности: [persistence adapters](./docs/persistence.md).

## Проверка happy path

При запущенных PostgreSQL, MinIO и backend:

Гостевой UP-003 без OTP:

```bash
npm run happy-path:guest
```

Путь с email OTP:

```bash
npm run happy-path
```

Скрипт запросит OTP. Скопируйте шестизначный код из консоли backend в prompt.
После этого он автоматически:

1. создаст bearer session и зафиксирует принятие Terms/Privacy;
2. создаст метаданные документа;
3. загрузит тестовый PDF напрямую в MinIO по presigned multipart URL;
4. дождётся статуса `APPROVED`;
5. проверит share-ссылку и защищённое скачивание;
6. проверит My Documents;
7. удалит документ и подтвердит `404` для share token и S3 object.

## Проверки

Frontend:

```bash
npm run build
npm run lint
npm run test:web
```

Backend unit tests и PostgreSQL/Flyway Testcontainers test:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
  ./apps/backend/gradlew -p apps/backend test
```

Testcontainers test автоматически пропускается, если Docker недоступен. Для
Colima при необходимости укажите её socket:

```bash
DOCKER_HOST=unix://$HOME/.colima/default/docker.sock \
TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
  ./apps/backend/gradlew -p apps/backend --no-daemon test
```

Полный backend вместе с инфраструктурой можно собрать через application
profile Compose:

```bash
docker compose -f infra/docker-compose.yml --profile application up --build
```

Остановить локальные зависимости:

```bash
docker compose -f infra/docker-compose.yml down
```

## API, данные и дизайн

- [OpenAPI 3.1](./docs/api/openapi.yaml)
- [Архитектура и screen flow](./docs/architecture.md)
- [User paths и acceptance tests](./docs/user-paths.md)
- [Схема PostgreSQL и состояния](./docs/database.md)
- [PostgreSQL/DynamoDB persistence adapters](./docs/persistence.md)
- [Допущения V0](./docs/assumptions.md)
- [Дизайн-схема и правила](./docs/design-system.md)
- [Машиночитаемые design tokens](./docs/design-system.json)
- живой style guide: `/style-guide`

Дизайн-система основана на
[fly.ae Figma UI Kit](https://www.figma.com/design/p8QjkewBdCS8qv1J21OoxW/fly.ae?node-id=160-1088&t=78eXDSBlGsjRRSB5-1).
Цепочка изменений:

```text
Figma → design-system.json → CSS tokens → components → screens
```

## Безопасность V0

- bucket приватный, browser получает только короткоживущие presigned URLs;
- upload URL действует один час, download URL — 15 минут;
- backend проверяет владельца, MIME, заявленный и фактический размер и `%PDF-`;
- guest capability живёт 12 часов, привязан к одному документу и не открывает
  My Documents; guest PDF ограничен 10 MiB;
- OTP одноразовый, живёт 10 минут и имеет лимит попыток;
- OTP, upload и share endpoints имеют rate limiting;
- share token создаётся через `SecureRandom`, в БД хранится HMAC lookup hash и
  AES-GCM ciphertext;
- удаление отзывает share token и удаляет объект из S3;
- содержимое PDF и OTP не попадают в production-логи;
- session, OTP и share secrets задаются environment variables.

## Ограничения V0

- local classifier детерминированно возвращает `APPROVED`;
- SQS, отдельный process worker, PDFBox и LLM оставлены за интерфейсами, но ещё
  не подключены;
- local `JobQueue` и rate limiter находятся в памяти одного backend instance;
- local OTP выводится в консоль, production email adapter ещё не подключён;
- Terms содержит английский черновик от 15 августа 2026 года, который требует
  реквизитов оператора, UAE legal review и при необходимости арабской версии;
  Privacy остаётся placeholder до получения утверждённого текста;
- нет OCR, DOCX, папок, admin UI, ручной модерации, общих уведомлений, browser-restart
  resume и staging-окружения.
