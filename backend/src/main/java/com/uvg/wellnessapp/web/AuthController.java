package com.uvg.wellnessapp.web;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.uvg.wellnessapp.domain.User;
import com.uvg.wellnessapp.security.JwtService;
import com.uvg.wellnessapp.security.PasswordValidator;
import com.uvg.wellnessapp.service.PasswordResetService;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import com.uvg.wellnessapp.security.GoogleTokenVerifier;
import com.uvg.wellnessapp.repository.UserRepository;
import com.uvg.wellnessapp.domain.Role;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/api/v1/auth")
@Validated
public class AuthController {

  private final UserRepository users;
  private final PasswordEncoder encoder;
  private final JwtService jwt;
  private final GoogleTokenVerifier googleTokenVerifier;
  private final PasswordResetService passwordResetService;

  public AuthController(UserRepository users, PasswordEncoder encoder, JwtService jwt,
                        GoogleTokenVerifier googleTokenVerifier, PasswordResetService passwordResetService) {
    this.users = users;
    this.encoder = encoder;
    this.jwt = jwt;
    this.googleTokenVerifier = googleTokenVerifier;
    this.passwordResetService = passwordResetService;
  }

  public static final class RegisterRequest {
    @NotBlank @Email public String email;
    @NotBlank public String password;
  }
  public static final class LoginRequest {
    @NotBlank @Email public String email;
    @NotBlank public String password;
  }

  @PostMapping("/register")
  public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
    // Validate password strength
    List<String> passwordErrors = PasswordValidator.validate(req.password);
    if (!passwordErrors.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of(
          "error", "Password does not meet requirements",
          "details", passwordErrors,
          "requirements", PasswordValidator.getRequirements()
      ));
    }

    if (users.existsByEmail(req.email)) {
      return ResponseEntity.badRequest().body(Map.of("error", "Email ya registrado"));
    }

    User u = new User();
    u.setEmail(req.email);
    u.setPasswordHash(encoder.encode(req.password));
    users.save(u);
    return ResponseEntity.status(201).body(Map.of("id", u.getId(), "email", u.getEmail()));
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(@RequestBody LoginRequest req) {
    var u = users.findByEmail(req.email).orElse(null);
    if (u == null || !encoder.matches(req.password, u.getPasswordHash())) {
      return ResponseEntity.status(401).body(Map.of("error","Credenciales inválidas"));
    }
    String token = jwt.generateToken(u.getId(), u.getEmail(), u.getRole().name());
    return ResponseEntity.ok(Map.of(
      "token", token,
      "userId", u.getId(),
      "email", u.getEmail(),
      "role", u.getRole().name()
    ));
  }

@PostMapping("/google")
public ResponseEntity<?> loginWithGoogle(@RequestBody Map<String, String> body) {
    String idToken = body.get("idToken");

    if (idToken == null) {
        return ResponseEntity.badRequest().body(Map.of("error", "Missing idToken"));
    }

    var payload = googleTokenVerifier.verify(idToken);
    if (payload == null) {
        return ResponseEntity.status(401).body(Map.of("error", "Invalid Google token"));
    }

    String email = payload.getEmail();
    String name = (String) payload.get("name");

    // Find existing user or create new one
    User user = users.findByEmail(email).orElse(null);

    if (user == null) {
        // Create new user for Google OAuth
        user = new User();
        user.setEmail(email);
        user.setPasswordHash("GOOGLE_OAUTH_ACCOUNT");
        user.setRole(Role.USER);
        users.save(user);
    }
    // Note: User entity doesn't have a 'name' field.
    // The name from Google is returned to the frontend for display purposes only.

    // Generate JWT
    String token = jwt.generateToken(user.getId(), user.getEmail(), user.getRole().name());

    return ResponseEntity.ok(Map.of(
            "token", token,
            "userId", user.getId(),
            "email", user.getEmail(),
            "role", user.getRole().name(),
            "name", name != null ? name : ""
    ));
}

  /**
   * Request password reset - sends email with reset link
   */
  @PostMapping("/forgot-password")
  public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> request) {
    String email = request.get("email");
    if (email == null || email.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Email es requerido"));
    }

    passwordResetService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    return ResponseEntity.ok(Map.of(
        "message", "Si el email existe, recibirás un enlace para restablecer tu contraseña"
    ));
  }

  /**
   * Validate reset token
   */
  @GetMapping("/reset-password/validate")
  public ResponseEntity<?> validateResetToken(@RequestParam String token) {
    boolean valid = passwordResetService.validateToken(token);
    if (!valid) {
      return ResponseEntity.badRequest().body(Map.of(
          "valid", false,
          "error", "Token inválido o expirado"
      ));
    }
    return ResponseEntity.ok(Map.of("valid", true));
  }

  /**
   * Reset password with token
   */
  @PostMapping("/reset-password")
  public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> request) {
    String token = request.get("token");
    String newPassword = request.get("newPassword");

    if (token == null || token.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Token es requerido"));
    }
    if (newPassword == null || newPassword.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Nueva contraseña es requerida"));
    }

    // Validate password strength
    List<String> passwordErrors = PasswordValidator.validate(newPassword);
    if (!passwordErrors.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of(
          "error", "La contraseña no cumple los requisitos",
          "details", passwordErrors,
          "requirements", PasswordValidator.getRequirements()
      ));
    }

    boolean success = passwordResetService.resetPassword(token, newPassword);
    if (!success) {
      return ResponseEntity.badRequest().body(Map.of("error", "Token inválido o expirado"));
    }

    return ResponseEntity.ok(Map.of("message", "Contraseña actualizada exitosamente"));
  }
}
