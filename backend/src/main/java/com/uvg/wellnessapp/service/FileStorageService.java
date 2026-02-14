package com.uvg.wellnessapp.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {
  private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);

  // Whitelist of allowed file extensions (lowercase)
  private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
      ".pdf", ".doc", ".docx", ".txt", ".rtf",  // Documents
      ".jpg", ".jpeg", ".png", ".gif", ".webp", // Images
      ".mp3", ".wav", ".ogg",                   // Audio
      ".mp4", ".webm"                           // Video
  );

  // Whitelist of allowed MIME types
  private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/rtf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "video/mp4",
      "video/webm"
  );

  private static final long MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

  private final Path root;

  public FileStorageService(@Value("${app.storage.uploadDir}") String uploadDir) throws Exception {
    this.root = Path.of(uploadDir).toAbsolutePath().normalize();
    Files.createDirectories(this.root);
  }

  public record Stored(String key, String url) {}

  /**
   * Validates and stores an uploaded file.
   * @param file the uploaded file
   * @return stored file info, or null if file is empty
   * @throws IllegalArgumentException if file type is not allowed
   * @throws IOException if file cannot be stored
   */
  public Stored store(MultipartFile file) throws IOException {
    if (file == null || file.isEmpty()) {
      return null;
    }

    // Validate file size
    if (file.getSize() > MAX_FILE_SIZE) {
      throw new IllegalArgumentException("File size exceeds maximum allowed size of 25MB");
    }

    // Extract and validate extension
    String originalFilename = file.getOriginalFilename();
    String ext = extractExtension(originalFilename);

    if (!isAllowedExtension(ext)) {
      log.warn("Rejected file upload with disallowed extension: {}", ext);
      throw new IllegalArgumentException("File type not allowed. Allowed types: " + ALLOWED_EXTENSIONS);
    }

    // Validate content type
    String contentType = file.getContentType();
    if (contentType == null || !isAllowedContentType(contentType)) {
      log.warn("Rejected file upload with disallowed content type: {}", contentType);
      throw new IllegalArgumentException("File content type not allowed: " + contentType);
    }

    // Generate safe filename with UUID
    String key = UUID.randomUUID() + ext.toLowerCase(Locale.ROOT);

    // Ensure the destination is within the upload directory (prevent path traversal)
    Path dest = root.resolve(key).normalize();
    if (!dest.startsWith(root)) {
      log.error("Path traversal attempt detected: {}", key);
      throw new IllegalArgumentException("Invalid file path");
    }

    // Store the file using try-with-resources
    try (InputStream inputStream = file.getInputStream()) {
      Files.copy(inputStream, dest, StandardCopyOption.REPLACE_EXISTING);
    }

    log.info("File stored successfully: {}", key);
    return new Stored(key, "/files/" + key);
  }

  /**
   * Deletes a stored file.
   * @param key the file key to delete
   */
  public void delete(String key) {
    if (key == null || key.isBlank()) {
      return;
    }

    try {
      // Validate key doesn't contain path traversal
      Path filePath = root.resolve(key).normalize();
      if (!filePath.startsWith(root)) {
        log.error("Path traversal attempt in delete: {}", key);
        return;
      }

      boolean deleted = Files.deleteIfExists(filePath);
      if (deleted) {
        log.info("File deleted successfully: {}", key);
      } else {
        log.warn("File not found for deletion: {}", key);
      }
    } catch (IOException e) {
      log.error("Failed to delete file {}: {}", key, e.getMessage());
    }
  }

  private String extractExtension(String filename) {
    return Optional.ofNullable(filename)
        .filter(n -> n.contains("."))
        .map(n -> n.substring(n.lastIndexOf('.')).toLowerCase(Locale.ROOT))
        .orElse("");
  }

  private boolean isAllowedExtension(String ext) {
    return ext != null && !ext.isBlank() && ALLOWED_EXTENSIONS.contains(ext.toLowerCase(Locale.ROOT));
  }

  private boolean isAllowedContentType(String contentType) {
    return contentType != null && ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT));
  }
}
