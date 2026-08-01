package ae.fly.backend.repository

import ae.fly.backend.domain.Category
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface CategoryRepository : JpaRepository<Category, UUID> {
    fun findAllByActiveTrueOrderByDisplayOrderAsc(): List<Category>
    fun findByIdAndActiveTrue(id: UUID): Category?
}
