package auth

import (
	"context"
	"net/http"
)

type contextKey string

const userIDContextKey contextKey = "auth.userID"

func (h *Handler) requireAuth(next http.Handler) http.Handler {
	return h.RequireAuth(next)
}

func (h *Handler) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawToken, err := BearerToken(r.Header.Get("Authorization"))
		if err != nil {
			writeAuthError(w, err)
			return
		}

		claims, err := h.service.ParseAccessToken(rawToken)
		if err != nil {
			writeAuthError(w, err)
			return
		}

		ctx := context.WithValue(r.Context(), userIDContextKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(userIDContextKey).(string)
	return userID, ok && userID != ""
}
