// Application Configuration
// This file should be generated at deployment time with environment-specific values
// For Docker deployments, use envsubst or mount this file with actual values

window.APP_CONFIG = {
  // API base URL - Update with your Render.com backend URL after deploy
  API_BASE_URL: "https://wellnessapp-api.onrender.com",

  // Google OAuth disabled for demo (requires Google Console config per domain)
  GOOGLE_CLIENT_ID: "",

  // Feature flags
  ENABLE_GOOGLE_LOGIN: false
};

// Fallback for development - remove or replace in production
if (!window.APP_CONFIG.GOOGLE_CLIENT_ID || window.APP_CONFIG.GOOGLE_CLIENT_ID.startsWith("${")) {
  console.warn("[Config] Google Client ID not configured. Google login will be disabled.");
  window.APP_CONFIG.ENABLE_GOOGLE_LOGIN = false;
}
