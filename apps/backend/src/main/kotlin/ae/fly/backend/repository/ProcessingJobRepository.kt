package ae.fly.backend.repository

import ae.fly.backend.domain.ProcessingJob

interface ProcessingJobRepository {
    fun save(processingJob: ProcessingJob): ProcessingJob
}
