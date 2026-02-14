// web/ResourceController.java
package com.uvg.wellnessapp.web;

import com.uvg.wellnessapp.domain.ResourceItem;
import com.uvg.wellnessapp.repository.ResourceRepository;
import com.uvg.wellnessapp.security.JwtService;
import com.uvg.wellnessapp.service.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/resources")
public class ResourceController {

  private static final Logger log = LoggerFactory.getLogger(ResourceController.class);

  // Validation constants
  private static final int MAX_TITLE_LENGTH = 200;
  private static final int MAX_DESCRIPTION_LENGTH = 2000;
  private static final int MAX_CATEGORY_LENGTH = 100;

  private final ResourceRepository repo;
  private final FileStorageService storage;
  private final JwtService jwt;

  public ResourceController(ResourceRepository repo, FileStorageService storage, JwtService jwt) {
    this.repo = repo;
    this.storage = storage;
    this.jwt = jwt;
  }

  // Público (APPROVED)
  @GetMapping("/public")
  public List<ResourceItem> listPublic() {
    return repo.findByStatusOrderByCreatedAtDesc("APPROVED");
  }

  // Admin (todo)
  @GetMapping
  @PreAuthorize("hasRole('ADMIN')")
  public List<ResourceItem> listAll() {
    return repo.findAllByOrderByCreatedAtDesc();
  }

  @PostMapping(consumes = "multipart/form-data")
  @PreAuthorize("hasRole('ADMIN')")
  @Transactional
  public ResponseEntity<?> create(
      @RequestPart("title") String title,
      @RequestPart(value = "description", required = false) String description,
      @RequestPart(value = "category", required = false) String category,
      @RequestPart(value = "file", required = false) MultipartFile file,
      @RequestHeader("Authorization") String auth
  ) {
    // Validate title
    if (title == null || title.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
    }
    title = title.trim();
    if (title.length() > MAX_TITLE_LENGTH) {
      return ResponseEntity.badRequest().body(Map.of(
          "error", "Title too long",
          "maxLength", MAX_TITLE_LENGTH
      ));
    }

    // Validate description
    if (description != null) {
      description = description.trim();
      if (description.length() > MAX_DESCRIPTION_LENGTH) {
        return ResponseEntity.badRequest().body(Map.of(
            "error", "Description too long",
            "maxLength", MAX_DESCRIPTION_LENGTH
        ));
      }
      if (description.isEmpty()) {
        description = null;
      }
    }

    // Validate category
    if (category != null) {
      category = category.trim();
      if (category.length() > MAX_CATEGORY_LENGTH) {
        return ResponseEntity.badRequest().body(Map.of(
            "error", "Category too long",
            "maxLength", MAX_CATEGORY_LENGTH
        ));
      }
      if (category.isEmpty()) {
        category = null;
      }
    }

    // Validate auth header
    if (auth == null || !auth.startsWith("Bearer ")) {
      return ResponseEntity.badRequest().body(Map.of("error", "Invalid authorization header"));
    }

    try {
      // Store file (validated inside FileStorageService)
      var stored = storage.store(file);

      // Extract user ID from token
      Long userId = jwt.getUserId(auth.substring(7));
      if (userId == null) {
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid token"));
      }

      // Create resource
      var r = new ResourceItem();
      r.setTitle(title);
      r.setDescription(description);
      r.setCategory(category);
      if (stored != null) {
        r.setFileKey(stored.key());
        r.setFileUrl(stored.url());
      }
      r.setCreatedBy(userId);
      r.setStatus("APPROVED");

      ResourceItem saved = repo.save(r);
      log.info("Resource created: id={}, title='{}', by userId={}", saved.getId(), title, userId);

      return ResponseEntity.status(201).body(saved);

    } catch (IllegalArgumentException e) {
      // File validation errors from FileStorageService
      log.warn("Resource creation failed - invalid file: {}", e.getMessage());
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (IOException e) {
      log.error("Resource creation failed - storage error: {}", e.getMessage());
      return ResponseEntity.internalServerError().body(Map.of("error", "Failed to store file"));
    } catch (Exception e) {
      log.error("Resource creation failed: {}", e.getMessage(), e);
      return ResponseEntity.internalServerError().body(Map.of("error", "Failed to create resource"));
    }
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  @Transactional
  public ResponseEntity<?> delete(@PathVariable Long id) {
    return repo.findById(id).map(r -> {
      if (r.getFileKey() != null) {
        storage.delete(r.getFileKey());
      }
      repo.delete(r);
      log.info("Resource deleted: id={}", id);
      return ResponseEntity.noContent().build();
    }).orElse(ResponseEntity.notFound().build());
  }
}
