package plaid

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

const tokenCipherVersion = "v1"

func encryptToken(secret, token string) (string, error) {
	if strings.TrimSpace(secret) == "" {
		return "", errors.New("plaid token encryption key is required")
	}
	if strings.TrimSpace(token) == "" {
		return "", errors.New("plaid access token is required")
	}

	aead, err := tokenAEAD(secret)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := aead.Seal(nil, nonce, []byte(token), nil)
	payload := append(nonce, ciphertext...)
	return fmt.Sprintf("%s:%s", tokenCipherVersion, base64.StdEncoding.EncodeToString(payload)), nil
}

func decryptToken(secret, encrypted string) (string, error) {
	parts := strings.SplitN(encrypted, ":", 2)
	if len(parts) != 2 || parts[0] != tokenCipherVersion {
		return "", errors.New("unsupported plaid token cipher version")
	}

	payload, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", err
	}

	aead, err := tokenAEAD(secret)
	if err != nil {
		return "", err
	}
	if len(payload) <= aead.NonceSize() {
		return "", errors.New("invalid plaid token ciphertext")
	}

	nonce := payload[:aead.NonceSize()]
	ciphertext := payload[aead.NonceSize():]
	plaintext, err := aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func tokenAEAD(secret string) (cipher.AEAD, error) {
	key := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
