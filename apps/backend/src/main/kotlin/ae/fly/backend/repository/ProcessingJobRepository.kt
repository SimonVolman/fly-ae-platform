package ae.fly.backend.repository

import ae.fly.backend.domain.ProcessingJob
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ProcessingJobRepository : JpaRepository<ProcessingJob, UUID>
