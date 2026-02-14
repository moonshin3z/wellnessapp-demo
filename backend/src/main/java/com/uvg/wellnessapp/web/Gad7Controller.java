package com.uvg.wellnessapp.web;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.uvg.wellnessapp.domain.AssessmentResult;
import com.uvg.wellnessapp.service.AssessmentService;
import com.uvg.wellnessapp.service.Gad7Service;
import com.uvg.wellnessapp.security.AuthUtils;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/v1/assessments")
@Validated
public class Gad7Controller {

  private final AssessmentService assessmentService;
  private final Gad7Service gad7;

  public Gad7Controller(AssessmentService assessmentService, Gad7Service gad7) {
    this.assessmentService = assessmentService;
    this.gad7 = gad7;
  }

  // ===== DTOs =====
  public static final class Gad7Request {
    @NotNull @Size(min = 7, max = 7, message = "Se requieren 7 respuestas")
    public int[] answers;        // 7 ints 0..3
    public String notes;         // opcional
    public Long userId;          // opcional
    public Boolean save;         // opcional; default true
  }
  public static final class Gad7Response {
    public Long id; public String createdAt;
    public int total; public String category; public String message;
    public Gad7Response(Long id, String createdAt, int total, String category, String message) {
      this.id = id; this.createdAt = createdAt; this.total = total; this.category = category; this.message = message;
    }
  }

  // ===== Calcular y (por defecto) guardar =====
  @PostMapping("/gad7")
  public ResponseEntity<Gad7Response> score(@Valid @RequestBody Gad7Request req){
    boolean shouldSave = (req.save == null) ? true : req.save;
    Long userId = AuthUtils.resolveUserId(req.userId);
    if (shouldSave) {
      AssessmentResult ar = assessmentService.saveGad7(req.answers, req.notes, userId);
      var r = gad7.score(req.answers);
      return ResponseEntity.ok(new Gad7Response(
          ar.getId(),
          ar.getCreatedAt().toString(),
          r.total, r.category, r.message
      ));
    } else {
      var r = gad7.score(req.answers);
      return ResponseEntity.ok(new Gad7Response(
          null, null, r.total, r.category, r.message
      ));
    }
  }

  // ===== Historial (global o por userId) =====
  public static final class HistoryItem {
    public Long id; public String createdAt; public String type;
    public int total; public String category; public String notes; public Long userId;
    public HistoryItem(AssessmentResult a) {
      this.id = a.getId();
      this.createdAt = a.getCreatedAt().toString();
      this.type = a.getAssessmentType();
      this.total = a.getTotal();
      this.category = a.getCategory();
      this.notes = a.getNotes();
      this.userId = a.getUserId();
    }
  }

  // Non-paginated history (backwards compatible)
  @GetMapping("/history")
  public ResponseEntity<List<HistoryItem>> history(@RequestParam(required = false) Long userId) {
    Long resolvedUserId = AuthUtils.resolveUserId(userId);
    List<AssessmentResult> list = (resolvedUserId == null)
        ? assessmentService.listAll()
        : assessmentService.listByUser(resolvedUserId);
    return ResponseEntity.ok(list.stream().map(HistoryItem::new).toList());
  }

  // Paginated history response DTO
  public static final class PagedHistoryResponse {
    public List<HistoryItem> content;
    public int page;
    public int size;
    public long totalElements;
    public int totalPages;
    public boolean hasNext;
    public boolean hasPrevious;

    public PagedHistoryResponse(Page<AssessmentResult> page) {
      this.content = page.getContent().stream().map(HistoryItem::new).toList();
      this.page = page.getNumber();
      this.size = page.getSize();
      this.totalElements = page.getTotalElements();
      this.totalPages = page.getTotalPages();
      this.hasNext = page.hasNext();
      this.hasPrevious = page.hasPrevious();
    }
  }

  // Paginated history endpoint for better performance with large datasets
  @GetMapping("/history/paged")
  public ResponseEntity<PagedHistoryResponse> historyPaged(
      @RequestParam(required = false) Long userId,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
  ) {
    Long resolvedUserId = AuthUtils.resolveUserId(userId);
    Pageable pageable = PageRequest.of(page, size);

    Page<AssessmentResult> resultPage = (resolvedUserId == null)
        ? assessmentService.listAllPaged(pageable)
        : assessmentService.listByUserPaged(resolvedUserId, pageable);

    return ResponseEntity.ok(new PagedHistoryResponse(resultPage));
  }
}
