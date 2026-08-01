package ae.fly.backend.document

import ae.fly.backend.auth.AuthenticatedUser
import ae.fly.backend.auth.FlyPrincipal
import ae.fly.backend.api.ApiProblem
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/documents")
class DocumentController(
    private val documentService: DocumentService,
) {
    @GetMapping
    fun list(authentication: Authentication): List<DocumentResponse> {
        val principal = authentication.flyPrincipal()
        if (principal !is AuthenticatedUser) {
            throw ApiProblem(HttpStatus.FORBIDDEN, "My Documents requires email verification.")
        }
        return documentService.list(principal.id)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        authentication: Authentication,
        @Valid @RequestBody request: CreateDocumentRequest,
    ): DocumentResponse = documentService.create(authentication.flyPrincipal(), request)

    @GetMapping("/{documentId}")
    fun get(
        authentication: Authentication,
        @PathVariable documentId: UUID,
    ): DocumentResponse = documentService.get(authentication.flyPrincipal(), documentId)

    @DeleteMapping("/{documentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        authentication: Authentication,
        @PathVariable documentId: UUID,
    ) {
        documentService.markDeleted(authentication.flyPrincipal(), documentId)
    }

    private fun Authentication.flyPrincipal(): FlyPrincipal = principal as FlyPrincipal
}
