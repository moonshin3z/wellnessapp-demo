package com.uvg.wellnessapp.web;

import com.uvg.wellnessapp.security.AuthUtils;
import com.uvg.wellnessapp.service.AiInsightService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final AiInsightService aiService;

    public AiController(AiInsightService aiService) {
        this.aiService = aiService;
    }

    @GetMapping("/insights")
    public ResponseEntity<?> getDashboardInsights(
            @RequestParam(defaultValue = "false") boolean refresh) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        String json = aiService.getDashboardInsights(userId, refresh);
        return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(json);
    }

    @PostMapping("/assessment-analysis")
    public ResponseEntity<?> getAssessmentAnalysis(@RequestBody AssessmentAnalysisRequest request) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        String json = aiService.getAssessmentAnalysis(
                userId, request.assessmentType, request.total, request.category, request.answers);
        return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(json);
    }

    static final class AssessmentAnalysisRequest {
        public String assessmentType;
        public int total;
        public String category;
        public int[] answers;
    }
}
