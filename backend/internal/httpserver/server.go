package httpserver

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/buds"
	"budget-buddy/backend/internal/config"
	"budget-buddy/backend/internal/goals"
	"budget-buddy/backend/internal/quests"
	"budget-buddy/backend/internal/respond"
)

func New(cfg config.Config, logger *slog.Logger, db *pgxpool.Pool) *http.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", healthHandler("ok"))
	mux.HandleFunc("GET /readyz", readyHandler(db))
	mux.HandleFunc("GET "+cfg.APIBasePath+"/health", healthHandler("ok"))

	authHandler := auth.NewHandler(auth.NewService(db, cfg))
	auth.RegisterRoutes(mux, cfg.APIBasePath, authHandler)
	buds.RegisterRoutes(mux, cfg.APIBasePath, db, authHandler.RequireAuth)
	goals.RegisterRoutes(mux, cfg.APIBasePath, db, authHandler.RequireAuth)
	quests.RegisterRoutes(mux, cfg.APIBasePath)

	handler := recoverer(logger)(requestLogger(logger)(cors(cfg)(mux)))

	return &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: cfg.ReadTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}
}

func readyHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if err := db.Ping(ctx); err != nil {
			respond.Error(w, http.StatusServiceUnavailable, "database_unavailable", "Database is not ready.")
			return
		}

		respond.JSON(w, http.StatusOK, map[string]any{
			"status":  "ready",
			"service": "budget-buddy-api",
		})
	}
}

func healthHandler(status string) http.HandlerFunc {
	startedAt := time.Now().UTC()

	return func(w http.ResponseWriter, r *http.Request) {
		respond.JSON(w, http.StatusOK, map[string]any{
			"status":    status,
			"service":   "budget-buddy-api",
			"startedAt": startedAt.Format(time.RFC3339),
		})
	}
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			logger.Info(
				"http request",
				"method", r.Method,
				"path", r.URL.Path,
				"durationMs", time.Since(start).Milliseconds(),
			)
		})
	}
}

func recoverer(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if value := recover(); value != nil {
					logger.Error("panic recovered", "value", value)
					respond.Error(w, http.StatusInternalServerError, "internal_error", "Something went wrong.")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func cors(cfg config.Config) func(http.Handler) http.Handler {
	allowed := map[string]struct{}{}
	for _, origin := range cfg.AllowedOrigins {
		allowed[strings.TrimSpace(origin)] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if _, ok := allowed[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
