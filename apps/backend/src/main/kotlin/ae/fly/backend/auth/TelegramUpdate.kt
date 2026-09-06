package ae.fly.backend.auth

data class TelegramUpdate(
    val message: TelegramMessage? = null,
)

data class TelegramMessage(
    val text: String? = null,
    val chat: TelegramChat = TelegramChat(),
    val from: TelegramUser? = null,
)

data class TelegramChat(
    val id: Long = 0,
    val type: String = "",
)

data class TelegramUser(
    val id: Long = 0,
    val username: String? = null,
)
