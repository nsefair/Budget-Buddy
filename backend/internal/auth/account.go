package auth

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"budget-buddy/backend/internal/mailer"
)

const (
	actionPasswordReset     = "password_reset"
	actionEmailVerification = "email_verification"
	actionEmailChange       = "email_change"
)

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

type VerifyEmailRequest struct {
	Token string `json:"token"`
}

type ChangeEmailRequest struct {
	NewEmail string `json:"newEmail"`
	Password string `json:"password"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type UpdateProfileRequest struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Why       string `json:"why"`
}

type DeleteAccountRequest struct {
	Password string `json:"password"`
}

type ActionStartedResponse struct {
	Message    string `json:"message"`
	DebugToken string `json:"debugToken,omitempty"`
}

func (s *Service) RequestPasswordReset(ctx context.Context, rawEmail string) (ActionStartedResponse, error) {
	response := ActionStartedResponse{Message: "If an account exists for that email, a reset link has been sent."}
	email, err := normalizeEmail(rawEmail)
	if err != nil {
		return response, nil
	}

	_, user, err := s.findUserWithPasswordByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return response, nil
	}
	if err != nil {
		return response, err
	}

	rawToken, err := s.createActionToken(ctx, user.ID, actionPasswordReset, nil)
	if err != nil {
		return response, err
	}
	link := s.actionLink("reset-password", rawToken)
	if err := s.emailSender.Send(ctx, mailer.Message{
		To:      user.Email,
		Subject: "Reset your Budget Buddy password",
		Text: fmt.Sprintf(
			"We received a request to reset your Budget Buddy password.\n\nOpen this link within %s:\n%s\n\nIf you did not request this, you can ignore this email.",
			s.actionTokenTTL,
			link,
		),
	}); err != nil {
		s.logger.Error("password reset email failed", "userId", user.ID, "error", err)
	}
	if s.cfg.Env != "production" {
		response.DebugToken = rawToken
	}
	return response, nil
}

func (s *Service) ResetPassword(ctx context.Context, req ResetPasswordRequest) error {
	if len(req.NewPassword) < 8 {
		return ValidationError{Message: "New password must be at least 8 characters."}
	}
	tokenHash := HashActionToken(req.Token)
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var tokenID, userID string
	err = tx.QueryRow(ctx, `
		select id::text, user_id::text
		  from auth_action_tokens
		 where token_hash = $1
		   and purpose = $2
		   and consumed_at is null
		   and expires_at > now()
		 for update`, tokenHash, actionPasswordReset).Scan(&tokenID, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidActionToken
	}
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, "update users set password_hash = $2 where id = $1", userID, string(passwordHash)); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "update auth_action_tokens set consumed_at = now() where id = $1", tokenID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null", userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) RequestEmailVerification(ctx context.Context, userID string) (ActionStartedResponse, error) {
	user, err := s.findUserByID(ctx, userID)
	if err != nil {
		return ActionStartedResponse{}, err
	}
	if user.EmailVerified {
		return ActionStartedResponse{Message: "Your email is already verified."}, nil
	}
	rawToken, err := s.sendEmailVerification(ctx, user)
	if err != nil {
		return ActionStartedResponse{}, err
	}
	response := ActionStartedResponse{Message: "Verification email sent."}
	if s.cfg.Env != "production" {
		response.DebugToken = rawToken
	}
	return response, nil
}

func (s *Service) VerifyEmail(ctx context.Context, rawToken string) error {
	return s.consumeEmailToken(ctx, rawToken, actionEmailVerification)
}

func (s *Service) RequestEmailChange(ctx context.Context, userID string, req ChangeEmailRequest) (ActionStartedResponse, error) {
	newEmail, err := normalizeEmail(req.NewEmail)
	if err != nil {
		return ActionStartedResponse{}, err
	}
	passwordHash, user, err := s.findUserPasswordByID(ctx, userID)
	if err != nil {
		return ActionStartedResponse{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)) != nil {
		return ActionStartedResponse{}, ErrPasswordIncorrect
	}
	if strings.EqualFold(newEmail, user.Email) {
		return ActionStartedResponse{}, ValidationError{Message: "New email must be different from your current email."}
	}
	if exists, err := s.emailExists(ctx, newEmail); err != nil {
		return ActionStartedResponse{}, err
	} else if exists {
		return ActionStartedResponse{}, ErrEmailTaken
	}

	rawToken, err := s.createActionToken(ctx, userID, actionEmailChange, &newEmail)
	if err != nil {
		return ActionStartedResponse{}, err
	}
	link := s.actionLink("confirm-email", rawToken)
	if err := s.emailSender.Send(ctx, mailer.Message{
		To:      newEmail,
		Subject: "Confirm your new Budget Buddy email",
		Text:    fmt.Sprintf("Confirm this email address for Budget Buddy within %s:\n\n%s\n\nIf you did not request this, ignore this email.", s.actionTokenTTL, link),
	}); err != nil {
		s.logger.Error("email change message failed", "userId", userID, "error", err)
	}
	response := ActionStartedResponse{Message: "A confirmation link was sent to your new email."}
	if s.cfg.Env != "production" {
		response.DebugToken = rawToken
	}
	return response, nil
}

func (s *Service) ConfirmEmailChange(ctx context.Context, rawToken string) error {
	return s.consumeEmailToken(ctx, rawToken, actionEmailChange)
}

func (s *Service) ChangePassword(ctx context.Context, userID string, req ChangePasswordRequest) error {
	if len(req.NewPassword) < 8 {
		return ValidationError{Message: "New password must be at least 8 characters."}
	}
	currentHash, _, err := s.findUserPasswordByID(ctx, userID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.CurrentPassword)) != nil {
		return ErrPasswordIncorrect
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, "update users set password_hash = $2 where id = $1", userID, string(newHash)); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null", userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, req UpdateProfileRequest) (APIUser, error) {
	firstName := strings.TrimSpace(req.FirstName)
	lastName := strings.TrimSpace(req.LastName)
	if firstName == "" {
		return APIUser{}, ValidationError{Message: "First name is required."}
	}
	if len(firstName) > 80 || len(lastName) > 80 || len(req.Why) > 500 {
		return APIUser{}, ValidationError{Message: "Profile fields are too long."}
	}
	var user User
	err := scanUser(s.db.QueryRow(ctx, `
		update users
		   set first_name = $2, last_name = $3, why = $4
		 where id = $1
		 returning id::text, email, (email_verified_at is not null), first_name, last_name,
		           coalesce(avatar_url, ''), level, xp, xp_to_next_level, streak,
		           streak_best_ever, net_worth_cents, financial_health_score,
		           subscription_tier, onboarding_complete, why, why_icon, joined_at`,
		userID, firstName, lastName, strings.TrimSpace(req.Why)), &user)
	if errors.Is(err, pgx.ErrNoRows) {
		return APIUser{}, ErrUserNotFound
	}
	if err != nil {
		return APIUser{}, err
	}
	return user.API(), nil
}

func (s *Service) DeleteAccount(ctx context.Context, userID, password string) error {
	passwordHash, _, err := s.findUserPasswordByID(ctx, userID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) != nil {
		return ErrPasswordIncorrect
	}
	command, err := s.db.Exec(ctx, "delete from users where id = $1", userID)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (s *Service) sendEmailVerification(ctx context.Context, user User) (string, error) {
	rawToken, err := s.createActionToken(ctx, user.ID, actionEmailVerification, nil)
	if err != nil {
		return "", err
	}
	link := s.actionLink("verify-email", rawToken)
	err = s.emailSender.Send(ctx, mailer.Message{
		To:      user.Email,
		Subject: "Verify your Budget Buddy email",
		Text:    fmt.Sprintf("Welcome to Budget Buddy. Verify your email within %s:\n\n%s", s.actionTokenTTL, link),
	})
	return rawToken, err
}

func (s *Service) createActionToken(ctx context.Context, userID, purpose string, pendingEmail *string) (string, error) {
	rawToken, tokenHash, expiresAt, err := NewActionToken(s.actionTokenTTL)
	if err != nil {
		return "", err
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `
		update auth_action_tokens
		   set consumed_at = now()
		 where user_id = $1 and purpose = $2 and consumed_at is null`, userID, purpose); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		insert into auth_action_tokens (user_id, token_hash, purpose, pending_email, expires_at)
		values ($1, $2, $3, $4, $5)`, userID, tokenHash, purpose, pendingEmail, expiresAt); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return rawToken, nil
}

func (s *Service) consumeEmailToken(ctx context.Context, rawToken, purpose string) error {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var tokenID, userID string
	var pendingEmail *string
	err = tx.QueryRow(ctx, `
		select id::text, user_id::text, pending_email
		  from auth_action_tokens
		 where token_hash = $1 and purpose = $2
		   and consumed_at is null and expires_at > now()
		 for update`, HashActionToken(rawToken), purpose).Scan(&tokenID, &userID, &pendingEmail)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidActionToken
	}
	if err != nil {
		return err
	}

	if purpose == actionEmailChange {
		if pendingEmail == nil {
			return ErrInvalidActionToken
		}
		if _, err := tx.Exec(ctx, "update users set email = $2, email_verified_at = now() where id = $1", userID, *pendingEmail); err != nil {
			if isUniqueViolation(err) {
				return ErrEmailTaken
			}
			return err
		}
		if _, err := tx.Exec(ctx, "update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null", userID); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, "update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1", userID); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, "update auth_action_tokens set consumed_at = now() where id = $1", tokenID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) findUserPasswordByID(ctx context.Context, userID string) (string, User, error) {
	var passwordHash string
	var user User
	err := s.db.QueryRow(ctx, `
		select password_hash, id::text, email, (email_verified_at is not null), first_name,
		       last_name, coalesce(avatar_url, ''), level, xp, xp_to_next_level, streak,
		       streak_best_ever, net_worth_cents, financial_health_score, subscription_tier,
		       onboarding_complete, why, why_icon, joined_at
		  from users where id = $1`, userID).Scan(
		&passwordHash, &user.ID, &user.Email, &user.EmailVerified, &user.FirstName,
		&user.LastName, &user.Avatar, &user.Level, &user.XP, &user.XPToNextLevel,
		&user.Streak, &user.StreakBestEver, &user.NetWorthCents,
		&user.FinancialHealthScore, &user.SubscriptionTier, &user.OnboardingComplete,
		&user.Why, &user.WhyIcon, &user.JoinedAt,
	)
	return passwordHash, user, err
}

func (s *Service) emailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, "select exists(select 1 from users where lower(email) = lower($1))", email).Scan(&exists)
	return exists, err
}

func (s *Service) actionLink(path, token string) string {
	base := strings.TrimSpace(s.cfg.AppPublicURL)
	separator := "/"
	if strings.HasSuffix(base, "://") || strings.HasSuffix(base, "/") {
		separator = ""
	}
	return base + separator + path + "?token=" + url.QueryEscape(token)
}
