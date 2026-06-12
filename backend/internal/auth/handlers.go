package auth

import (
	"encoding/json"
	"errors"
	"io"
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
	mux.HandleFunc("POST "+basePath+"/auth/forgot-password", handler.forgotPassword)
	mux.HandleFunc("POST "+basePath+"/auth/reset-password", handler.resetPassword)
	mux.HandleFunc("POST "+basePath+"/auth/verify-email", handler.verifyEmail)
	mux.HandleFunc("POST "+basePath+"/auth/change-email/confirm", handler.confirmEmailChange)
	mux.Handle("POST "+basePath+"/auth/logout", handler.requireAuth(http.HandlerFunc(handler.logout)))
	mux.Handle("GET "+basePath+"/auth/me", handler.requireAuth(http.HandlerFunc(handler.me)))
	mux.Handle("POST "+basePath+"/auth/verify-email/request", handler.requireAuth(http.HandlerFunc(handler.requestEmailVerification)))
	mux.Handle("GET "+basePath+"/user/profile", handler.requireAuth(http.HandlerFunc(handler.me)))
	mux.Handle("PATCH "+basePath+"/user/profile", handler.requireAuth(http.HandlerFunc(handler.updateProfile)))
	mux.Handle("POST "+basePath+"/user/email/change", handler.requireAuth(http.HandlerFunc(handler.changeEmail)))
	mux.Handle("POST "+basePath+"/user/password", handler.requireAuth(http.HandlerFunc(handler.changePassword)))
	mux.Handle("DELETE "+basePath+"/user/account", handler.requireAuth(http.HandlerFunc(handler.deleteAccount)))
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

func (h *Handler) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	result, err := h.service.RequestPasswordReset(r.Context(), req.Email)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	respond.JSON(w, http.StatusAccepted, result)
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	if err := h.service.ResetPassword(r.Context(), req); err != nil {
		writeAuthError(w, err)
		return
	}
	respond.JSON(w, http.StatusOK, map[string]string{"message": "Password reset. You can now sign in."})
}

func (h *Handler) requestEmailVerification(w http.ResponseWriter, r *http.Request) {
	userID, _ := UserIDFromContext(r.Context())
	result, err := h.service.RequestEmailVerification(r.Context(), userID)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	respond.JSON(w, http.StatusAccepted, result)
}

func (h *Handler) verifyEmail(w http.ResponseWriter, r *http.Request) {
	var req VerifyEmailRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	if err := h.service.VerifyEmail(r.Context(), req.Token); err != nil {
		writeAuthError(w, err)
		return
	}
	respond.JSON(w, http.StatusOK, map[string]string{"message": "Email verified."})
}

func (h *Handler) changeEmail(w http.ResponseWriter, r *http.Request) {
	var req ChangeEmailRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	userID, _ := UserIDFromContext(r.Context())
	result, err := h.service.RequestEmailChange(r.Context(), userID, req)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	respond.JSON(w, http.StatusAccepted, result)
}

func (h *Handler) confirmEmailChange(w http.ResponseWriter, r *http.Request) {
	var req VerifyEmailRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	if err := h.service.ConfirmEmailChange(r.Context(), req.Token); err != nil {
		writeAuthError(w, err)
		return
	}
	respond.JSON(w, http.StatusOK, map[string]string{"message": "Email changed. Please sign in again."})
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	var req ChangePasswordRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	userID, _ := UserIDFromContext(r.Context())
	if err := h.service.ChangePassword(r.Context(), userID, req); err != nil {
		writeAuthError(w, err)
		return
	}
	respond.JSON(w, http.StatusOK, map[string]string{"message": "Password changed. Please sign in again."})
}

func (h *Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	var req UpdateProfileRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	userID, _ := UserIDFromContext(r.Context())
	user, err := h.service.UpdateProfile(r.Context(), userID, req)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	respond.JSON(w, http.StatusOK, user)
}

func (h *Handler) deleteAccount(w http.ResponseWriter, r *http.Request) {
	var req DeleteAccountRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	userID, _ := UserIDFromContext(r.Context())
	if err := h.service.DeleteAccount(r.Context(), userID, req.Password); err != nil {
		writeAuthError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("request body must contain one JSON object")
	}
	return nil
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
	case errors.Is(err, ErrInvalidActionToken):
		respond.Error(w, http.StatusBadRequest, "invalid_action_token", "This link is invalid or has expired.")
	case errors.Is(err, ErrPasswordIncorrect):
		respond.Error(w, http.StatusUnauthorized, "incorrect_password", "Current password is incorrect.")
	default:
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Something went wrong.")
	}
}
