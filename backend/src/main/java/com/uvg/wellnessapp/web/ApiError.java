package com.uvg.wellnessapp.web;

import java.time.Instant;
import java.util.List;

public class ApiError {
  public Instant timestamp = Instant.now();
  public int status;
  public String error;
  public String message;
  public String path;
  public List<String> details;

  public ApiError(int status, String error, String message, String path, List<String> details) {
    this.status = status; this.error = error; this.message = message; this.path = path; this.details = details;
  }
}
