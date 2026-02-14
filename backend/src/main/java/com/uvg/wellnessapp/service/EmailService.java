package com.uvg.wellnessapp.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:noreply@wellnessapp.com}")
    private String fromEmail;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendPasswordResetEmail(String toEmail, String token) {
        // Use query param only (no path) since frontend is a SPA
        String resetLink = frontendUrl + "?token=" + token;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject("WellnessApp - Restablecer Contraseña");
        message.setText(buildPasswordResetEmailBody(resetLink));

        mailSender.send(message);
    }

    private String buildPasswordResetEmailBody(String resetLink) {
        return """
            Hola,

            Recibimos una solicitud para restablecer la contraseña de tu cuenta en WellnessApp.

            Haz clic en el siguiente enlace para crear una nueva contraseña:
            %s

            Este enlace expirará en 1 hora.

            Si no solicitaste este cambio, puedes ignorar este correo.

            Saludos,
            El equipo de WellnessApp
            """.formatted(resetLink);
    }
}
