package com.uvg.wellnessapp.repository;

import com.uvg.wellnessapp.domain.AssessmentResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssessmentResultRepository extends JpaRepository<AssessmentResult, Long> {
  // Non-paginated (for backwards compatibility)
  List<AssessmentResult> findAllByOrderByCreatedAtDesc();
  List<AssessmentResult> findByUserIdOrderByCreatedAtDesc(Long userId);

  // Paginated versions for better performance with large datasets
  Page<AssessmentResult> findAllByOrderByCreatedAtDesc(Pageable pageable);
  Page<AssessmentResult> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

  // Delete all results for a user
  void deleteByUserId(Long userId);
}
