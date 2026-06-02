package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"budget-buddy/backend/internal/respond"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func RegisterRoutes(mux *http.ServeMux, basePath string, handler *Handler) {
	mux.HandleFunc("POST "+basePath+"/auth/register", handler.register)
	mux.HandleFunc("POST "+basePath+"/auth/login", handler.login)
	mux.HandleFunc("POST "+basePath+"/auth/refresh", handler.refresh)
	mux.Handle("POST "+basePath+"/auth/logout", handler.requireAuth(http.HandlerFunc(handler.logout)))
	mux.Handle("GET "+basePath+"/auth/me", handler.requireAuth(http.HandlerFunc(handler.me)))
	mux.Handle("POST "+basePath+"/user/onboarding", handler.requireAuth(http.HandlerFunc(handler.completeOnboarding)))
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}

	result, err := h.service.Register(r.Context(), req)
	if err != nil {
		writeAuthError(w, err)
		return
	}

	respond.JSON(w, http.StatusCreated, result)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}

	result, err := h.service.Login(r.Context(), req)
	if err != nil {
		writeAuthError(w, err)
		return
	}

	respond.JSON(w, http.StatusOK, result)
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}

	result, err := h.service.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		writeAuthError(w, err)
		return
	}

	respond.JSON(w, http.StatusOK, result)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	userID, _ := UserIDFromContext(r.Context())
	if err := h.service.Logout(r.Context(), userID); err != nil {
		writeAuthError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	userID, _ := UserIDFromContext(r.Context())
	user, err := h.service.GetMe(r.Context(), userID)
	if err != nil {
		writeAuthError(w, err)
		return
	}

	respond.JSON(w, http.StatusOK, user)
}

func (h *Handler) completeOnboarding(w http.ResponseWriter, r *http.Request) {
	var req OnboardingRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}

	userID, _ := UserIDFromContext(r.Context())
	user, err := h.service.CompleteOnboarding(r.Context(), userID, req)
	if err != nil {
		writeAuthError(w, err)
		return
	}

	respond.JSON(w, http.StatusOK, user)
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func writeAuthError(w http.ResponseWriter, err error) {
	var validation ValidationError
	switch {
	case errors.As(err, &validation):
		respond.Error(w, http.StatusBadRequest, "validation_error", validation.Message)
	case errors.Is(err, ErrEmailTaken):
		respond.Error(w, http.StatusConflict, "email_taken", "An account already exists for this email.")
	case errors.Is(err, ErrInvalidCredentials):
		respond.Error(w, http.StatusUnauthorized, "invalid_credentials", "Incorrect email or password.")
	case errors.Is(err, ErrInvalidRefreshToken):
		respond.Error(w, http.StatusUnauthorized, "invalid_refresh_token", "Refresh token is invalid or expired.")
	case errors.Is(err, ErrUnauthorized):
		respond.Error(w, http.StatusUnauthorized, "unauthorized", "A valid access token is required.")
	case errors.Is(err, ErrUserNotFound):
		respond.Error(w, http.StatusNotFound, "user_not_found", "User not found.")
	default:
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Something went wrong.")
	}
}
