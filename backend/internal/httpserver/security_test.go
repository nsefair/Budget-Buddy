package httpserver

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"time"

	"budget-buddy/backend/internal/config"
)

func TestClientIPTrustsOnlyConfiguredProxy(t *testing.T) {
	proxies := []netip.Prefix{netip.MustParsePrefix("172.30.0.2/32")}
	for _, tc := range []struct{ peer, header, want string }{
		{"172.30.0.2:1234", "203.0.113.1", "203.0.113.1"},
		{"198.51.100.2:1234", "203.0.113.1", "198.51.100.2"},
		{"172.30.0.2:1234", "203.0.113.1, 198.51.100.2", "172.30.0.2"},
		{"172.30.0.2:1234", "", "172.30.0.2"},
	} {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = tc.peer
		r.Header.Set("X-Real-IP", tc.header)
		if got := clientIP(r, proxies); got != tc.want {
			t.Fatalf("peer=%q header=%q: got %q, want %q", tc.peer, tc.header, got, tc.want)
		}
	}
}

func TestRateLimitsAndProxyIsolation(t *testing.T) {
	h := rateLimiter(config.Config{
		RateLimitPerMinute: 120, GlobalRateLimitPerMinute: 600,
		TrustedProxyCIDRs: []string{"172.30.0.2/32"},
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	request := func(path, ip string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", path, nil)
		r.RemoteAddr = "172.30.0.2:1234"
		r.Header.Set("X-Real-IP", ip)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	for i := 0; i < 20; i++ {
		if w := request("/v1/auth/login", "203.0.113.1"); w.Code != 204 {
			t.Fatal(w.Code)
		}
	}
	if w := request("/v1/auth/login", "203.0.113.1"); w.Code != 429 || w.Header().Get("Retry-After") == "" {
		t.Fatal("auth limit did not reject with Retry-After")
	}
	if w := request("/v1/auth/login", "203.0.113.2"); w.Code != 204 {
		t.Fatal("separate proxy client was blocked")
	}
	for i := 0; i < 6; i++ {
		if w := request("/v1/plaid/sync", "203.0.113.1"); w.Code != 204 {
			t.Fatal(w.Code)
		}
	}
	if w := request("/v1/plaid/link-token", "203.0.113.1"); w.Code != 429 {
		t.Fatal("Plaid operations did not share a limit")
	}
	if w := request("/v1/plaid/webhook", "203.0.113.1"); w.Code != 204 {
		t.Fatal("webhook incorrectly used client-operation limit")
	}
}

func TestGlobalRateLimitAcrossClients(t *testing.T) {
	h := rateLimiter(config.Config{RateLimitPerMinute: 10, GlobalRateLimitPerMinute: 2})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	for i, want := range []int{204, 204, 429} {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = fmt.Sprintf("203.0.113.%d:1234", i+1)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("got %d want %d", w.Code, want)
		}
	}
}

func TestBucketBoundAndExpiration(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	l := &memoryLimiter{buckets: make(map[string]requestBucket), now: func() time.Time { return now }}
	for i := 0; i < maxRateLimitBuckets; i++ {
		l.allow(fmt.Sprint(i), "api", 1)
	}
	if ok, _ := l.allow("new", "api", 1); ok {
		t.Fatal("bucket storage exceeded bound")
	}
	if ok, retry := l.allow("0", "api", 1); ok || retry != time.Minute {
		t.Fatal("invalid window or retry interval")
	}
	now = now.Add(time.Minute)
	if ok, _ := l.allow("new", "api", 1); !ok {
		t.Fatal("expired buckets were not reclaimed")
	}
	if len(l.buckets) != 1 {
		t.Fatal("expired bucket retention")
	}
}

func TestConcurrencyLimitReleasesSlot(t *testing.T) {
	entered, release, done := make(chan struct{}), make(chan struct{}), make(chan struct{})
	h := concurrencyLimiter(1)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/slow" {
			close(entered)
			<-release
		}
		w.WriteHeader(204)
	}))
	go func() {
		defer close(done)
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/slow", nil))
	}()
	<-entered
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
	if w.Code != 429 {
		t.Error("excess concurrent work was accepted")
	}
	close(release)
	<-done
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
	if w.Code != 204 {
		t.Fatal("slot was not released")
	}
}
