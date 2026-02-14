package com.uvg.wellnessapp.web;

import com.uvg.wellnessapp.domain.MoodEntry;
import com.uvg.wellnessapp.security.AuthUtils;
import com.uvg.wellnessapp.service.MoodService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/mood")
@Validated
public class MoodController {

    private final MoodService moodService;

    public MoodController(MoodService moodService) {
        this.moodService = moodService;
    }

    // ===== DTOs =====
    public static final class LogMoodRequest {
        @Min(value = 1, message = "Mood score must be at least 1")
        @Max(value = 5, message = "Mood score must be at most 5")
        public int score;

        @Size(max = 500, message = "Notes cannot exceed 500 characters")
        public String notes;

        @Size(max = 200, message = "Tags cannot exceed 200 characters")
        public String tags; // Comma-separated tag IDs

        @Min(value = 0, message = "Sleep hours cannot be negative")
        @Max(value = 24, message = "Sleep hours cannot exceed 24")
        public Double sleepHours;

        @Min(value = 1, message = "Sleep quality must be at least 1")
        @Max(value = 5, message = "Sleep quality must be at most 5")
        public Integer sleepQuality;
    }

    public static final class MoodResponse {
        public Long id;
        public int score;
        public String emoji;
        public String label;
        public String notes;
        public String tags;
        public Double sleepHours;
        public Integer sleepQuality;
        public String createdAt;

        public MoodResponse(MoodEntry entry) {
            this.id = entry.getId();
            this.score = entry.getMoodScore();
            this.emoji = entry.getMoodEmoji();
            this.label = entry.getMoodLabel();
            this.notes = entry.getNotes();
            this.tags = entry.getTags();
            this.sleepHours = entry.getSleepHours();
            this.sleepQuality = entry.getSleepQuality();
            this.createdAt = entry.getCreatedAt().toString();
        }
    }

    public static final class MoodStatsResponse {
        public int totalEntries;
        public double average;
        public int min;
        public int max;
        public double trend; // positive = improving, negative = declining
        public String trendLabel;
        public int currentStreak;
        public int longestStreak;

        public MoodStatsResponse(MoodService.MoodStats stats) {
            this.totalEntries = stats.totalEntries();
            this.average = Math.round(stats.average() * 100.0) / 100.0;
            this.min = stats.min();
            this.max = stats.max();
            this.trend = Math.round(stats.trend() * 100.0) / 100.0;
            this.trendLabel = stats.trend() > 0.2 ? "improving" :
                              stats.trend() < -0.2 ? "declining" : "stable";
            this.currentStreak = stats.currentStreak();
            this.longestStreak = stats.longestStreak();
        }
    }

    public static final class PagedMoodResponse {
        public List<MoodResponse> content;
        public int page;
        public int size;
        public long totalElements;
        public int totalPages;

        public PagedMoodResponse(Page<MoodEntry> page) {
            this.content = page.getContent().stream().map(MoodResponse::new).toList();
            this.page = page.getNumber();
            this.size = page.getSize();
            this.totalElements = page.getTotalElements();
            this.totalPages = page.getTotalPages();
        }
    }

    // ===== Endpoints =====

    /**
     * Log a new mood entry
     */
    @PostMapping
    public ResponseEntity<?> logMood(@Valid @RequestBody LogMoodRequest request) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        MoodEntry entry = moodService.logMood(userId, request.score, request.notes, request.tags, request.sleepHours, request.sleepQuality);
        return ResponseEntity.status(201).body(new MoodResponse(entry));
    }

    /**
     * Get today's mood (if logged)
     */
    @GetMapping("/today")
    public ResponseEntity<?> getTodaysMood() {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        return moodService.getTodaysMood(userId)
                .map(entry -> ResponseEntity.ok(new MoodResponse(entry)))
                .orElse(ResponseEntity.ok().body(null));
    }

    /**
     * Check if user has logged mood today
     */
    @GetMapping("/today/check")
    public ResponseEntity<?> hasLoggedToday() {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        boolean hasLogged = moodService.hasLoggedToday(userId);
        return ResponseEntity.ok(Map.of("hasLogged", hasLogged));
    }

    /**
     * Get recent mood entries (last 7)
     */
    @GetMapping("/recent")
    public ResponseEntity<?> getRecentMoods() {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        List<MoodEntry> entries = moodService.getLast7Entries(userId);
        List<MoodResponse> responses = entries.stream().map(MoodResponse::new).toList();
        return ResponseEntity.ok(responses);
    }

    /**
     * Get mood history (paginated)
     */
    @GetMapping("/history")
    public ResponseEntity<?> getMoodHistory(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Page<MoodEntry> entries = moodService.getUserMoodsPaged(userId, PageRequest.of(page, size));
        return ResponseEntity.ok(new PagedMoodResponse(entries));
    }

    /**
     * Get mood statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getMoodStats(
            @RequestParam(defaultValue = "30") @Min(1) @Max(365) int days
    ) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        MoodService.MoodStats stats = moodService.getStats(userId, days);
        return ResponseEntity.ok(new MoodStatsResponse(stats));
    }

    /**
     * Get mood entries for a calendar month
     */
    @GetMapping("/calendar")
    public ResponseEntity<?> getCalendarData(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month
    ) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        // Default to current month
        LocalDate now = LocalDate.now();
        int targetYear = (year != null) ? year : now.getYear();
        int targetMonth = (month != null) ? month : now.getMonthValue();

        // Validate month range
        if (targetMonth < 1 || targetMonth > 12) {
            return ResponseEntity.badRequest().body(Map.of("error", "Month must be between 1 and 12"));
        }

        YearMonth yearMonth = YearMonth.of(targetYear, targetMonth);
        LocalDateTime start = yearMonth.atDay(1).atStartOfDay();
        LocalDateTime end = yearMonth.atEndOfMonth().atTime(23, 59, 59);

        List<MoodEntry> entries = moodService.getEntriesForDateRange(userId, start, end);

        // Group entries by date (only keep the first entry per day)
        Map<String, Map<String, Object>> entriesByDate = new HashMap<>();
        for (MoodEntry entry : entries) {
            String dateKey = entry.getCreatedAt().toLocalDate().toString();
            if (!entriesByDate.containsKey(dateKey)) {
                Map<String, Object> dayData = new HashMap<>();
                dayData.put("id", entry.getId());
                dayData.put("score", entry.getMoodScore());
                dayData.put("emoji", entry.getMoodEmoji());
                dayData.put("label", entry.getMoodLabel());
                dayData.put("notes", entry.getNotes());
                dayData.put("tags", entry.getTags());
                dayData.put("sleepHours", entry.getSleepHours());
                dayData.put("sleepQuality", entry.getSleepQuality());
                entriesByDate.put(dateKey, dayData);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("year", targetYear);
        response.put("month", targetMonth);
        response.put("entries", entriesByDate);

        return ResponseEntity.ok(response);
    }

    /**
     * Update a mood entry
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateMood(@PathVariable Long id, @Valid @RequestBody LogMoodRequest request) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        MoodEntry entry = moodService.updateMood(id, userId, request.score, request.notes, request.tags, request.sleepHours, request.sleepQuality);
        if (entry == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Mood entry not found"));
        }
        return ResponseEntity.ok(new MoodResponse(entry));
    }

    /**
     * Delete a mood entry
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteMood(@PathVariable Long id) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        moodService.deleteMood(id, userId);
        return ResponseEntity.noContent().build();
    }
}
