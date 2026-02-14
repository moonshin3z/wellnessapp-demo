package com.uvg.wellnessapp.repository;

import com.uvg.wellnessapp.domain.MoodEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface MoodEntryRepository extends JpaRepository<MoodEntry, Long> {

    // Find entries by user, ordered by date descending
    List<MoodEntry> findByUserIdOrderByCreatedAtDesc(Long userId);

    // Paginated version
    Page<MoodEntry> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    // Find entries within a date range
    List<MoodEntry> findByUserIdAndCreatedAtBetweenOrderByCreatedAtDesc(
            Long userId, LocalDateTime start, LocalDateTime end);

    // Find today's entry for a user (to check if already logged today)
    @Query("SELECT m FROM MoodEntry m WHERE m.userId = :userId AND m.createdAt >= :startOfDay ORDER BY m.createdAt DESC")
    List<MoodEntry> findTodayEntries(@Param("userId") Long userId, @Param("startOfDay") LocalDateTime startOfDay);

    // Get average mood score for a user over a period
    @Query("SELECT AVG(m.moodScore) FROM MoodEntry m WHERE m.userId = :userId AND m.createdAt >= :since")
    Optional<Double> getAverageMoodScore(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    // Count entries for a user
    long countByUserId(Long userId);

    // Get the last N entries for a user
    List<MoodEntry> findTop7ByUserIdOrderByCreatedAtDesc(Long userId);

    // Get entries for the last N days
    @Query("SELECT m FROM MoodEntry m WHERE m.userId = :userId AND m.createdAt >= :since ORDER BY m.createdAt DESC")
    List<MoodEntry> findRecentEntries(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    // Delete all entries for a user
    void deleteByUserId(Long userId);
}
