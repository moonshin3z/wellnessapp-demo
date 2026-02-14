package com.uvg.wellnessapp.web;

import com.uvg.wellnessapp.domain.User;
import com.uvg.wellnessapp.domain.MoodEntry;
import com.uvg.wellnessapp.domain.AssessmentResult;
import com.uvg.wellnessapp.repository.UserRepository;
import com.uvg.wellnessapp.repository.MoodEntryRepository;
import com.uvg.wellnessapp.repository.AssessmentResultRepository;
import com.uvg.wellnessapp.security.AuthUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@RestController
@RequestMapping("/api/v1/user")
public class UserController {

    private final UserRepository userRepository;
    private final MoodEntryRepository moodEntryRepository;
    private final AssessmentResultRepository assessmentResultRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository,
                         MoodEntryRepository moodEntryRepository,
                         AssessmentResultRepository assessmentResultRepository,
                         PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.moodEntryRepository = moodEntryRepository;
        this.assessmentResultRepository = assessmentResultRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Get user profile information
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile() {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();
        Map<String, Object> profile = new HashMap<>();
        profile.put("id", user.getId());
        profile.put("email", user.getEmail());
        profile.put("role", user.getRole().name());
        profile.put("createdAt", user.getCreatedAt().toString());

        return ResponseEntity.ok(profile);
    }

    /**
     * Export all user data
     */
    @GetMapping("/export")
    public ResponseEntity<?> exportData() {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();

        // Get all mood entries
        List<MoodEntry> moodEntries = moodEntryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<Map<String, Object>> moodData = moodEntries.stream().map(entry -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", entry.getId());
            m.put("date", entry.getCreatedAt().toString());
            m.put("moodScore", entry.getMoodScore());
            m.put("notes", entry.getNotes());
            m.put("tags", entry.getTags());
            m.put("sleepHours", entry.getSleepHours());
            m.put("sleepQuality", entry.getSleepQuality());
            return m;
        }).toList();

        // Get all assessment results
        List<AssessmentResult> assessments = assessmentResultRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<Map<String, Object>> assessmentData = assessments.stream().map(result -> {
            Map<String, Object> a = new HashMap<>();
            a.put("id", result.getId());
            a.put("type", result.getAssessmentType());
            a.put("date", result.getCreatedAt().toString());
            a.put("total", result.getTotal());
            a.put("category", result.getCategory());
            a.put("notes", result.getNotes());
            return a;
        }).toList();

        // Build export object
        Map<String, Object> exportData = new LinkedHashMap<>();
        exportData.put("exportDate", java.time.LocalDateTime.now().toString());
        exportData.put("user", Map.of(
            "email", user.getEmail(),
            "memberSince", user.getCreatedAt().toString()
        ));
        exportData.put("moodEntries", moodData);
        exportData.put("assessments", assessmentData);
        exportData.put("statistics", Map.of(
            "totalMoodEntries", moodData.size(),
            "totalAssessments", assessmentData.size()
        ));

        return ResponseEntity.ok(exportData);
    }

    /**
     * Change password
     */
    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> request) {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        String currentPassword = request.get("currentPassword");
        String newPassword = request.get("newPassword");

        if (currentPassword == null || newPassword == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        }

        if (newPassword.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();

        // Verify current password
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Contraseña actual incorrecta"));
        }

        // Update password
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Password updated successfully"));
    }

    /**
     * Delete user account
     */
    @DeleteMapping("/account")
    @Transactional
    public ResponseEntity<?> deleteAccount() {
        Long userId = AuthUtils.resolveUserId(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        // Delete all user data
        moodEntryRepository.deleteByUserId(userId);
        assessmentResultRepository.deleteByUserId(userId);
        userRepository.deleteById(userId);

        return ResponseEntity.ok(Map.of("message", "Account deleted successfully"));
    }
}
