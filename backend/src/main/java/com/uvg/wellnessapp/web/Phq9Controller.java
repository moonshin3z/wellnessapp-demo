package com.uvg.wellnessapp.web;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.uvg.wellnessapp.domain.AssessmentResult;
import com.uvg.wellnessapp.service.AssessmentService;
import com.uvg.wellnessapp.service.Phq9Service;
import com.uvg.wellnessapp.security.AuthUtils;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/v1/assessments")
@Validated
public class Phq9Controller {

  private final AssessmentService assessments;
  private final Phq9Service phq9;

  public Phq9Controller(AssessmentService assessments, Phq9Service phq9) {
    this.assessments = assessments;
    this.phq9 = phq9;
  }

  // ===== DTOs =====
  public static final class Phq9Request {
    @NotNull @Size(min = 9, max = 9, message = "Se requieren 9 respuestas")
    public int[] answers;        // 9 ints 0..3
    public String notes;         // opcional
    public Long userId;          // opcional
    public Boolean save;         // opcional; default true
  }
  public static final class Phq9Response {
    public Long id; public String createdAt;
    public int total; public String category; public String message;
    public Phq9Response(Long id, String createdAt, int total, String category, String message) {
      this.id=id; this.createdAt=createdAt; this.total=total; this.category=category; this.message=message;
    }
  }

  // ===== Calcular y (por defecto) guardar =====
  @PostMapping("/phq9")
  public ResponseEntity<Phq9Response> score(@Valid @RequestBody Phq9Request req){
    boolean shouldSave = (req.save == null) ? true : req.save;
    var r = phq9.score(req.answers);
    if (shouldSave) {
      AssessmentResult ar = assessments.savePhq9(req.answers, req.notes, AuthUtils.resolveUserId(req.userId), phq9);
      return ResponseEntity.ok(new Phq9Response(ar.getId(), ar.getCreatedAt().toString(), r.total, r.category, r.message));
    } else {
      return ResponseEntity.ok(new Phq9Response(null, null, r.total, r.category, r.message));
    }
  }
}
