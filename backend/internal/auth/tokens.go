package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

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

type accessTokenClaims struct {
	Email     string `json:"email"`
	TokenType string `json:"typ"`
	jwt.RegisteredClaims
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
	claims := accessTokenClaims{
		Email:     user.Email,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["typ"] = "JWT"
	signed, err := token.SignedString(m.accessSecret)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, expiresAt, nil
}

func (m TokenManager) ParseAccessToken(raw string) (AccessClaims, error) {
	claims := &accessTokenClaims{}
	token, err := jwt.ParseWithClaims(
		strings.TrimSpace(raw),
		claims,
		func(token *jwt.Token) (any, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, ErrUnauthorized
			}
			typ, _ := token.Header["typ"].(string)
			if typ != "JWT" {
				return nil, ErrUnauthorized
			}
			return m.accessSecret, nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(m.issuer),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(30*time.Second),
		jwt.WithStrictDecoding(),
		jwt.WithTimeFunc(m.now),
	)
	if err != nil || token == nil || !token.Valid || claims.Subject == "" || claims.TokenType != "access" || claims.IssuedAt == nil || claims.ExpiresAt == nil {
		return AccessClaims{}, ErrUnauthorized
	}

	now := m.now().UTC()
	issuedAt := claims.IssuedAt.Time.UTC()
	expiresAt := claims.ExpiresAt.Time.UTC()
	if issuedAt.After(now.Add(30*time.Second)) ||
		issuedAt.Before(now.Add(-m.accessTTL-5*time.Minute)) ||
		!expiresAt.After(issuedAt) ||
		expiresAt.Sub(issuedAt) > m.accessTTL+time.Minute {
		return AccessClaims{}, ErrUnauthorized
	}

	return AccessClaims{
		UserID:    claims.Subject,
		Email:     claims.Email,
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

func NewActionToken(expiresIn time.Duration) (raw string, hash string, expiresAt time.Time, err error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", time.Time{}, err
	}
	raw = base64.RawURLEncoding.EncodeToString(bytes)
	return raw, HashActionToken(raw), time.Now().UTC().Add(expiresIn), nil
}

func HashActionToken(raw string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(raw)))
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

func IsUnauthorized(err error) bool {
	return errors.Is(err, ErrUnauthorized)
}
