package config

import "testing"

func TestProductionValidationRejectsDevelopmentDefaults(t *testing.T) {
	cfg := Config{
		Env:                  "production",
		JWTAccessSecret:      "development_only_budget_buddy_access_secret_change_me",
		EmailDeliveryMode:    "log",
		AppPublicURL:         "http://localhost:8081",
		BillingEnvironment:   "sandbox",
		BillingWebhookSecret: "short",
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected production defaults to be rejected")
	}
}

func TestProductionValidationAcceptsConfiguredSecrets(t *testing.T) {
	cfg := Config{
		Env:                  "production",
		JWTAccessSecret:      "a_unique_production_access_secret_123456789",
		EmailDeliveryMode:    "smtp",
		SMTPHost:             "smtp.example.com",
		SMTPUsername:         "budget-buddy",
		SMTPPassword:         "smtp-password",
		AppPublicURL:         "https://budgetbuddy.app",
		BillingEnvironment:   "production",
		BillingWebhookSecret: "a_unique_billing_webhook_secret_123456789",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate returned error: %v", err)
	}
}
