package ae.fly.backend

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration

@SpringBootApplication(exclude = [UserDetailsServiceAutoConfiguration::class])
@ConfigurationPropertiesScan
class FlyAeApplication

fun main(args: Array<String>) {
    runApplication<FlyAeApplication>(*args)
}
