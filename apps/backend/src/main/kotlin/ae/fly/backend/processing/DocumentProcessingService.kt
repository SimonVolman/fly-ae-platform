package ae.fly.backend.processing

import ae.fly.backend.domain.DocumentStatus
import ae.fly.backend.domain.ProcessingJob
import ae.fly.backend.domain.ProcessingJobStatus
import ae.fly.backend.ports.Classification
import ae.fly.backend.ports.DocumentClassifier
import ae.fly.backend.repository.DocumentRepository
import ae.fly.backend.repository.ProcessingJobRepository
import ae.fly.backend.share.ShareTokenService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.util.UUID

@Service
class DocumentProcessingService(
    private val documents: DocumentRepository,
    private val jobs: ProcessingJobRepository,
    private val classifier: DocumentClassifier,
    private val shareTokens: ShareTokenService,
    private val clock: Clock,
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    @Transactional
    fun process(documentId: UUID) {
        val document = documents.findById(documentId).orElse(null) ?: return
        if (document.status != DocumentStatus.PENDING) return

        val now = clock.instant()
        val job = jobs.save(
            ProcessingJob(
                document = document,
                status = ProcessingJobStatus.RUNNING,
                attempt = 1,
                createdAt = now,
                startedAt = now,
            ),
        )
        document.status = DocumentStatus.PROCESSING
        document.updatedAt = now
        documents.save(document)

        try {
            val result = classifier.classify(document.id.toString(), "")
            document.status = when (result.classification) {
                Classification.APPROVED -> DocumentStatus.APPROVED
                Classification.REJECTED -> DocumentStatus.REJECTED
            }
            document.updatedAt = clock.instant()
            documents.save(document)
            if (document.status == DocumentStatus.APPROVED) {
                shareTokens.create(document)
            }
            job.status = ProcessingJobStatus.COMPLETED
            job.completedAt = clock.instant()
            jobs.save(job)
        } catch (error: RuntimeException) {
            document.status = DocumentStatus.FAILED
            document.failureReason = "PROCESSING_FAILED"
            document.updatedAt = clock.instant()
            documents.save(document)
            job.status = ProcessingJobStatus.FAILED
            job.errorCode = "PROCESSING_FAILED"
            job.completedAt = clock.instant()
            jobs.save(job)
            logger.error(
                "Document processing failed for documentId={} errorType={}",
                documentId,
                error.javaClass.simpleName,
            )
        }
    }
}
