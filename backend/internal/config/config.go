package config

import (
	"log/slog"
	"os"
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
	}
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
