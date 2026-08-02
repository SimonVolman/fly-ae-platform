package ae.fly.backend.lambda

import ae.fly.backend.FlyAeApplication
import com.amazonaws.serverless.proxy.model.AwsProxyResponse
import com.amazonaws.serverless.proxy.model.HttpApiV2ProxyRequest
import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler
import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.RequestStreamHandler
import java.io.InputStream
import java.io.OutputStream

class StreamLambdaHandler : RequestStreamHandler {
    override fun handleRequest(input: InputStream, output: OutputStream, context: Context) {
        handler.proxyStream(input, output, context)
    }

    companion object {
        private val handler: SpringBootLambdaContainerHandler<HttpApiV2ProxyRequest, AwsProxyResponse> =
            SpringBootLambdaContainerHandler.getHttpApiV2ProxyHandler(FlyAeApplication::class.java)
    }
}
