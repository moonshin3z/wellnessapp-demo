package com.uvg.wellnessapp.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Rate limiting filter for authentication endpoints to prevent brute force attacks.
 * Uses a sliding window algorithm with in-memory storage.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    // Store request counts per IP: IP -> (timestamp, count)
    private final ConcurrentHashMap<String, RequestCounter> requestCounts = new ConcurrentHashMap<>();

    private final int maxRequests;
    private final int windowMinutes;

    // Scheduled cleanup of old entries
    private final ScheduledExecutorService cleanupExecutor = Executors.newSingleThreadScheduledExecutor();

    public RateLimitFilter(
            @Value("${app.security.rate-limit.max-requests:10}") int maxRequests,
            @Value("${app.security.rate-limit.window-minutes:1}") int windowMinutes
    ) {
        this.maxRequests = maxRequests;
        this.windowMinutes = windowMinutes;

        // Schedule cleanup every 5 minutes
        cleanupExecutor.scheduleAtFixedRate(this::cleanupOldEntries, 5, 5, TimeUnit.MINUTES);

        log.info("Rate limiter initialized: {} requests per {} minute(s) for auth endpoints", maxRequests, windowMinutes);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Only rate limit auth endpoints (login, register, google)
        if (!path.startsWith("/api/v1/auth/")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Skip OPTIONS requests (CORS preflight)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        String rateLimitKey = clientIp + ":" + path;

        if (isRateLimited(rateLimitKey)) {
            log.warn("Rate limit exceeded for IP {} on endpoint {}", clientIp, path);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too many requests. Please try again later.\",\"retryAfterSeconds\":" + (windowMinutes * 60) + "}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isRateLimited(String key) {
        Instant now = Instant.now();
        Instant windowStart = now.minusSeconds(windowMinutes * 60L);

        RequestCounter counter = requestCounts.compute(key, (k, existing) -> {
            if (existing == null || existing.windowStart.isBefore(windowStart)) {
                // Start a new window
                return new RequestCounter(now, 1);
            } else {
                // Increment existing counter
                existing.count++;
                return existing;
            }
        });

        return counter.count > maxRequests;
    }

    private String getClientIp(HttpServletRequest request) {
        // Check for forwarded IP (when behind proxy/load balancer)
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isEmpty()) {
            // Take the first IP in the chain (original client)
            return forwardedFor.split(",")[0].trim();
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isEmpty()) {
            return realIp.trim();
        }

        return request.getRemoteAddr();
    }

    private void cleanupOldEntries() {
        Instant cutoff = Instant.now().minusSeconds(windowMinutes * 60L * 2); // Keep entries for 2x window
        int removed = 0;
        for (var entry : requestCounts.entrySet()) {
            if (entry.getValue().windowStart.isBefore(cutoff)) {
                requestCounts.remove(entry.getKey());
                removed++;
            }
        }
        if (removed > 0) {
            log.debug("Rate limiter cleanup: removed {} old entries", removed);
        }
    }

    private static class RequestCounter {
        final Instant windowStart;
        int count;

        RequestCounter(Instant windowStart, int count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
