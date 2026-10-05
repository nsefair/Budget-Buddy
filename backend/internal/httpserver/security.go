package httpserver

import (
	"net"
	"net/http"
	"net/netip"
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
	mu          sync.Mutex
	buckets     map[string]requestBucket
	limit       int
	now         func() time.Time
	nextCleanup time.Time
}

const maxRateLimitBuckets = 10000

func rateLimiter(cfg config.Config) func(http.Handler) http.Handler {
	limiter := &memoryLimiter{
		buckets: make(map[string]requestBucket),
		limit:   cfg.RateLimitPerMinute,
		now:     time.Now,
	}
	proxies := make([]netip.Prefix, 0, len(cfg.TrustedProxyCIDRs))
	for _, cidr := range cfg.TrustedProxyCIDRs {
		if prefix, err := netip.ParsePrefix(cidr); err == nil {
			proxies = append(proxies, prefix)
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r, proxies)
			if cfg.GlobalRateLimitPerMinute > 0 {
				if allowed, retry := limiter.allow("global", "all", cfg.GlobalRateLimitPerMinute); !allowed {
					rateLimitResponse(w, retry)
					return
				}
			}
			if allowed, retry := limiter.allow(ip, "api", limiter.limit); !allowed {
				rateLimitResponse(w, retry)
				return
			}
			class := "api"
			limit := limiter.limit
			if isSensitiveAuthPath(r.URL.Path) {
				class = "auth"
				limit = min(limit, 20)
			} else if r.Method == http.MethodPost && isPlaidOperation(r.URL.Path) {
				class = "plaid"
				limit = min(limit, 6)
			}
			if class != "api" {
				if allowed, retry := limiter.allow(ip, class, limit); !allowed {
					rateLimitResponse(w, retry)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func rateLimitResponse(w http.ResponseWriter, retry time.Duration) {
	w.Header().Set("Retry-After", strconv.Itoa(max(1, int((retry+time.Second-1)/time.Second))))
	respond.Error(w, http.StatusTooManyRequests, "rate_limited", "Too many requests. Try again shortly.")
}

func concurrencyLimiter(limit int) func(http.Handler) http.Handler {
	active := make(chan struct{}, max(1, limit))
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			select {
			case active <- struct{}{}:
				defer func() { <-active }()
				next.ServeHTTP(w, r)
			default:
				rateLimitResponse(w, time.Second)
			}
		})
	}
}

func (l *memoryLimiter) allow(ip, class string, limit int) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now().UTC()
	if !now.Before(l.nextCleanup) {
		for key, bucket := range l.buckets {
			if !now.Before(bucket.resetsAt) {
				delete(l.buckets, key)
			}
		}
		l.nextCleanup = now.Add(time.Minute)
	}
	key := ip + ":" + class
	bucket, exists := l.buckets[key]
	if !exists && len(l.buckets) >= maxRateLimitBuckets {
		return false, l.nextCleanup.Sub(now)
	}
	if bucket.resetsAt.IsZero() || !now.Before(bucket.resetsAt) {
		bucket = requestBucket{resetsAt: now.Add(time.Minute)}
	}
	if bucket.count >= limit {
		return false, bucket.resetsAt.Sub(now)
	}
	bucket.count++
	l.buckets[key] = bucket
	return true, 0
}

func isPlaidOperation(path string) bool {
	return strings.HasSuffix(path, "/plaid/link-token") ||
		strings.HasSuffix(path, "/plaid/exchange") ||
		strings.HasSuffix(path, "/plaid/sync")
}

func isSensitiveAuthPath(path string) bool {
	return strings.Contains(path, "/auth/login") ||
		strings.Contains(path, "/auth/register") ||
		strings.Contains(path, "/auth/forgot-password") ||
		strings.Contains(path, "/auth/reset-password")
}

func clientIP(r *http.Request, proxies []netip.Prefix) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		peer, parseErr := netip.ParseAddr(host)
		if parseErr == nil {
			for _, proxy := range proxies {
				if proxy.Contains(peer.Unmap()) {
					// Only our proxy may supply this header; it overwrites client input.
					if forwarded, err := netip.ParseAddr(r.Header.Get("X-Real-IP")); err == nil {
						return forwarded.Unmap().String()
					}
				}
			}
		}
		return host
	}
	return r.RemoteAddr
}
