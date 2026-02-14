# WellnessApp

## Requisitos
- Java 21 (Temurin)
- Docker Desktop (y Docker Compose)
- VS Code (Extension Pack for Java)
- Maven

## Cómo correr 
```bash
docker compose up -d --build
# API:    http://localhost:8082/health  -> ok
# Web:    http://localhost:5173
```

 **solo DB en Docker** y **API local**:
```bash
docker compose up -d db
# en otra terminal
cd backend
mvn -Dspring-boot.run.profiles=local spring-boot:run
# API local: http://localhost:8080/health
```

## Estructura
```
backend/  -> Spring Boot 3.3 (Java 21)
frontend/ -> estáticos (Nginx)
docker-compose.yml -> DB (5432), API (8082), Web (5173)
```


## Notas
- CORS habilitado para `http://localhost:5173`.
