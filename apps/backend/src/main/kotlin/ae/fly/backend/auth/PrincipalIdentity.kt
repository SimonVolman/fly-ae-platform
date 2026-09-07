package ae.fly.backend.auth

import ae.fly.backend.repository.UserRepository

internal fun UserRepository.principalIdentity(principal: FlyPrincipal?): String = when (principal) {
    is AuthenticatedUser -> {
        val user = findById(principal.id)
        val identity = user?.email?.takeIf(String::isNotBlank)
            ?: user?.telegramUsername?.takeIf(String::isNotBlank)?.let { "@$it" }
            ?: "Пользователь"
        val singleLine = identity.replace(Regex("[\\r\\n\\t]+"), " ").trim().take(255)
        "$singleLine (${principal.id})"
    }
    is AuthenticatedGuest -> "Гость (${principal.id})"
    null -> "Гость"
}
