package com.uvg.wellnessapp.web;

import com.uvg.wellnessapp.security.AuthUtils;
import com.uvg.wellnessapp.service.AiInsightService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final AiInsightService aiService;

    public AiController(AiInsightService aiService) {
        this.aiService = aiService;
    }

    @GetMapping(value = "/insights", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getDashboardInsights(
            @RequestParam(defaultValue = "false") boolean refresh) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body("{\"error\":\"Not authenticated\"}");
        }
        String json = aiService.getDashboardInsights(userId, refresh);
        return ResponseEntity.ok(json);
    }

    @PostMapping(value = "/assessment-analysis", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getAssessmentAnalysis(@RequestBody AssessmentAnalysisRequest request) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body("{\"error\":\"Not authenticated\"}");
        }
        String json = aiService.getAssessmentAnalysis(
                userId, request.assessmentType, request.total, request.category, request.answers);
        return ResponseEntity.ok(json);
    }

    static final class AssessmentAnalysisRequest {
        public String assessmentType;
        public int total;
        public String category;
        public int[] answers;
    }
}
