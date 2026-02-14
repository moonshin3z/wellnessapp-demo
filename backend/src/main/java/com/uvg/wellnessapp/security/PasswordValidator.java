package com.uvg.wellnessapp.security;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Validates password strength according to security requirements.
 */
public final class PasswordValidator {

    private static final int MIN_LENGTH = 8;
    private static final int MAX_LENGTH = 128;

    // Pattern checks
    private static final Pattern HAS_UPPERCASE = Pattern.compile("[A-Z]");
    private static final Pattern HAS_LOWERCASE = Pattern.compile("[a-z]");
    private static final Pattern HAS_DIGIT = Pattern.compile("\\d");
    private static final Pattern HAS_SPECIAL = Pattern.compile("[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]");

    // Common weak passwords to reject
    private static final List<String> COMMON_PASSWORDS = List.of(
        "password", "12345678", "qwerty123", "admin123", "letmein",
        "welcome1", "password1", "123456789", "abc12345", "iloveyou"
    );

    private PasswordValidator() {
        // Utility class - no instantiation
    }

    /**
     * Validates a password and returns a list of validation errors.
     * Returns an empty list if the password is valid.
     *
     * @param password the password to validate
     * @return list of validation error messages, empty if valid
     */
    public static List<String> validate(String password) {
        List<String> errors = new ArrayList<>();

        if (password == null || password.isBlank()) {
            errors.add("Password is required");
            return errors;
        }

        if (password.length() < MIN_LENGTH) {
            errors.add("Password must be at least " + MIN_LENGTH + " characters long");
        }

        if (password.length() > MAX_LENGTH) {
            errors.add("Password must not exceed " + MAX_LENGTH + " characters");
        }

        if (!HAS_UPPERCASE.matcher(password).find()) {
            errors.add("Password must contain at least one uppercase letter");
        }

        if (!HAS_LOWERCASE.matcher(password).find()) {
            errors.add("Password must contain at least one lowercase letter");
        }

        if (!HAS_DIGIT.matcher(password).find()) {
            errors.add("Password must contain at least one digit");
        }

        if (!HAS_SPECIAL.matcher(password).find()) {
            errors.add("Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;':\",./<>?)");
        }

        // Check for common passwords (case-insensitive)
        String lowerPassword = password.toLowerCase();
        for (String common : COMMON_PASSWORDS) {
            if (lowerPassword.contains(common)) {
                errors.add("Password is too common or contains a common pattern");
                break;
            }
        }

        return errors;
    }

    /**
     * Checks if a password meets all security requirements.
     *
     * @param password the password to check
     * @return true if the password is valid, false otherwise
     */
    public static boolean isValid(String password) {
        return validate(password).isEmpty();
    }

    /**
     * Gets a human-readable description of password requirements.
     *
     * @return password requirements description
     */
    public static String getRequirements() {
        return "Password must be at least " + MIN_LENGTH + " characters long and contain: " +
               "uppercase letter, lowercase letter, digit, and special character.";
    }
}
