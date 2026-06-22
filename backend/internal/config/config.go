package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr                    string
	Env                     string
	APIBasePath             string
	DatabaseURL             string
	AllowedOrigins          []string
	JWTAccessSecret         string
	AccessTokenTTL          time.Duration
	RefreshTokenTTL         time.Duration
	LogLevel                slog.Level
	ReadTimeout             time.Duration
	WriteTimeout            time.Duration
	IdleTimeout             time.Duration
	RateLimitPerMinute      int
	PlaidClientID           string
	PlaidSecret             string
	PlaidEnvironment        string
	PlaidClientName         string
	PlaidProducts           []string
	PlaidOptionalProducts   []string
	PlaidCountryCodes       []string
	PlaidRedirectURI        string
	PlaidAndroidPackageName string
	PlaidWebhookURL         string
	PlaidTokenEncryptionKey string
	PlaidTransactionDays    int
	AppPublicURL            string
	AuthActionTokenTTL      time.Duration
	EmailDeliveryMode       string
	EmailFrom               string
	SMTPHost                string
	SMTPPort                int
	SMTPUsername            string
	SMTPPassword            string
	BillingWebhookSecret    string
	BillingEnvironment      string
	IOSPremiumMonthlyID     string
	IOSPremiumAnnualID      string
	IOSEliteMonthlyID       string
	IOSEliteAnnualID        string
	BudsMediaDir            string
}

func Load() Config {
	return Config{
		Addr:           env("HTTP_ADDR", ":8080"),
		Env:            env("APP_ENV", "development"),
		APIBasePath:    env("API_BASE_PATH", "/v1"),
		DatabaseURL:    env("DATABASE_URL", "postgres://budget_buddy:budget_buddy@localhost:5432/budget_buddy?sslmode=disable"),
		AllowedOrigins: csvEnv("ALLOWED_ORIGINS", "http://localhost:8081,http://localhost:19006"),
		JWTAccessSecret: env(
			"JWT_ACCESS_SECRET",
			"development_only_budget_buddy_access_secret_change_me",
		),
		AccessTokenTTL:          durationEnv("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:         durationEnv("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		LogLevel:                logLevel(env("LOG_LEVEL", "info")),
		ReadTimeout:             durationEnv("READ_TIMEOUT", 5*time.Second),
		WriteTimeout:            durationEnv("WRITE_TIMEOUT", 10*time.Second),
		IdleTimeout:             durationEnv("IDLE_TIMEOUT", 60*time.Second),
		RateLimitPerMinute:      intEnv("RATE_LIMIT_PER_MINUTE", 240),
		PlaidClientID:           env("PLAID_CLIENT_ID", ""),
		PlaidSecret:             env("PLAID_SECRET", ""),
		PlaidEnvironment:        env("PLAID_ENV", "sandbox"),
		PlaidClientName:         env("PLAID_CLIENT_NAME", "Budget Buddy"),
		PlaidProducts:           csvEnv("PLAID_PRODUCTS", "transactions"),
		PlaidOptionalProducts:   csvEnv("PLAID_OPTIONAL_PRODUCTS", ""),
		PlaidCountryCodes:       csvEnv("PLAID_COUNTRY_CODES", "US"),
		PlaidRedirectURI:        env("PLAID_REDIRECT_URI", ""),
		PlaidAndroidPackageName: env("PLAID_ANDROID_PACKAGE_NAME", ""),
		PlaidWebhookURL:         env("PLAID_WEBHOOK_URL", ""),
		PlaidTokenEncryptionKey: env("PLAID_TOKEN_ENCRYPTION_KEY", ""),
		PlaidTransactionDays:    intEnv("PLAID_TRANSACTION_DAYS", 90),
		AppPublicURL:            env("APP_PUBLIC_URL", "budget-buddy://"),
		AuthActionTokenTTL:      durationEnv("AUTH_ACTION_TOKEN_TTL", time.Hour),
		EmailDeliveryMode:       strings.ToLower(env("EMAIL_DELIVERY_MODE", "log")),
		EmailFrom:               env("EMAIL_FROM", "Budget Buddy <no-reply@budgetbuddy.app>"),
		SMTPHost:                env("SMTP_HOST", ""),
		SMTPPort:                intEnv("SMTP_PORT", 587),
		SMTPUsername:            env("SMTP_USERNAME", ""),
		SMTPPassword:            env("SMTP_PASSWORD", ""),
		BillingWebhookSecret:    env("BILLING_WEBHOOK_SECRET", ""),
		BillingEnvironment:      strings.ToLower(env("BILLING_ENV", "sandbox")),
		IOSPremiumMonthlyID:     env("IOS_PREMIUM_MONTHLY_PRODUCT_ID", "budget_buddy_premium_monthly"),
		IOSPremiumAnnualID:      env("IOS_PREMIUM_ANNUAL_PRODUCT_ID", "budget_buddy_premium_annual"),
		IOSEliteMonthlyID:       env("IOS_ELITE_MONTHLY_PRODUCT_ID", "budget_buddy_elite_monthly"),
		IOSEliteAnnualID:        env("IOS_ELITE_ANNUAL_PRODUCT_ID", "budget_buddy_elite_annual"),
		BudsMediaDir:            env("BUDS_MEDIA_DIR", "./data/buds-media"),
	}
}

func (c Config) Validate() error {
	if c.Env != "production" {
		return nil
	}

	var problems []string
	if len(c.JWTAccessSecret) < 32 || strings.Contains(c.JWTAccessSecret, "development_only") {
		problems = append(problems, "JWT_ACCESS_SECRET must be a unique production secret of at least 32 characters")
	}
	if c.EmailDeliveryMode != "smtp" {
		problems = append(problems, "EMAIL_DELIVERY_MODE must be smtp in production")
	}
	if c.SMTPHost == "" || c.SMTPUsername == "" || c.SMTPPassword == "" {
		problems = append(problems, "SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD are required in production")
	}
	if !strings.HasPrefix(c.AppPublicURL, "https://") && !strings.HasPrefix(c.AppPublicURL, "budget-buddy://") {
		problems = append(problems, "APP_PUBLIC_URL must use https:// or the budget-buddy:// app scheme")
	}
	if c.BillingEnvironment != "production" {
		problems = append(problems, "BILLING_ENV must be production")
	}
	if len(c.BillingWebhookSecret) < 32 {
		problems = append(problems, "BILLING_WEBHOOK_SECRET must be at least 32 characters")
	}
	if !c.PlaidConfigured() {
		problems = append(problems, "PLAID_CLIENT_ID and PLAID_SECRET are required in production")
	}
	if len(c.PlaidTokenEncryptionKey) < 32 {
		problems = append(problems, "PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters")
	}
	if !strings.HasPrefix(c.PlaidWebhookURL, "https://") {
		problems = append(problems, "PLAID_WEBHOOK_URL must use https:// in production")
	}
	if c.PlaidTransactionDays < 90 || c.PlaidTransactionDays > 730 {
		problems = append(problems, "PLAID_TRANSACTION_DAYS must be between 90 and 730 in production")
	}
	if strings.TrimSpace(c.BudsMediaDir) == "" || !filepath.IsAbs(c.BudsMediaDir) {
		problems = append(problems, "BUDS_MEDIA_DIR must be an absolute path on durable storage in production")
	}
	if len(problems) > 0 {
		return errors.New(strings.Join(problems, "; "))
	}
	return nil
}

func (c Config) PlaidConfigured() bool {
	return strings.TrimSpace(c.PlaidClientID) != "" &&
		strings.TrimSpace(c.PlaidSecret) != ""
}

func (c Config) PlaidTokenEncryptionConfigured() bool {
	return strings.TrimSpace(c.PlaidTokenEncryptionKey) != ""
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func csvEnv(key, fallback string) []string {
	raw := env(key, fallback)
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		if value := strings.TrimSpace(part); value != "" {
			values = append(values, value)
		}
	}
	return values
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		return fallback
	}
	return value
}

func intEnv(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 || value > 65535 {
		return fallback
	}
	return value
}

func (c Config) SMTPAddress() string {
	return fmt.Sprintf("%s:%d", c.SMTPHost, c.SMTPPort)
}

func logLevel(raw string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
