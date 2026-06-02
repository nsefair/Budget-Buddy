package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"budget-buddy/backend/internal/config"
)

type TokenManager struct {
	accessSecret []byte
	accessTTL    time.Duration
	issuer       string
	now          func() time.Time
}

type AccessClaims struct {
	UserID    string
	Email     string
	ExpiresAt time.Time
}

type jwtHeader struct {
	Algorithm string `json:"alg"`
	Type      string `json:"typ"`
}

type jwtPayload struct {
	Subject   string `json:"sub"`
	Email     string `json:"email"`
	TokenType string `json:"typ"`
	Issuer    string `json:"iss"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

func NewTokenManager(cfg config.Config) TokenManager {
	return TokenManager{
		accessSecret: []byte(cfg.JWTAccessSecret),
		accessTTL:    cfg.AccessTokenTTL,
		issuer:       "budget-buddy-api",
		now:          time.Now,
	}
}

func (m TokenManager) GenerateAccessToken(user User) (string, time.Time, error) {
	now := m.now().UTC()
	expiresAt := now.Add(m.accessTTL)

	header := jwtHeader{Algorithm: "HS256", Type: "JWT"}
	payload := jwtPayload{
		Subject:   user.ID,
		Email:     user.Email,
		TokenType: "access",
		Issuer:    m.issuer,
		IssuedAt:  now.Unix(),
		ExpiresAt: expiresAt.Unix(),
	}

	encodedHeader, err := encodeSegment(header)
	if err != nil {
		return "", time.Time{}, err
	}
	encodedPayload, err := encodeSegment(payload)
	if err != nil {
		return "", time.Time{}, err
	}

	unsigned := encodedHeader + "." + encodedPayload
	signature := sign(unsigned, m.accessSecret)

	return unsigned + "." + signature, expiresAt, nil
}

func (m TokenManager) ParseAccessToken(raw string) (AccessClaims, error) {
	parts := strings.Split(raw, ".")
	if len(parts) != 3 {
		return AccessClaims{}, ErrUnauthorized
	}

	unsigned := parts[0] + "." + parts[1]
	expected := sign(unsigned, m.accessSecret)
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return AccessClaims{}, ErrUnauthorized
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return AccessClaims{}, ErrUnauthorized
	}

	var payload jwtPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return AccessClaims{}, ErrUnauthorized
	}
	if payload.TokenType != "access" || payload.Subject == "" {
		return AccessClaims{}, ErrUnauthorized
	}

	expiresAt := time.Unix(payload.ExpiresAt, 0).UTC()
	if !expiresAt.After(m.now().UTC()) {
		return AccessClaims{}, ErrUnauthorized
	}

	return AccessClaims{
		UserID:    payload.Subject,
		Email:     payload.Email,
		ExpiresAt: expiresAt,
	}, nil
}

func NewRefreshToken(expiresIn time.Duration) (raw string, hash string, expiresAt time.Time, err error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", time.Time{}, err
	}

	raw = base64.RawURLEncoding.EncodeToString(bytes)
	return raw, HashRefreshToken(raw), time.Now().UTC().Add(expiresIn), nil
}

func HashRefreshToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func BearerToken(value string) (string, error) {
	const prefix = "Bearer "
	if !strings.HasPrefix(value, prefix) {
		return "", ErrUnauthorized
	}
	token := strings.TrimSpace(strings.TrimPrefix(value, prefix))
	if token == "" {
		return "", ErrUnauthorized
	}
	return token, nil
}

func encodeSegment(value any) (string, error) {
	bytes, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func sign(unsigned string, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(unsigned))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func IsUnauthorized(err error) bool {
	return errors.Is(err, ErrUnauthorized)
}
