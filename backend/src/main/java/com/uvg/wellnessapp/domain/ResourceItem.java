package com.uvg.wellnessapp.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity @Table(name = "resources")
public class ResourceItem {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  private String title;
  @Column(columnDefinition = "text") private String description;
  private String category;
  @Column(name="file_url") private String fileUrl;
  @Column(name="file_key") private String fileKey;
  @Column(name="created_by") private Long createdBy;
  @Column(name="created_at") private LocalDateTime createdAt = LocalDateTime.now();
  @Column(name="is_public") private boolean isPublic = true;
  @Column(name="status") private String status; // requerido por V4

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getCategory() { return category; }
    public String getFileUrl() { return fileUrl; }
    public String getFileKey() { return fileKey; }
    public Long getCreatedBy() { return createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isPublic() { return isPublic; }
    public void setId(Long id) { this.id = id; }
    public void setTitle(String title) { this.title = title; }
    public void setDescription(String description) { this.description = description; }
    public void setCategory(String category) { this.category = category; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }
    public void setFileKey(String fileKey) { this.fileKey = fileKey; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setPublic(boolean isPublic) { this.isPublic = isPublic; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }


}