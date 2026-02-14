package com.uvg.wellnessapp.web;

import com.uvg.wellnessapp.domain.Role;
import com.uvg.wellnessapp.domain.User;
import com.uvg.wellnessapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor 
public class UserAdminController {

  private final UserRepository users;

  @PostMapping("/{id}/make-admin")
  @PreAuthorize("hasRole('ADMIN')")
  public void makeAdmin(@PathVariable Long id) {
    User u = users.findById(id).orElseThrow();
    u.setRole(Role.ADMIN);
    users.save(u);
  }
}
