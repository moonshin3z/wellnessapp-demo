package com.uvg.wellnessapp.repository;

import com.uvg.wellnessapp.domain.ResourceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ResourceRepository extends JpaRepository<ResourceItem, Long> {
  List<ResourceItem> findByStatusOrderByCreatedAtDesc(String status);
  List<ResourceItem> findAllByOrderByCreatedAtDesc();
}