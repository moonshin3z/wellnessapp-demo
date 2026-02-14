# ===== BUILD STAGE =====
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copiar pom y descargar dependencias sin compilar el proyecto aún
COPY pom.xml .
RUN mvn -q -DskipTests dependency:resolve

# Copiar el código fuente y compilar
COPY src ./src
RUN mvn -q -DskipTests package

# ===== RUNTIME STAGE =====
FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8082
ENTRYPOINT ["java","-jar","/app/app.jar"]
