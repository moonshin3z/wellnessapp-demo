package com.uvg.wellnessapp.service;

import com.uvg.wellnessapp.domain.MoodEntry;
import com.uvg.wellnessapp.repository.MoodEntryRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class MoodService {

    private final MoodEntryRepository repository;

    // Emoji mapping for mood scores
    private static final String[] MOOD_EMOJIS = {"", "😢", "😔", "😐", "😊", "😄"};

    public MoodService(MoodEntryRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public MoodEntry logMood(Long userId, int moodScore, String notes, String tags, Double sleepHours, Integer sleepQuality) {
        if (moodScore < 1 || moodScore > 5) {
            throw new IllegalArgumentException("Mood score must be between 1 and 5");
        }
        if (sleepQuality != null && (sleepQuality < 1 || sleepQuality > 5)) {
            throw new IllegalArgumentException("Sleep quality must be between 1 and 5");
        }
        if (sleepHours != null && (sleepHours < 0 || sleepHours > 24)) {
            throw new IllegalArgumentException("Sleep hours must be between 0 and 24");
        }

        MoodEntry entry = new MoodEntry();
        entry.setUserId(userId);
        entry.setMoodScore(moodScore);
        entry.setMoodEmoji(MOOD_EMOJIS[moodScore]);
        entry.setNotes(notes != null ? notes.trim() : null);
        entry.setTags(tags != null ? tags.trim() : null);
        entry.setSleepHours(sleepHours);
        entry.setSleepQuality(sleepQuality);

        return repository.save(entry);
    }

    public List<MoodEntry> getUserMoods(Long userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public Page<MoodEntry> getUserMoodsPaged(Long userId, Pageable pageable) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    public List<MoodEntry> getRecentMoods(Long userId, int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        return repository.findRecentEntries(userId, since);
    }

    public List<MoodEntry> getLast7Entries(Long userId) {
        return repository.findTop7ByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<MoodEntry> getEntriesForDateRange(Long userId, LocalDateTime start, LocalDateTime end) {
        return repository.findByUserIdAndCreatedAtBetweenOrderByCreatedAtDesc(userId, start, end);
    }

    public Optional<MoodEntry> getTodaysMood(Long userId) {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        List<MoodEntry> todayEntries = repository.findTodayEntries(userId, startOfDay);
        return todayEntries.isEmpty() ? Optional.empty() : Optional.of(todayEntries.get(0));
    }

    public boolean hasLoggedToday(Long userId) {
        return getTodaysMood(userId).isPresent();
    }

    public MoodStats getStats(Long userId, int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        List<MoodEntry> entries = repository.findRecentEntries(userId, since);

        // Calculate streak
        int currentStreak = calculateStreak(userId);
        int longestStreak = calculateLongestStreak(userId);

        if (entries.isEmpty()) {
            return new MoodStats(0, 0, 0, 0, 0, currentStreak, longestStreak);
        }

        double sum = 0;
        int min = 5;
        int max = 1;

        for (MoodEntry entry : entries) {
            int score = entry.getMoodScore();
            sum += score;
            if (score < min) min = score;
            if (score > max) max = score;
        }

        double average = sum / entries.size();

        // Calculate trend (compare first half to second half)
        int halfSize = entries.size() / 2;
        double trend = 0;
        if (halfSize > 0) {
            double recentAvg = entries.subList(0, halfSize).stream()
                    .mapToInt(MoodEntry::getMoodScore).average().orElse(0);
            double olderAvg = entries.subList(halfSize, entries.size()).stream()
                    .mapToInt(MoodEntry::getMoodScore).average().orElse(0);
            trend = recentAvg - olderAvg;
        }

        return new MoodStats(entries.size(), average, min, max, trend, currentStreak, longestStreak);
    }

    /**
     * Calculate the current streak of consecutive days with mood entries.
     * A streak continues if there's at least one entry per day.
     */
    public int calculateStreak(Long userId) {
        List<MoodEntry> allEntries = repository.findByUserIdOrderByCreatedAtDesc(userId);
        if (allEntries.isEmpty()) {
            return 0;
        }

        int streak = 0;
        LocalDate checkDate = LocalDate.now();
        LocalDate lastEntryDate = allEntries.get(0).getCreatedAt().toLocalDate();

        // If the user hasn't logged today, check if they logged yesterday to continue the streak
        if (!lastEntryDate.equals(checkDate)) {
            if (!lastEntryDate.equals(checkDate.minusDays(1))) {
                // Last entry was more than 1 day ago, streak is broken
                return 0;
            }
            // Start checking from yesterday
            checkDate = checkDate.minusDays(1);
        }

        // Count consecutive days
        for (MoodEntry entry : allEntries) {
            LocalDate entryDate = entry.getCreatedAt().toLocalDate();

            if (entryDate.equals(checkDate)) {
                // Entry on the expected day, continue
                streak++;
                checkDate = checkDate.minusDays(1);
            } else if (entryDate.isBefore(checkDate)) {
                // Gap in days, streak is broken
                break;
            }
            // If entryDate is after checkDate, it's a duplicate entry for the same day, skip
        }

        return streak;
    }

    /**
     * Calculate the longest streak ever achieved by the user.
     */
    public int calculateLongestStreak(Long userId) {
        List<MoodEntry> allEntries = repository.findByUserIdOrderByCreatedAtDesc(userId);
        if (allEntries.isEmpty()) {
            return 0;
        }

        int longestStreak = 0;
        int currentStreak = 1;
        LocalDate previousDate = null;

        // Get unique dates in ascending order
        List<LocalDate> uniqueDates = allEntries.stream()
                .map(e -> e.getCreatedAt().toLocalDate())
                .distinct()
                .sorted()
                .toList();

        for (int i = 0; i < uniqueDates.size(); i++) {
            if (i == 0) {
                previousDate = uniqueDates.get(i);
                currentStreak = 1;
            } else {
                LocalDate currentDate = uniqueDates.get(i);
                if (currentDate.equals(previousDate.plusDays(1))) {
                    // Consecutive day
                    currentStreak++;
                } else {
                    // Gap, reset streak
                    if (currentStreak > longestStreak) {
                        longestStreak = currentStreak;
                    }
                    currentStreak = 1;
                }
                previousDate = currentDate;
            }
        }

        // Check the last streak
        if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
        }

        return longestStreak;
    }

    @Transactional
    public MoodEntry updateMood(Long moodId, Long userId, int moodScore, String notes, String tags, Double sleepHours, Integer sleepQuality) {
        if (moodScore < 1 || moodScore > 5) {
            throw new IllegalArgumentException("Mood score must be between 1 and 5");
        }
        if (sleepQuality != null && (sleepQuality < 1 || sleepQuality > 5)) {
            throw new IllegalArgumentException("Sleep quality must be between 1 and 5");
        }

        return repository.findById(moodId)
            .filter(entry -> entry.getUserId().equals(userId))
            .map(entry -> {
                entry.setMoodScore(moodScore);
                entry.setMoodEmoji(MOOD_EMOJIS[moodScore]);
                entry.setNotes(notes != null ? notes.trim() : null);
                entry.setTags(tags != null ? tags.trim() : null);
                entry.setSleepHours(sleepHours);
                entry.setSleepQuality(sleepQuality);
                return repository.save(entry);
            })
            .orElse(null);
    }

    @Transactional
    public void deleteMood(Long moodId, Long userId) {
        repository.findById(moodId).ifPresent(entry -> {
            if (entry.getUserId().equals(userId)) {
                repository.delete(entry);
            }
        });
    }

    // Stats record
    public record MoodStats(int totalEntries, double average, int min, int max, double trend, int currentStreak, int longestStreak) {}
}
