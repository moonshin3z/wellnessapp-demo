package com.uvg.wellnessapp.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {

  private final Key key;
  private final int expMinutes;

  public JwtService(
      @Value("${app.security.jwt.secret}") String secret,
      @Value("${app.security.jwt.expMinutes}") int expMinutes
  ) {
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.expMinutes = expMinutes;
  }

  public String generateToken(Long userId, String email) {
    Instant now = Instant.now();
    Instant exp = now.plusSeconds(expMinutes * 60L);
    return Jwts.builder()
        .setSubject(String.valueOf(userId))
        .addClaims(Map.of("email", email))
        .setIssuedAt(Date.from(now))
        .setExpiration(Date.from(exp))
        .signWith(key, SignatureAlgorithm.HS256)
        .compact();
  }

  public Jws<Claims> parse(String token) {
    return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
  }

  public Long getUserId(String token) {
    return Long.valueOf(parse(token).getBody().getSubject());
  }


  public String getEmail(String token) {
    Object e = parse(token).getBody().get("email");
    return e == null ? null : e.toString();
  }

public String generateToken(Long userId, String email, String role) {
  Instant now = Instant.now();
  Instant exp = now.plusSeconds(expMinutes * 60L);
  return Jwts.builder()
      .setSubject(String.valueOf(userId))
      .addClaims(Map.of("email", email, "role", role))     // <--- rol en el token
      .setIssuedAt(Date.from(now))
      .setExpiration(Date.from(exp))
      .signWith(key, SignatureAlgorithm.HS256)
      .compact();
}

public String getRole(String token) {
  Object r = parse(token).getBody().get("role");
  return r == null ? null : r.toString();
}
}
