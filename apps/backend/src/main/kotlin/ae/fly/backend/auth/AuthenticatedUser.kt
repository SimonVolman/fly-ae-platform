package ae.fly.backend.auth

import java.util.UUID

sealed interface FlyPrincipal {
    val id: UUID
}

data class AuthenticatedUser(
    override val id: UUID,
) : FlyPrincipal

data class AuthenticatedGuest(
    override val id: UUID,
) : FlyPrincipal
