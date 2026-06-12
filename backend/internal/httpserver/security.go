package httpserver

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"budget-buddy/backend/internal/config"
	"budget-buddy/backend/internal/respond"
)

func securityHeaders(cfg config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "no-referrer")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			if cfg.Env == "production" {
				w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}
			next.ServeHTTP(w, r)
		})
	}
}

type requestBucket struct {
	count    int
	resetsAt time.Time
}

type memoryLimiter struct {
	mu      sync.Mutex
	buckets map[string]requestBucket
	limit   int
	now     func() time.Time
}

func rateLimiter(cfg config.Config) func(http.Handler) http.Handler {
	limiter := &memoryLimiter{
		buckets: make(map[string]requestBucket),
		limit:   cfg.RateLimitPerMinute,
		now:     time.Now,
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			class := "api"
			limit := limiter.limit
			if isSensitiveAuthPath(r.URL.Path) {
				class = "auth"
				limit = min(limit, 20)
			}
			allowed, retryAfter := limiter.allow(clientIP(r), class, limit)
			if !allowed {
				w.Header().Set("Retry-After", strconv.Itoa(max(1, int(retryAfter.Seconds()))))
				respond.Error(w, http.StatusTooManyRequests, "rate_limited", "Too many requests. Try again shortly.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (l *memoryLimiter) allow(ip, class string, limit int) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now().UTC()
	key := ip + ":" + class
	bucket := l.buckets[key]
	if bucket.resetsAt.IsZero() || !now.Before(bucket.resetsAt) {
		bucket = requestBucket{resetsAt: now.Add(time.Minute)}
	}
	if bucket.count >= limit {
		return false, time.Until(bucket.resetsAt)
	}
	bucket.count++
	l.buckets[key] = bucket
	if len(l.buckets) > 10000 {
		for bucketKey, candidate := range l.buckets {
			if !now.Before(candidate.resetsAt) {
				delete(l.buckets, bucketKey)
			}
		}
	}
	return true, 0
}

func isSensitiveAuthPath(path string) bool {
	return strings.Contains(path, "/auth/login") ||
		strings.Contains(path, "/auth/register") ||
		strings.Contains(path, "/auth/forgot-password") ||
		strings.Contains(path, "/auth/reset-password")
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}
