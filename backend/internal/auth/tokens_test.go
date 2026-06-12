package auth

import (
	"testing"
	"time"

	"budget-buddy/backend/internal/config"
)

func TestAccessTokenRoundTrip(t *testing.T) {
	manager := NewTokenManager(config.Config{
		JWTAccessSecret: "test_secret_for_access_tokens",
		AccessTokenTTL:  time.Hour,
	})
	manager.now = func() time.Time {
		return time.Date(2026, 6, 2, 12, 0, 0, 0, time.UTC)
	}

	token, _, err := manager.GenerateAccessToken(User{
		ID:    "6f44fc65-029d-43f6-94c8-055f8f558c10",
		Email: "alex@example.com",
	})
	if err != nil {
		t.Fatalf("GenerateAccessToken returned error: %v", err)
	}

	claims, err := manager.ParseAccessToken(token)
	if err != nil {
		t.Fatalf("ParseAccessToken returned error: %v", err)
	}

	if claims.UserID != "6f44fc65-029d-43f6-94c8-055f8f558c10" {
		t.Fatalf("claims.UserID = %q", claims.UserID)
	}
	if claims.Email != "alex@example.com" {
		t.Fatalf("claims.Email = %q", claims.Email)
	}
}

func TestAccessTokenRejectsExpiredToken(t *testing.T) {
	manager := NewTokenManager(config.Config{
		JWTAccessSecret: "test_secret_for_access_tokens",
		AccessTokenTTL:  time.Minute,
	})
	issuedAt := time.Date(2026, 6, 2, 12, 0, 0, 0, time.UTC)
	manager.now = func() time.Time {
		return issuedAt
	}

	token, _, err := manager.GenerateAccessToken(User{ID: "user-id", Email: "alex@example.com"})
	if err != nil {
		t.Fatalf("GenerateAccessToken returned error: %v", err)
	}

	manager.now = func() time.Time {
		return issuedAt.Add(2 * time.Minute)
	}
	if _, err := manager.ParseAccessToken(token); err != ErrUnauthorized {
		t.Fatalf("ParseAccessToken error = %v, want ErrUnauthorized", err)
	}
}

func TestActionTokenIsHashedAndRoundTrips(t *testing.T) {
	raw, hash, expiresAt, err := NewActionToken(time.Hour)
	if err != nil {
		t.Fatalf("NewActionToken returned error: %v", err)
	}
	if raw == "" || hash == "" || raw == hash {
		t.Fatalf("expected distinct raw and hashed action token")
	}
	if got := HashActionToken(raw); got != hash {
		t.Fatalf("HashActionToken(raw) = %q, want %q", got, hash)
	}
	if !expiresAt.After(time.Now().UTC()) {
		t.Fatalf("expiresAt = %v, expected future time", expiresAt)
	}
}
