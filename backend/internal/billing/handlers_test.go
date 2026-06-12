package billing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestValidSignature(t *testing.T) {
	body := []byte(`{"eventId":"event_123"}`)
	secret := "test_billing_webhook_secret"
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	signature := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	if !validSignature(body, signature, secret) {
		t.Fatal("expected signature to be valid")
	}
	if validSignature([]byte("changed"), signature, secret) {
		t.Fatal("expected changed body to fail signature validation")
	}
}
