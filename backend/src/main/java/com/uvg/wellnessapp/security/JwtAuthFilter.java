package com.uvg.wellnessapp.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.SignatureException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

  private final JwtService jwt;

  public JwtAuthFilter(JwtService jwt) {
    this.jwt = jwt;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String auth = request.getHeader(HttpHeaders.AUTHORIZATION);

    if (auth != null && auth.startsWith("Bearer ")) {
      String token = auth.substring(7);

      try {
        Long userId = jwt.getUserId(token);
        String email = jwt.getEmail(token);
        String role = jwt.getRole(token);

        // Si no viene el rol, lo asumimos USER
        String springRole = "ROLE_" + (role != null ? role : "USER");

        AbstractAuthenticationToken authentication =
            new AbstractAuthenticationToken(List.of(new SimpleGrantedAuthority(springRole))) {
              @Override public Object getCredentials() { return token; }
              @Override public Object getPrincipal() { return userId; }
            };

        authentication.setDetails(email);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);

      } catch (ExpiredJwtException e) {
        log.debug("JWT token has expired: {}", e.getMessage());
        // Token expired - request proceeds without authentication
      } catch (MalformedJwtException e) {
        log.warn("Malformed JWT token received: {}", e.getMessage());
        // Malformed token - could indicate an attack attempt
      } catch (SignatureException e) {
        log.warn("JWT signature validation failed: {}", e.getMessage());
        // Invalid signature - could indicate tampering
      } catch (IllegalArgumentException e) {
        log.debug("JWT token is invalid: {}", e.getMessage());
        // Invalid token format
      } catch (Exception e) {
        log.error("Unexpected error during JWT authentication: {}", e.getMessage(), e);
        // Unexpected error - log with full stack trace for debugging
      }
    }

    filterChain.doFilter(request, response);
  }
}
