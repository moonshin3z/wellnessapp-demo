package com.uvg.wellnessapp.service;

import org.springframework.stereotype.Service;

@Service
public class Gad7Service {

  public static final class Result {
    public final int total;
    public final String category;
    public final String message;
    public Result(int total, String category, String message) {
      this.total = total; this.category = category; this.message = message;
    }
  }

  public Result score(int[] answers) {
    if (answers == null || answers.length != 7) {
      throw new IllegalArgumentException("Se requieren 7 respuestas (0..3).");
    }
    int sum = 0;
    for (int a : answers) {
      if (a < 0 || a > 3) throw new IllegalArgumentException("Cada respuesta debe estar entre 0 y 3");
      sum += a;
    }
    String category = (sum <= 4) ? "mínima" :
                      (sum <= 9) ? "leve" :
                      (sum <= 14) ? "moderada" : "severa";
    String message = switch (category) {
      case "mínima" -> "Sigue con hábitos saludables.";
      case "leve" -> "Prueba respiración guiada y seguimiento.";
      case "moderada" -> "Busca apoyo profesional y autocuidado.";
      default -> "Considera ayuda profesional y protocolo de crisis.";
    };
    return new Result(sum, category, message);
  }
}
