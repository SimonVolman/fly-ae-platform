package ae.fly.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.util.UUID

@Entity
@Table(name = "categories")
class Category(
    @Id
    var id: UUID = UUID.randomUUID(),

    @Column(nullable = false, unique = true, length = 64)
    var code: String = "",

    @Column(nullable = false, length = 120)
    var name: String = "",

    @Column(nullable = false)
    var active: Boolean = true,

    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = 0,
)
