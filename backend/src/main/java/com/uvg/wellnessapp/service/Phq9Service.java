package com.uvg.wellnessapp.service;

import org.springframework.stereotype.Service;

@Service
public class Phq9Service {
  public static final class Result {
    public final int total;
    public final String category;
    public final String message;
    public Result(int total, String category, String message) {
      this.total = total; this.category = category; this.message = message;
    }
  }

  public Result score(int[] answers) {
    if (answers == null || answers.length != 9) {
      throw new IllegalArgumentException("Se requieren 9 respuestas (0..3).");
    }
    int sum = 0;
    for (int a : answers) {
      if (a < 0 || a > 3) throw new IllegalArgumentException("Cada respuesta debe estar entre 0 y 3");
      sum += a;
    }
    // PHQ-9: 0–27
    String category =
        (sum <= 4)  ? "mínima" :
        (sum <= 9)  ? "leve" :
        (sum <= 14) ? "moderada" :
        (sum <= 19) ? "moderadamente severa" : "severa";

    String message = switch (category) {
      case "mínima" -> "Mantén hábitos saludables y monitoreo periódico.";
      case "leve" -> "Prueba rutinas de activación conductual y apoyo social.";
      case "moderada" -> "Considera apoyo profesional y plan de autocuidado.";
      case "moderadamente severa" -> "Busca evaluación clínica y seguimiento cercano.";
      default -> "Recomendable evaluación profesional prioritaria y protocolo de seguridad.";
    };
    return new Result(sum, category, message);
  }
}
