package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

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

func TestAccessTokenRejectsInvalidClaimsAlgorithmsAndSignatures(t *testing.T) {
	const secret = "test_secret_for_access_tokens"
	now := time.Date(2026, 6, 2, 12, 0, 0, 0, time.UTC)
	manager := NewTokenManager(config.Config{
		JWTAccessSecret: secret,
		AccessTokenTTL:  15 * time.Minute,
	})
	manager.now = func() time.Time { return now }

	validClaims := func() accessTokenClaims {
		return accessTokenClaims{
			Email:     "avery@example.com",
			TokenType: "access",
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    "budget-buddy-api",
				Subject:   "user-id",
				IssuedAt:  jwt.NewNumericDate(now),
				ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			},
		}
	}

	tests := []struct {
		name  string
		build func(*testing.T) string
	}{
		{
			name: "alg none",
			build: func(t *testing.T) string {
				return signAccessTokenForTest(t, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, validClaims(), "JWT")
			},
		},
		{
			name: "wrong algorithm",
			build: func(t *testing.T) string {
				return signAccessTokenForTest(t, jwt.SigningMethodHS384, []byte(secret), validClaims(), "JWT")
			},
		},
		{
			name: "wrong issuer",
			build: func(t *testing.T) string {
				claims := validClaims()
				claims.Issuer = "another-api"
				return signAccessTokenForTest(t, jwt.SigningMethodHS256, []byte(secret), claims, "JWT")
			},
		},
		{
			name: "missing subject",
			build: func(t *testing.T) string {
				claims := validClaims()
				claims.Subject = ""
				return signAccessTokenForTest(t, jwt.SigningMethodHS256, []byte(secret), claims, "JWT")
			},
		},
		{
			name: "expired",
			build: func(t *testing.T) string {
				claims := validClaims()
				claims.IssuedAt = jwt.NewNumericDate(now.Add(-20 * time.Minute))
				claims.ExpiresAt = jwt.NewNumericDate(now.Add(-time.Minute))
				return signAccessTokenForTest(t, jwt.SigningMethodHS256, []byte(secret), claims, "JWT")
			},
		},
		{
			name: "unreasonable issued at",
			build: func(t *testing.T) string {
				claims := validClaims()
				claims.IssuedAt = jwt.NewNumericDate(now.Add(10 * time.Minute))
				claims.ExpiresAt = jwt.NewNumericDate(now.Add(25 * time.Minute))
				return signAccessTokenForTest(t, jwt.SigningMethodHS256, []byte(secret), claims, "JWT")
			},
		},
		{
			name: "wrong token type",
			build: func(t *testing.T) string {
				claims := validClaims()
				claims.TokenType = "refresh"
				return signAccessTokenForTest(t, jwt.SigningMethodHS256, []byte(secret), claims, "JWT")
			},
		},
		{
			name: "wrong header type",
			build: func(t *testing.T) string {
				return signAccessTokenForTest(t, jwt.SigningMethodHS256, []byte(secret), validClaims(), "NOT-JWT")
			},
		},
		{
			name:  "malformed segments",
			build: func(*testing.T) string { return "one.two" },
		},
		{
			name: "invalid signature",
			build: func(t *testing.T) string {
				return signAccessTokenForTest(t, jwt.SigningMethodHS256, []byte("different_secret"), validClaims(), "JWT")
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := manager.ParseAccessToken(test.build(t)); err != ErrUnauthorized {
				t.Fatalf("ParseAccessToken error = %v, want ErrUnauthorized", err)
			}
		})
	}
}

func signAccessTokenForTest(t *testing.T, method jwt.SigningMethod, key any, claims accessTokenClaims, headerType string) string {
	t.Helper()
	token := jwt.NewWithClaims(method, claims)
	token.Header["typ"] = headerType
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("SignedString returned error: %v", err)
	}
	return signed
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
