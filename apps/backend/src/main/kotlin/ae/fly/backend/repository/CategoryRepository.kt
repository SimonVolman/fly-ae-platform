package ae.fly.backend.repository

import ae.fly.backend.domain.Category
import java.util.UUID

interface CategoryRepository {
    fun findAllByActiveTrueOrderByDisplayOrderAsc(): List<Category>
    fun findByIdAndActiveTrue(id: UUID): Category?
    fun save(category: Category): Category
}
