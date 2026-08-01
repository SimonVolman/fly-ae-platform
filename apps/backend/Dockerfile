FROM gradle:8.14.3-jdk21 AS build

WORKDIR /workspace
COPY apps/backend ./apps/backend
COPY docs/api/openapi.yaml ./docs/api/openapi.yaml
RUN gradle -p apps/backend bootJar --no-daemon

FROM eclipse-temurin:21-jre

RUN useradd --system --uid 10001 --create-home flyae
WORKDIR /app
COPY --from=build /workspace/apps/backend/build/libs/fly-ae-backend-0.1.0.jar /app/backend.jar
USER flyae
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/backend.jar"]
