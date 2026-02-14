package com.uvg.wellnessapp.service;

import com.uvg.wellnessapp.domain.AssessmentResult;
import com.uvg.wellnessapp.repository.AssessmentResultRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true) // Default to read-only for query methods
public class AssessmentService {

  private final AssessmentResultRepository repo;
  private final Gad7Service gad7;

  public AssessmentService(AssessmentResultRepository repo, Gad7Service gad7) {
    this.repo = repo;
    this.gad7 = gad7;
  }

  @Transactional // Write operation - override class-level readOnly
  public AssessmentResult saveGad7(int[] answers, String notes, Long userId) {
    var r = gad7.score(answers);
    var ar = new AssessmentResult();
    ar.setAssessmentType("GAD7");
    ar.setTotal(r.total);
    ar.setCategory(r.category);
    ar.setNotes(notes);
    ar.setUserId(userId);
    return repo.save(ar);
  }

  @Transactional // Write operation
  public AssessmentResult savePhq9(int[] answers, String notes, Long userId, Phq9Service phq9) {
    var r = phq9.score(answers);
    var ar = new AssessmentResult();
    ar.setAssessmentType("PHQ9");
    ar.setTotal(r.total);
    ar.setCategory(r.category);
    ar.setNotes(notes);
    ar.setUserId(userId);
    return repo.save(ar);
  }

  public List<AssessmentResult> listAll() {
    return repo.findAllByOrderByCreatedAtDesc();
  }

  public List<AssessmentResult> listByUser(Long userId) {
    return repo.findByUserIdOrderByCreatedAtDesc(userId);
  }

  // Paginated versions for better performance with large datasets
  public Page<AssessmentResult> listAllPaged(Pageable pageable) {
    return repo.findAllByOrderByCreatedAtDesc(pageable);
  }

  public Page<AssessmentResult> listByUserPaged(Long userId, Pageable pageable) {
    return repo.findByUserIdOrderByCreatedAtDesc(userId, pageable);
  }
}
