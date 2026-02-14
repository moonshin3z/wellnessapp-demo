package com.uvg.wellnessapp.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.nio.file.Path;

@Configuration
public class StaticFilesConfig implements WebMvcConfigurer {

  @Value("${app.storage.uploadDir}")
  private String uploadDir;

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    Path p = Path.of(uploadDir).toAbsolutePath().normalize();
    registry.addResourceHandler("/files/**")
      .addResourceLocations("file:" + p.toString() + "/");
  }
}