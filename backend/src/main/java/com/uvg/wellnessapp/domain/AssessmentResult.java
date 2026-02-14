package com.uvg.wellnessapp.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "assessment_results")
public class AssessmentResult {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt = LocalDateTime.now();

  @Column(name = "assessment_type", nullable = false)
  private String assessmentType;

  @Column(nullable = false)
  private Integer total;

  @Column(nullable = false)
  private String category;

  private String notes;

  @Column(name = "user_id")
  private Long userId;

  public Long getId() { return id; }
  public LocalDateTime getCreatedAt() { return createdAt; }
  public String getAssessmentType() { return assessmentType; }
  public Integer getTotal() { return total; }
  public String getCategory() { return category; }
  public String getNotes() { return notes; }
  public Long getUserId() { return userId; }

  public void setId(Long id) { this.id = id; }
  public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
  public void setAssessmentType(String assessmentType) { this.assessmentType = assessmentType; }
  public void setTotal(Integer total) { this.total = total; }
  public void setCategory(String category) { this.category = category; }
  public void setNotes(String notes) { this.notes = notes; }
  public void setUserId(Long userId) { this.userId = userId; }
}
