package plaid

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type staticWebhookKeyFetcher struct {
	key   WebhookVerificationKey
	err   error
	mu    sync.Mutex
	calls int
}

func (f *staticWebhookKeyFetcher) GetWebhookVerificationKey(context.Context, string) (WebhookVerificationKey, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	return f.key, f.err
}

func (f *staticWebhookKeyFetcher) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls
}

type memoryWebhookRecorder struct {
	mu     sync.Mutex
	byHash map[string]webhookEvent
	events []webhookEvent
}

func newMemoryWebhookRecorder() *memoryWebhookRecorder {
	return &memoryWebhookRecorder{byHash: make(map[string]webhookEvent)}
}

func (r *memoryWebhookRecorder) RecordWebhook(_ context.Context, event webhookEvent) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.byHash[event.VerificationHash]; exists {
		return false, nil
	}
	r.byHash[event.VerificationHash] = event
	r.events = append(r.events, event)
	return true, nil
}

func TestWebhookVerifierValidatesSignatureAgeAlgorithmAndBody(t *testing.T) {
	now := time.Date(2026, 8, 26, 12, 0, 0, 0, time.UTC)
	privateKey, fetcher := webhookTestKey(t, "test-key", now)
	verifier := newWebhookVerifierWithFetcher(fetcher)
	verifier.now = func() time.Time { return now }
	body := []byte(`{"webhook_type":"TRANSACTIONS","webhook_code":"SYNC_UPDATES_AVAILABLE","item_id":"item-1"}`)

	validToken := signedWebhookToken(t, privateKey, "test-key", now, body, jwt.SigningMethodES256)
	verified, err := verifier.Verify(context.Background(), validToken, body)
	if err != nil {
		t.Fatalf("Verify valid webhook returned error: %v", err)
	}
	wantHash := sha256.Sum256(body)
	if verified.BodySHA256 != hex.EncodeToString(wantHash[:]) {
		t.Fatalf("BodySHA256 = %q, want %q", verified.BodySHA256, hex.EncodeToString(wantHash[:]))
	}

	tests := []struct {
		name  string
		token func() string
		body  []byte
	}{
		{name: "missing", token: func() string { return "" }, body: body},
		{
			name: "invalid signature",
			token: func() string {
				otherKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
				if err != nil {
					t.Fatal(err)
				}
				return signedWebhookToken(t, otherKey, "test-key", now, body, jwt.SigningMethodES256)
			},
			body: body,
		},
		{
			name: "expired",
			token: func() string {
				return signedWebhookToken(t, privateKey, "test-key", now.Add(-6*time.Minute), body, jwt.SigningMethodES256)
			},
			body: body,
		},
		{
			name: "wrong algorithm",
			token: func() string {
				return signedWebhookToken(t, []byte("test-hmac-secret"), "test-key", now, body, jwt.SigningMethodHS256)
			},
			body: body,
		},
		{
			name:  "wrong body hash",
			token: func() string { return validToken },
			body:  []byte(`{"webhook_type":"TRANSACTIONS","webhook_code":"DIFFERENT"}`),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := verifier.Verify(context.Background(), test.token(), test.body); err == nil {
				t.Fatal("Verify returned nil error")
			}
		})
	}

	if _, err := verifier.Verify(context.Background(), validToken, body); err != nil {
		t.Fatalf("second valid Verify returned error: %v", err)
	}
	if calls := fetcher.callCount(); calls != 1 {
		t.Fatalf("verification key fetches = %d, want 1 cached fetch", calls)
	}
}

func TestWebhookHandlerRejectsMissingVerificationAndOversizedBodies(t *testing.T) {
	now := time.Date(2026, 8, 26, 12, 0, 0, 0, time.UTC)
	privateKey, fetcher := webhookTestKey(t, "test-key", now)
	verifier := newWebhookVerifierWithFetcher(fetcher)
	verifier.now = func() time.Time { return now }
	recorder := newMemoryWebhookRecorder()
	handler := &Handler{webhookVerifier: verifier, webhookEvents: recorder}

	missing := httptest.NewRequest(http.MethodPost, "/v1/plaid/webhook", strings.NewReader(`{"webhook_type":"TRANSACTIONS"}`))
	missingResponse := httptest.NewRecorder()
	handler.webhook(missingResponse, missing)
	if missingResponse.Code != http.StatusUnauthorized {
		t.Fatalf("missing verification status = %d, want %d", missingResponse.Code, http.StatusUnauthorized)
	}

	oversizedBody := []byte(`{"webhook_type":"TRANSACTIONS","webhook_code":"SYNC_UPDATES_AVAILABLE","padding":"` + strings.Repeat("x", 1<<20) + `"}`)
	oversized := httptest.NewRequest(http.MethodPost, "/v1/plaid/webhook", strings.NewReader(string(oversizedBody)))
	oversized.Header.Set("Plaid-Verification", signedWebhookToken(t, privateKey, "test-key", now, oversizedBody, jwt.SigningMethodES256))
	oversizedResponse := httptest.NewRecorder()
	handler.webhook(oversizedResponse, oversized)
	if oversizedResponse.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized status = %d, want %d", oversizedResponse.Code, http.StatusRequestEntityTooLarge)
	}
	if len(recorder.events) != 0 {
		t.Fatalf("recorded %d rejected webhooks, want 0", len(recorder.events))
	}
}

func TestWebhookHandlerDeduplicatesAndAcceptsOutOfOrderEvents(t *testing.T) {
	now := time.Date(2026, 8, 26, 12, 0, 0, 0, time.UTC)
	privateKey, fetcher := webhookTestKey(t, "test-key", now)
	verifier := newWebhookVerifierWithFetcher(fetcher)
	verifier.now = func() time.Time { return now }
	recorder := newMemoryWebhookRecorder()
	handler := &Handler{webhookVerifier: verifier, webhookEvents: recorder}

	later := []byte(`{"webhook_type":"TRANSACTIONS","webhook_code":"SYNC_UPDATES_AVAILABLE","item_id":"item-1","sequence":2}`)
	earlier := []byte(`{"webhook_type":"TRANSACTIONS","webhook_code":"INITIAL_UPDATE","item_id":"item-1","sequence":1}`)
	sendWebhookForTest(t, handler, privateKey, now, later)
	sendWebhookForTest(t, handler, privateKey, now, earlier)
	sendWebhookForTest(t, handler, privateKey, now, later)

	if len(recorder.events) != 2 {
		t.Fatalf("recorded events = %d, want 2 unique events", len(recorder.events))
	}
	if recorder.events[0].WebhookCode != "SYNC_UPDATES_AVAILABLE" || recorder.events[1].WebhookCode != "INITIAL_UPDATE" {
		t.Fatalf("out-of-order events were not durably retained in arrival order: %#v", recorder.events)
	}
}

func sendWebhookForTest(t *testing.T, handler *Handler, privateKey *ecdsa.PrivateKey, issuedAt time.Time, body []byte) {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/v1/plaid/webhook", strings.NewReader(string(body)))
	request.Header.Set("Plaid-Verification", signedWebhookToken(t, privateKey, "test-key", issuedAt, body, jwt.SigningMethodES256))
	response := httptest.NewRecorder()
	handler.webhook(response, request)
	if response.Code != http.StatusAccepted {
		t.Fatalf("webhook status = %d, want %d; body=%s", response.Code, http.StatusAccepted, response.Body.String())
	}
}

func webhookTestKey(t *testing.T, keyID string, now time.Time) (*ecdsa.PrivateKey, *staticWebhookKeyFetcher) {
	t.Helper()
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey returned error: %v", err)
	}
	return privateKey, &staticWebhookKeyFetcher{key: WebhookVerificationKey{
		Algorithm: "ES256",
		Curve:     "P-256",
		KeyID:     keyID,
		KeyType:   "EC",
		Use:       "sig",
		X:         base64.RawURLEncoding.EncodeToString(privateKey.X.FillBytes(make([]byte, 32))),
		Y:         base64.RawURLEncoding.EncodeToString(privateKey.Y.FillBytes(make([]byte, 32))),
		CreatedAt: now.Add(-time.Hour).Unix(),
	}}
}

func signedWebhookToken(t *testing.T, key any, keyID string, issuedAt time.Time, body []byte, method jwt.SigningMethod) string {
	t.Helper()
	digest := sha256.Sum256(body)
	claims := plaidWebhookClaims{
		RequestBodySHA256: hex.EncodeToString(digest[:]),
		RegisteredClaims:  jwt.RegisteredClaims{IssuedAt: jwt.NewNumericDate(issuedAt)},
	}
	token := jwt.NewWithClaims(method, claims)
	token.Header["kid"] = keyID
	token.Header["typ"] = "JWT"
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("SignedString returned error: %v", err)
	}
	return signed
}
