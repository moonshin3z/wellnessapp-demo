package com.uvg.wellnessapp.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "mood_entries")
public class MoodEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "mood_score", nullable = false)
    private Integer moodScore; // 1-5 scale: 1=very bad, 2=bad, 3=neutral, 4=good, 5=great

    @Column(name = "mood_emoji")
    private String moodEmoji; // Visual representation

    @Column(length = 500)
    private String notes; // Optional notes

    @Column(length = 200)
    private String tags; // Comma-separated tag IDs (e.g., "sleep,exercise,social")

    @Column(name = "sleep_hours")
    private Double sleepHours; // Hours of sleep (e.g., 7.5)

    @Column(name = "sleep_quality")
    private Integer sleepQuality; // 1-5 scale: 1=very poor, 5=excellent

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // Getters
    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Integer getMoodScore() { return moodScore; }
    public String getMoodEmoji() { return moodEmoji; }
    public String getNotes() { return notes; }
    public String getTags() { return tags; }
    public Double getSleepHours() { return sleepHours; }
    public Integer getSleepQuality() { return sleepQuality; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    // Setters
    public void setId(Long id) { this.id = id; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setMoodScore(Integer moodScore) { this.moodScore = moodScore; }
    public void setMoodEmoji(String moodEmoji) { this.moodEmoji = moodEmoji; }
    public void setNotes(String notes) { this.notes = notes; }
    public void setTags(String tags) { this.tags = tags; }
    public void setSleepHours(Double sleepHours) { this.sleepHours = sleepHours; }
    public void setSleepQuality(Integer sleepQuality) { this.sleepQuality = sleepQuality; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    // Helper method to get mood label
    public String getMoodLabel() {
        return switch (moodScore) {
            case 1 -> "Very Bad";
            case 2 -> "Bad";
            case 3 -> "Neutral";
            case 4 -> "Good";
            case 5 -> "Great";
            default -> "Unknown";
        };
    }
}
