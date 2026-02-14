package com.uvg.wellnessapp.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Small helper to extract the authenticated user id from the security context
 * when controllers need to associate data with the current session.
 */
public final class AuthUtils {

  private AuthUtils() {
  }

  /**
   * Returns the provided user id if present, otherwise resolves the id of the
   * authenticated principal (or {@code null} when the request is anonymous).
   */
  public static Long resolveUserId(Long provided) {
    if (provided != null) {
      return provided;
    }
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) {
      return null;
    }
    Object principal = auth.getPrincipal();
    if (principal instanceof Long l) {
      return l;
    }
    try {
      return Long.valueOf(principal.toString());
    } catch (NumberFormatException ex) {
      return null;
    }
  }
}
