# fly.ae worker

V0 keeps asynchronous processing in the backend process behind the `JobQueue`
and `DocumentClassifier` interfaces:

- `LocalJobQueue` publishes an after-commit event;
- `LocalProcessingListener` runs it on the Spring async executor;
- `DeterministicDocumentClassifier` always approves a verified local PDF.

This directory reserves the independent deployable worker boundary. When SQS,
PDFBox and the production classifier are introduced, the worker will consume
the same `documentId` job contract and call the shared processing application
service. The V0 happy path does not require an external queue or LLM account.
