package ae.fly.backend.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.sesv2.SesV2Client

@Configuration
@Profile("!local & !test")
class EmailConfig {
    @Bean(destroyMethod = "close")
    fun sesV2Client(properties: EmailProperties): SesV2Client =
        SesV2Client.builder()
            .region(Region.of(properties.region))
            .build()
}
