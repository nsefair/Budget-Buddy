package plaid

import "testing"

func TestEncryptTokenRoundTrip(t *testing.T) {
	secret := "development-test-key-for-plaid-token-storage"
	token := "access-sandbox-abc123"

	encrypted, err := encryptToken(secret, token)
	if err != nil {
		t.Fatalf("encryptToken() error = %v", err)
	}
	if encrypted == token {
		t.Fatal("encryptToken() returned plaintext token")
	}

	decrypted, err := decryptToken(secret, encrypted)
	if err != nil {
		t.Fatalf("decryptToken() error = %v", err)
	}
	if decrypted != token {
		t.Fatalf("decryptToken() = %q, want %q", decrypted, token)
	}
}

func TestDecryptTokenRejectsWrongSecret(t *testing.T) {
	encrypted, err := encryptToken("correct-key", "access-token")
	if err != nil {
		t.Fatalf("encryptToken() error = %v", err)
	}

	if _, err := decryptToken("wrong-key", encrypted); err == nil {
		t.Fatal("decryptToken() succeeded with the wrong secret")
	}
}
