package com.uvg.wellnessapp.security;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;

@Service
public class GoogleTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(GoogleTokenVerifier.class);

    @Value("${google.client-id}")
    private String googleClientId;

    /**
     * Verifies a Google ID token and returns the payload if valid.
     *
     * @param idTokenString the ID token string from Google Sign-In
     * @return the token payload if valid, null otherwise
     */
    public GoogleIdToken.Payload verify(String idTokenString) {
        if (idTokenString == null || idTokenString.isBlank()) {
            log.warn("Google token verification failed: token is null or empty");
            return null;
        }

        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(),
                    GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(idTokenString);

            if (idToken == null) {
                log.warn("Google token verification failed: token is invalid or expired");
                return null;
            }

            log.debug("Google token verified successfully for user: {}", idToken.getPayload().getEmail());
            return idToken.getPayload();

        } catch (GeneralSecurityException e) {
            log.error("Google token verification failed due to security error: {}", e.getMessage());
            return null;
        } catch (IOException e) {
            log.error("Google token verification failed due to network error: {}", e.getMessage());
            return null;
        } catch (IllegalArgumentException e) {
            log.warn("Google token verification failed: malformed token - {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.error("Google token verification failed with unexpected error: {}", e.getMessage(), e);
            return null;
        }
    }
}
