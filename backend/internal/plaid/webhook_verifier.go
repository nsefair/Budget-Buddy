package plaid

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"budget-buddy/backend/internal/config"
)

const (
	webhookMaxAge    = 5 * time.Minute
	webhookClockSkew = 30 * time.Second
	webhookKeyTTL    = 24 * time.Hour
)

var errInvalidWebhookVerification = errors.New("invalid Plaid webhook verification")

type verifiedWebhook struct {
	BodySHA256 string
	IssuedAt   time.Time
}

type webhookKeyFetcher interface {
	GetWebhookVerificationKey(context.Context, string) (WebhookVerificationKey, error)
}

type cachedWebhookKey struct {
	publicKey *ecdsa.PublicKey
	expiresAt time.Time
}

type webhookVerifier struct {
	fetcher webhookKeyFetcher
	now     func() time.Time

	mu    sync.RWMutex
	cache map[string]cachedWebhookKey
}

type plaidWebhookClaims struct {
	RequestBodySHA256 string `json:"request_body_sha256"`
	jwt.RegisteredClaims
}

func newWebhookVerifier(cfg config.Config) (*webhookVerifier, error) {
	client, err := NewClient(cfg)
	if err != nil {
		return nil, err
	}
	return newWebhookVerifierWithFetcher(client), nil
}

func newWebhookVerifierWithFetcher(fetcher webhookKeyFetcher) *webhookVerifier {
	return &webhookVerifier{
		fetcher: fetcher,
		now:     time.Now,
		cache:   make(map[string]cachedWebhookKey),
	}
}

func (v *webhookVerifier) Verify(ctx context.Context, signedJWT string, rawBody []byte) (verifiedWebhook, error) {
	signedJWT = strings.TrimSpace(signedJWT)
	if signedJWT == "" {
		return verifiedWebhook{}, errInvalidWebhookVerification
	}

	claims := &plaidWebhookClaims{}
	unverified, _, err := jwt.NewParser().ParseUnverified(signedJWT, claims)
	if err != nil || unverified == nil {
		return verifiedWebhook{}, errInvalidWebhookVerification
	}
	if unverified.Method.Alg() != jwt.SigningMethodES256.Alg() {
		return verifiedWebhook{}, errInvalidWebhookVerification
	}
	if typ, _ := unverified.Header["typ"].(string); typ != "JWT" {
		return verifiedWebhook{}, errInvalidWebhookVerification
	}
	keyID, _ := unverified.Header["kid"].(string)
	keyID = strings.TrimSpace(keyID)
	if keyID == "" {
		return verifiedWebhook{}, errInvalidWebhookVerification
	}

	publicKey, err := v.key(ctx, keyID)
	if err != nil {
		return verifiedWebhook{}, fmt.Errorf("%w: %v", errInvalidWebhookVerification, err)
	}

	verifiedClaims := &plaidWebhookClaims{}
	parsed, err := jwt.ParseWithClaims(
		signedJWT,
		verifiedClaims,
		func(token *jwt.Token) (any, error) {
			if token.Method != jwt.SigningMethodES256 {
				return nil, errInvalidWebhookVerification
			}
			return publicKey, nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodES256.Alg()}),
		jwt.WithStrictDecoding(),
		jwt.WithIssuedAt(),
		jwt.WithTimeFunc(v.now),
	)
	if err != nil || parsed == nil || !parsed.Valid || verifiedClaims.IssuedAt == nil {
		return verifiedWebhook{}, errInvalidWebhookVerification
	}

	now := v.now().UTC()
	issuedAt := verifiedClaims.IssuedAt.Time.UTC()
	if issuedAt.After(now.Add(webhookClockSkew)) || now.Sub(issuedAt) > webhookMaxAge {
		return verifiedWebhook{}, errInvalidWebhookVerification
	}

	claimedHash, err := hex.DecodeString(strings.TrimSpace(verifiedClaims.RequestBodySHA256))
	if err != nil || len(claimedHash) != sha256.Size {
		return verifiedWebhook{}, errInvalidWebhookVerification
	}
	actualHash := sha256.Sum256(rawBody)
	if subtle.ConstantTimeCompare(actualHash[:], claimedHash) != 1 {
		return verifiedWebhook{}, errInvalidWebhookVerification
	}

	return verifiedWebhook{
		BodySHA256: hex.EncodeToString(actualHash[:]),
		IssuedAt:   issuedAt,
	}, nil
}

func (v *webhookVerifier) key(ctx context.Context, keyID string) (*ecdsa.PublicKey, error) {
	now := v.now().UTC()
	v.mu.RLock()
	cached, ok := v.cache[keyID]
	v.mu.RUnlock()
	if ok && now.Before(cached.expiresAt) {
		return cached.publicKey, nil
	}

	jwk, err := v.fetcher.GetWebhookVerificationKey(ctx, keyID)
	if err != nil {
		return nil, err
	}
	publicKey, err := publicKeyFromJWK(jwk, keyID, now)
	if err != nil {
		return nil, err
	}

	expiresAt := now.Add(webhookKeyTTL)
	if jwk.ExpiredAt != nil {
		keyExpiry := time.Unix(*jwk.ExpiredAt, 0).UTC()
		if keyExpiry.Before(expiresAt) {
			expiresAt = keyExpiry
		}
	}
	if !expiresAt.After(now) {
		return nil, errors.New("Plaid webhook verification key is expired")
	}

	v.mu.Lock()
	v.cache[keyID] = cachedWebhookKey{publicKey: publicKey, expiresAt: expiresAt}
	v.mu.Unlock()
	return publicKey, nil
}

func publicKeyFromJWK(jwk WebhookVerificationKey, expectedKeyID string, now time.Time) (*ecdsa.PublicKey, error) {
	if jwk.Algorithm != "ES256" || jwk.Curve != "P-256" || jwk.KeyType != "EC" || jwk.Use != "sig" || jwk.KeyID != expectedKeyID {
		return nil, errors.New("Plaid returned an unexpected webhook verification key")
	}
	if jwk.ExpiredAt != nil && !time.Unix(*jwk.ExpiredAt, 0).UTC().After(now) {
		return nil, errors.New("Plaid webhook verification key is expired")
	}

	xBytes, err := base64.RawURLEncoding.DecodeString(jwk.X)
	if err != nil || len(xBytes) != 32 {
		return nil, errors.New("Plaid webhook verification key has an invalid x coordinate")
	}
	yBytes, err := base64.RawURLEncoding.DecodeString(jwk.Y)
	if err != nil || len(yBytes) != 32 {
		return nil, errors.New("Plaid webhook verification key has an invalid y coordinate")
	}

	x := new(big.Int).SetBytes(xBytes)
	y := new(big.Int).SetBytes(yBytes)
	curve := elliptic.P256()
	if !curve.IsOnCurve(x, y) {
		return nil, errors.New("Plaid webhook verification key is not on P-256")
	}
	return &ecdsa.PublicKey{Curve: curve, X: x, Y: y}, nil
}
