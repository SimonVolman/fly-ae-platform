package ae.fly.backend.auth

import ae.fly.backend.config.EmailProperties
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import software.amazon.awssdk.services.sesv2.SesV2Client
import software.amazon.awssdk.services.sesv2.model.Body
import software.amazon.awssdk.services.sesv2.model.Content
import software.amazon.awssdk.services.sesv2.model.Destination
import software.amazon.awssdk.services.sesv2.model.EmailContent
import software.amazon.awssdk.services.sesv2.model.Message
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest
import java.time.Instant

@Component
@Profile("!local & !test")
class ProductionEmailSender(
    private val ses: SesV2Client,
    private val properties: EmailProperties,
) : EmailSender {
    override fun sendOtp(email: String, code: String, expiresAt: Instant) {
        val subject = Content.builder()
            .data("Your fly.ae verification code")
            .charset("UTF-8")
            .build()
        val text = Content.builder()
            .data(
                "Your fly.ae verification code is $code. " +
                    "It expires at $expiresAt and can be used only once.",
            )
            .charset("UTF-8")
            .build()
        ses.sendEmail(
            SendEmailRequest.builder()
                .fromEmailAddress(properties.from)
                .destination(Destination.builder().toAddresses(email).build())
                .content(
                    EmailContent.builder()
                        .simple(
                            Message.builder()
                                .subject(subject)
                                .body(Body.builder().text(text).build())
                                .build(),
                        )
                        .build(),
                )
                .build(),
        )
    }
}
