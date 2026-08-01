package ae.fly.backend.document

import ae.fly.backend.repository.CategoryRepository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/categories")
class CategoryController(
    private val categories: CategoryRepository,
) {
    @GetMapping
    fun list(): List<CategoryResponse> =
        categories.findAllByActiveTrueOrderByDisplayOrderAsc().map(CategoryResponse::from)
}
