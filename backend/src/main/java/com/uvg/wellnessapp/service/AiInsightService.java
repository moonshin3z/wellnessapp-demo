package com.uvg.wellnessapp.service;

import com.uvg.wellnessapp.domain.AssessmentResult;
import com.uvg.wellnessapp.domain.MoodEntry;
import com.uvg.wellnessapp.repository.AssessmentResultRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AiInsightService {

    private static final Logger log = LoggerFactory.getLogger(AiInsightService.class);
    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL = "claude-haiku-4-5-20251001";
    private static final long CACHE_TTL_MS = 24 * 60 * 60 * 1000L;
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final String SYSTEM_PROMPT = """
            Eres un asistente de bienestar emocional. NO eres un profesional de salud mental.
            Tus respuestas son orientativas y NO constituyen consejo médico.
            Siempre recomienda consultar con un profesional de salud mental cuando sea apropiado.
            Responde siempre en español.
            Devuelve tu respuesta SOLO como un objeto JSON válido, sin markdown, sin backticks, sin texto adicional.
            Sé empático, cálido y constructivo en tu tono.""";

    private static final String DISCLAIMER = "Este análisis es orientativo y no constituye consejo médico. Consulta siempre con un profesional de salud mental.";

    @Value("${anthropic.api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate;
    private final AssessmentResultRepository assessmentRepo;
    private final MoodService moodService;
    private final ObjectMapper objectMapper;

    private final ConcurrentHashMap<Long, CachedInsight> cache = new ConcurrentHashMap<>();

    record CachedInsight(String json, long createdAt) {}

    public AiInsightService(RestTemplate restTemplate,
                            AssessmentResultRepository assessmentRepo,
                            MoodService moodService) {
        this.restTemplate = restTemplate;
        this.assessmentRepo = assessmentRepo;
        this.moodService = moodService;
        this.objectMapper = new ObjectMapper();
    }

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String getDashboardInsights(Long userId, boolean forceRefresh) {
        if (!isAvailable()) {
            return "{\"disponible\":false,\"mensaje\":\"IA no configurada.\"}";
        }

        if (!forceRefresh) {
            CachedInsight cached = cache.get(userId);
            if (cached != null && (System.currentTimeMillis() - cached.createdAt) < CACHE_TTL_MS) {
                return cached.json;
            }
        }

        List<MoodEntry> moods = moodService.getRecentMoods(userId, 30);
        List<AssessmentResult> assessments = assessmentRepo.findByUserIdOrderByCreatedAtDesc(userId);
        MoodService.MoodStats stats = moodService.getStats(userId, 30);

        if (moods.isEmpty()) {
            return "{\"disponible\":true,\"sinDatos\":true,\"mensaje\":\"Registra al menos algunos días de ánimo para obtener perspectivas personalizadas.\"}";
        }

        String prompt = buildDashboardPrompt(moods, assessments, stats);

        try {
            String response = callClaude(prompt);
            cache.put(userId, new CachedInsight(response, System.currentTimeMillis()));
            return response;
        } catch (Exception e) {
            log.error("Error calling Claude API for dashboard insights", e);
            return "{\"disponible\":true,\"error\":true,\"mensaje\":\"No se pudo generar el análisis en este momento.\"}";
        }
    }

    public String getAssessmentAnalysis(Long userId, String assessmentType, int total, String category, int[] answers) {
        if (!isAvailable()) {
            return "{\"disponible\":false}";
        }

        List<AssessmentResult> history = assessmentRepo.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .filter(a -> a.getAssessmentType().equalsIgnoreCase(assessmentType))
                .toList();

        String prompt = buildAssessmentPrompt(assessmentType, total, category, answers, history);

        try {
            return callClaude(prompt);
        } catch (Exception e) {
            log.error("Error calling Claude API for assessment analysis", e);
            return "{\"disponible\":true,\"error\":true,\"mensaje\":\"No se pudo generar el análisis.\"}";
        }
    }

    private String buildDashboardPrompt(List<MoodEntry> moods, List<AssessmentResult> assessments, MoodService.MoodStats stats) {
        StringBuilder sb = new StringBuilder();
        sb.append("Analiza los siguientes datos de bienestar de un usuario y proporciona perspectivas personalizadas.\n\n");

        sb.append("DATOS DE ÁNIMO (últimos 30 días):\n[");
        for (int i = 0; i < moods.size(); i++) {
            MoodEntry m = moods.get(i);
            if (i > 0) sb.append(",");
            sb.append(String.format("{\"fecha\":\"%s\",\"puntuacion\":%d",
                    m.getCreatedAt().format(DATE_FMT), m.getMoodScore()));
            if (m.getTags() != null) sb.append(",\"tags\":\"").append(m.getTags()).append("\"");
            if (m.getSleepHours() != null) sb.append(",\"horasSueno\":").append(m.getSleepHours());
            if (m.getSleepQuality() != null) sb.append(",\"calidadSueno\":").append(m.getSleepQuality());
            sb.append("}");
        }
        sb.append("]\n\n");

        sb.append(String.format("ESTADÍSTICAS:\n- Promedio: %.1f\n- Tendencia: %+.2f (%s)\n- Racha actual: %d días\n- Entradas totales: %d\n\n",
                stats.average(), stats.trend(), stats.trend() > 0.1 ? "mejorando" : stats.trend() < -0.1 ? "empeorando" : "estable",
                stats.currentStreak(), stats.totalEntries()));

        if (!assessments.isEmpty()) {
            sb.append("EVALUACIONES RECIENTES:\n[");
            int count = 0;
            for (AssessmentResult a : assessments) {
                if (count >= 8) break;
                if (count > 0) sb.append(",");
                sb.append(String.format("{\"tipo\":\"%s\",\"puntaje\":%d,\"categoria\":\"%s\",\"fecha\":\"%s\"}",
                        a.getAssessmentType(), a.getTotal(), a.getCategory(),
                        a.getCreatedAt().format(DATE_FMT)));
                count++;
            }
            sb.append("]\n\n");
        }

        sb.append("""
                CONTEXTO DE ESCALAS:
                - GAD-7 (ansiedad): 0-4 mínima, 5-9 leve, 10-14 moderada, 15-21 severa
                - PHQ-9 (depresión): 0-4 mínima, 5-9 leve, 10-14 moderada, 15-19 moderadamente severa, 20-27 severa

                Responde SOLO con un objeto JSON con esta estructura exacta (sin backticks ni markdown):
                {
                  "patrones": "Descripción de patrones detectados en 2-3 oraciones",
                  "correlacionSueno": "Análisis de la relación sueño-ánimo en 1-2 oraciones",
                  "analisisTags": "Análisis de actividades y su impacto en 1-2 oraciones",
                  "recomendaciones": ["recomendación 1 concreta", "recomendación 2 concreta", "recomendación 3 concreta"],
                  "riesgo": {"nivel": "bajo|medio|alto", "mensaje": "Mensaje empático sobre el estado general"},
                  "disclaimer": "%s"
                }""".formatted(DISCLAIMER));

        return sb.toString();
    }

    private String buildAssessmentPrompt(String type, int total, String category, int[] answers, List<AssessmentResult> history) {
        String typeName = type.equalsIgnoreCase("GAD7") ? "GAD-7 (ansiedad generalizada)" : "PHQ-9 (depresión)";
        int maxScore = type.equalsIgnoreCase("GAD7") ? 21 : 27;

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Un usuario completó una evaluación %s.\n\n", typeName));
        sb.append(String.format("RESULTADO ACTUAL:\n- Puntaje: %d/%d\n- Categoría: %s\n- Respuestas: %s\n\n",
                total, maxScore, category, Arrays.toString(answers)));

        if (history.size() > 1) {
            sb.append("HISTORIAL PREVIO:\n[");
            int count = 0;
            for (AssessmentResult h : history) {
                if (count >= 5) break;
                if (count > 0) sb.append(",");
                sb.append(String.format("{\"puntaje\":%d,\"categoria\":\"%s\",\"fecha\":\"%s\"}",
                        h.getTotal(), h.getCategory(), h.getCreatedAt().format(DATE_FMT)));
                count++;
            }
            sb.append("]\n\n");
        } else {
            sb.append("HISTORIAL: Esta es la primera evaluación del usuario.\n\n");
        }

        if (type.equalsIgnoreCase("GAD7")) {
            sb.append("PREGUNTAS GAD-7: 1) Nerviosismo, 2) Preocupación incontrolable, 3) Preocupación excesiva, 4) Dificultad para relajarse, 5) Inquietud, 6) Irritabilidad, 7) Miedo\n\n");
        } else {
            sb.append("PREGUNTAS PHQ-9: 1) Poco interés, 2) Tristeza, 3) Problemas de sueño, 4) Fatiga, 5) Apetito, 6) Sentirse mal consigo mismo, 7) Concentración, 8) Lentitud/agitación, 9) Pensamientos de autolesión\n\n");
            if (answers.length >= 9 && answers[8] >= 2) {
                sb.append("⚠️ IMPORTANTE: La pregunta 9 sobre pensamientos de autolesión tiene un puntaje elevado. Incluye en tu respuesta una recomendación enfática de buscar ayuda profesional inmediata.\n\n");
            }
        }

        sb.append("""
                Responde SOLO con un objeto JSON con esta estructura exacta (sin backticks ni markdown):
                {
                  "analisis": "Análisis detallado del resultado en 2-3 oraciones",
                  "comparacion": "Comparación con resultados anteriores o nota de primera evaluación",
                  "areasPreocupacion": ["área 1", "área 2"],
                  "areasMejora": ["área positiva 1", "área positiva 2"],
                  "recomendaciones": ["recomendación concreta 1", "recomendación concreta 2", "recomendación concreta 3"],
                  "disclaimer": "%s"
                }""".formatted(DISCLAIMER));

        return sb.toString();
    }

    private String callClaude(String userMessage) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", MODEL);
        body.put("max_tokens", 1024);
        body.put("system", SYSTEM_PROMPT);
        body.put("messages", List.of(Map.of("role", "user", "content", userMessage)));

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        ResponseEntity<String> response = restTemplate.exchange(
                CLAUDE_API_URL, HttpMethod.POST, request, String.class);

        // Extract content[0].text from the response
        JsonNode root = parseJson(response.getBody());
        JsonNode content = root.path("content");
        if (content.isArray() && !content.isEmpty()) {
            String text = content.get(0).path("text").asText();
            // Validate it's valid JSON
            parseJson(text);
            return text;
        }

        throw new RuntimeException("Unexpected Claude API response format");
    }

    private JsonNode parseJson(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException("Invalid JSON response from AI", e);
        }
    }
}
