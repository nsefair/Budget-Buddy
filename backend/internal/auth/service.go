package auth

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/mail"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"budget-buddy/backend/internal/config"
	"budget-buddy/backend/internal/mailer"
)

type Service struct {
	db              *pgxpool.Pool
	tokens          TokenManager
	refreshTokenTTL time.Duration
	actionTokenTTL  time.Duration
	cfg             config.Config
	logger          *slog.Logger
	emailSender     mailer.Sender
}

type RegisterRequest struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type AuthResponse struct {
	AccessToken  string  `json:"accessToken"`
	RefreshToken string  `json:"refreshToken"`
	User         APIUser `json:"user"`
}

type TokenResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

type OnboardingRequest struct {
	FirstName       string            `json:"firstName"`
	AgeRange        *string           `json:"ageRange"`
	Situation       *string           `json:"situation"`
	GoalKinds       []string          `json:"goalKinds"`
	CustomGoalLabel string            `json:"customGoalLabel"`
	Why             string            `json:"why"`
	WhyIcon         string            `json:"whyIcon"`
	BankConnected   bool              `json:"bankConnected"`
	Plan            PlanRequest       `json:"plan"`
	FirstGoal       *FirstGoalRequest `json:"firstGoal"`
	FirstQuest      json.RawMessage   `json:"firstQuest"`
	ShareToBuds     bool              `json:"shareToBuds"`
}

type PlanRequest struct {
	Tier       string `json:"tier"`
	Cycle      string `json:"cycle"`
	IsLifetime bool   `json:"isLifetime"`
}

type FirstGoalRequest struct {
	Kind         string  `json:"kind"`
	Name         string  `json:"name"`
	TargetAmount float64 `json:"targetAmount"`
	AlreadySaved float64 `json:"alreadySaved"`
	Deadline     *string `json:"deadline"`
	Reason       string  `json:"reason"`
}

func NewService(db *pgxpool.Pool, cfg config.Config, logger *slog.Logger) *Service {
	return &Service{
		db:              db,
		tokens:          NewTokenManager(cfg),
		refreshTokenTTL: cfg.RefreshTokenTTL,
		actionTokenTTL:  cfg.AuthActionTokenTTL,
		cfg:             cfg,
		logger:          logger,
		emailSender:     mailer.New(cfg, logger),
	}
}

func (s *Service) Register(ctx context.Context, req RegisterRequest) (AuthResponse, error) {
	firstName := strings.TrimSpace(req.FirstName)
	lastName := strings.TrimSpace(req.LastName)
	email, err := normalizeEmail(req.Email)
	if err != nil {
		return AuthResponse{}, err
	}
	if firstName == "" {
		return AuthResponse{}, ValidationError{Message: "First name is required."}
	}
	if len(req.Password) < 8 {
		return AuthResponse{}, ValidationError{Message: "Password must be at least 8 characters."}
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return AuthResponse{}, err
	}

	user, err := s.insertUser(ctx, firstName, lastName, email, string(passwordHash))
	if err != nil {
		if isUniqueViolation(err) {
			return AuthResponse{}, ErrEmailTaken
		}
		return AuthResponse{}, err
	}

	accessToken, refreshToken, err := s.issueTokens(ctx, user)
	if err != nil {
		return AuthResponse{}, err
	}
	if _, err := s.sendEmailVerification(ctx, user); err != nil {
		s.logger.Error("registration verification email failed", "userId", user.ID, "error", err)
	}

	return AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user.API(),
	}, nil
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (AuthResponse, error) {
	email, err := normalizeEmail(req.Email)
	if err != nil {
		return AuthResponse{}, ErrInvalidCredentials
	}
	if strings.TrimSpace(req.Password) == "" {
		return AuthResponse{}, ErrInvalidCredentials
	}

	passwordHash, user, err := s.findUserWithPasswordByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AuthResponse{}, ErrInvalidCredentials
		}
		return AuthResponse{}, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		return AuthResponse{}, ErrInvalidCredentials
	}

	accessToken, refreshToken, err := s.issueTokens(ctx, user)
	if err != nil {
		return AuthResponse{}, err
	}

	return AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user.API(),
	}, nil
}

func (s *Service) Refresh(ctx context.Context, rawRefreshToken string) (TokenResponse, error) {
	rawRefreshToken = strings.TrimSpace(rawRefreshToken)
	if rawRefreshToken == "" {
		return TokenResponse{}, ErrInvalidRefreshToken
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return TokenResponse{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	tokenHash := HashRefreshToken(rawRefreshToken)
	refreshTokenID, user, err := s.findUserByRefreshToken(ctx, tx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TokenResponse{}, ErrInvalidRefreshToken
		}
		return TokenResponse{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"update refresh_tokens set revoked_at = now() where id = $1",
		refreshTokenID,
	); err != nil {
		return TokenResponse{}, err
	}

	accessToken, _, err := s.tokens.GenerateAccessToken(user)
	if err != nil {
		return TokenResponse{}, err
	}

	newRefreshToken, newRefreshHash, expiresAt, err := NewRefreshToken(s.refreshTokenTTL)
	if err != nil {
		return TokenResponse{}, err
	}
	if _, err := tx.Exec(
		ctx,
		"insert into refresh_tokens (user_id, token_hash, expires_at) values ($1, $2, $3)",
		user.ID,
		newRefreshHash,
		expiresAt,
	); err != nil {
		return TokenResponse{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return TokenResponse{}, err
	}

	return TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
	}, nil
}

func (s *Service) Logout(ctx context.Context, userID string) error {
	if userID == "" {
		return nil
	}
	_, err := s.db.Exec(
		ctx,
		"update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null",
		userID,
	)
	return err
}

func (s *Service) GetMe(ctx context.Context, userID string) (APIUser, error) {
	user, err := s.findUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return APIUser{}, ErrUserNotFound
		}
		return APIUser{}, err
	}
	return user.API(), nil
}

func (s *Service) CompleteOnboarding(ctx context.Context, userID string, req OnboardingRequest) (APIUser, error) {
	firstName := strings.TrimSpace(req.FirstName)
	if firstName == "" {
		return APIUser{}, ValidationError{Message: "First name is required."}
	}
	if len(req.GoalKinds) == 0 {
		return APIUser{}, ValidationError{Message: "Choose at least one goal."}
	}

	tier := normalizeTier(req.Plan.Tier)
	why := strings.TrimSpace(req.Why)
	whyIcon := strings.TrimSpace(req.WhyIcon)
	if whyIcon == "" {
		whyIcon = "sparkles"
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return APIUser{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(
		ctx,
		`update users
		 set first_name = $2,
		     onboarding_complete = true,
		     why = $3,
		     why_icon = $4,
		     streak = greatest(streak, 1),
		     streak_best_ever = greatest(streak_best_ever, 1)
		 where id = $1`,
		userID,
		firstName,
		why,
		whyIcon,
	); err != nil {
		return APIUser{}, err
	}

	firstGoalJSON, err := json.Marshal(req.FirstGoal)
	if err != nil {
		return APIUser{}, err
	}

	if _, err := tx.Exec(
		ctx,
		`insert into onboarding_profiles (
		   user_id, age_range, life_situation, goal_kinds, custom_goal_label,
		   why, why_icon, first_goal, first_quest, requested_plan_tier,
		   requested_plan_cycle, requested_plan_lifetime, completed_at
		 )
		 values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, now())
		 on conflict (user_id) do update set
		   age_range = excluded.age_range,
		   life_situation = excluded.life_situation,
		   goal_kinds = excluded.goal_kinds,
		   custom_goal_label = excluded.custom_goal_label,
		   why = excluded.why,
		   why_icon = excluded.why_icon,
		   first_goal = excluded.first_goal,
		   first_quest = excluded.first_quest,
		   requested_plan_tier = excluded.requested_plan_tier,
		   requested_plan_cycle = excluded.requested_plan_cycle,
		   requested_plan_lifetime = excluded.requested_plan_lifetime,
		   completed_at = coalesce(onboarding_profiles.completed_at, excluded.completed_at)`,
		userID,
		req.AgeRange,
		req.Situation,
		req.GoalKinds,
		emptyToNil(req.CustomGoalLabel),
		why,
		whyIcon,
		string(firstGoalJSON),
		jsonOrNull(req.FirstQuest),
		tier,
		normalizeBillingCycle(req.Plan.Cycle),
		req.Plan.IsLifetime,
	); err != nil {
		return APIUser{}, err
	}

	if req.FirstGoal != nil {
		if err := s.createFirstGoalIfNeeded(ctx, tx, userID, *req.FirstGoal); err != nil {
			return APIUser{}, err
		}
	}

	var user User
	if err := scanUser(tx.QueryRow(ctx, userSelectSQL+" where id = $1", userID), &user); err != nil {
		return APIUser{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return APIUser{}, err
	}

	return user.API(), nil
}

func (s *Service) ParseAccessToken(raw string) (AccessClaims, error) {
	return s.tokens.ParseAccessToken(raw)
}

func (s *Service) insertUser(ctx context.Context, firstName, lastName, email, passwordHash string) (User, error) {
	var user User
	err := scanUser(
		s.db.QueryRow(
			ctx,
			`insert into users (first_name, last_name, email, password_hash)
			 values ($1, $2, $3, $4)
			 returning id::text, email, (email_verified_at is not null), first_name, last_name, coalesce(avatar_url, ''),
			           level, xp, xp_to_next_level, streak, streak_best_ever,
			           net_worth_cents, financial_health_score, subscription_tier,
			           onboarding_complete, why, why_icon, joined_at`,
			firstName,
			lastName,
			email,
			passwordHash,
		),
		&user,
	)
	return user, err
}

func (s *Service) findUserWithPasswordByEmail(ctx context.Context, email string) (string, User, error) {
	var passwordHash string
	var user User
	err := s.db.QueryRow(
		ctx,
		`select password_hash, id::text, email, (email_verified_at is not null), first_name, last_name, coalesce(avatar_url, ''),
		        level, xp, xp_to_next_level, streak, streak_best_ever,
		        net_worth_cents, financial_health_score, subscription_tier,
		        onboarding_complete, why, why_icon, joined_at
		   from users
		  where lower(email) = lower($1)`,
		email,
	).Scan(
		&passwordHash,
		&user.ID,
		&user.Email,
		&user.EmailVerified,
		&user.FirstName,
		&user.LastName,
		&user.Avatar,
		&user.Level,
		&user.XP,
		&user.XPToNextLevel,
		&user.Streak,
		&user.StreakBestEver,
		&user.NetWorthCents,
		&user.FinancialHealthScore,
		&user.SubscriptionTier,
		&user.OnboardingComplete,
		&user.Why,
		&user.WhyIcon,
		&user.JoinedAt,
	)
	return passwordHash, user, err
}

func (s *Service) findUserByID(ctx context.Context, userID string) (User, error) {
	var user User
	err := scanUser(s.db.QueryRow(ctx, userSelectSQL+" where id = $1", userID), &user)
	return user, err
}

func (s *Service) findUserByRefreshToken(ctx context.Context, tx pgx.Tx, tokenHash string) (string, User, error) {
	var refreshTokenID string
	var user User
	err := tx.QueryRow(
		ctx,
		`select rt.id::text, u.id::text, u.email, (u.email_verified_at is not null), u.first_name, u.last_name, coalesce(u.avatar_url, ''),
		        u.level, u.xp, u.xp_to_next_level, u.streak, u.streak_best_ever,
		        u.net_worth_cents, u.financial_health_score, u.subscription_tier,
		        u.onboarding_complete, u.why, u.why_icon, u.joined_at
		   from refresh_tokens rt
		   join users u on u.id = rt.user_id
		  where rt.token_hash = $1
		    and rt.revoked_at is null
		    and rt.expires_at > now()
		  for update`,
		tokenHash,
	).Scan(
		&refreshTokenID,
		&user.ID,
		&user.Email,
		&user.EmailVerified,
		&user.FirstName,
		&user.LastName,
		&user.Avatar,
		&user.Level,
		&user.XP,
		&user.XPToNextLevel,
		&user.Streak,
		&user.StreakBestEver,
		&user.NetWorthCents,
		&user.FinancialHealthScore,
		&user.SubscriptionTier,
		&user.OnboardingComplete,
		&user.Why,
		&user.WhyIcon,
		&user.JoinedAt,
	)
	return refreshTokenID, user, err
}

func (s *Service) issueTokens(ctx context.Context, user User) (string, string, error) {
	accessToken, _, err := s.tokens.GenerateAccessToken(user)
	if err != nil {
		return "", "", err
	}

	refreshToken, refreshHash, expiresAt, err := NewRefreshToken(s.refreshTokenTTL)
	if err != nil {
		return "", "", err
	}

	if _, err := s.db.Exec(
		ctx,
		"insert into refresh_tokens (user_id, token_hash, expires_at) values ($1, $2, $3)",
		user.ID,
		refreshHash,
		expiresAt,
	); err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

func (s *Service) createFirstGoalIfNeeded(ctx context.Context, tx pgx.Tx, userID string, goal FirstGoalRequest) error {
	exists := false
	if err := tx.QueryRow(ctx, "select exists(select 1 from goals where user_id = $1)", userID).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}

	deadline := time.Now().UTC().AddDate(1, 0, 0)
	if goal.Deadline != nil && strings.TrimSpace(*goal.Deadline) != "" {
		parsed, err := parseDeadline(*goal.Deadline)
		if err != nil {
			return ValidationError{Message: "Goal deadline must be a valid date."}
		}
		deadline = parsed
	}

	kind := normalizeGoalKind(goal.Kind)
	name := strings.TrimSpace(goal.Name)
	if name == "" {
		name = "First goal"
	}

	_, err := tx.Exec(
		ctx,
		`insert into goals (
		   user_id, name, kind, duration, reason, target_amount_cents,
		   already_saved_cents, monthly_commit_cents, deadline
		 )
		 values ($1, $2, $3, $4, $5, $6, $7, 0, $8)`,
		userID,
		name,
		kind,
		"medium",
		strings.TrimSpace(goal.Reason),
		dollarsToCents(goal.TargetAmount),
		dollarsToCents(goal.AlreadySaved),
		deadline,
	)
	return err
}

const userSelectSQL = `select id::text, email, (email_verified_at is not null), first_name, last_name, coalesce(avatar_url, ''),
       level, xp, xp_to_next_level, streak, streak_best_ever,
       net_worth_cents, financial_health_score, subscription_tier,
       onboarding_complete, why, why_icon, joined_at
  from users`

type userRow interface {
	Scan(dest ...any) error
}

func scanUser(row userRow, user *User) error {
	return row.Scan(
		&user.ID,
		&user.Email,
		&user.EmailVerified,
		&user.FirstName,
		&user.LastName,
		&user.Avatar,
		&user.Level,
		&user.XP,
		&user.XPToNextLevel,
		&user.Streak,
		&user.StreakBestEver,
		&user.NetWorthCents,
		&user.FinancialHealthScore,
		&user.SubscriptionTier,
		&user.OnboardingComplete,
		&user.Why,
		&user.WhyIcon,
		&user.JoinedAt,
	)
}

func normalizeEmail(value string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(value))
	if email == "" {
		return "", ValidationError{Message: "Email is required."}
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email {
		return "", ValidationError{Message: "Email must be valid."}
	}
	return email, nil
}

func normalizeTier(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "premium", "elite":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "free"
	}
}

func normalizeBillingCycle(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "annual") {
		return "annual"
	}
	return "monthly"
}

func normalizeGoalKind(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "emergency_fund", "debt_payoff", "savings_target", "invest", "income_growth", "stop_overspending", "custom":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "custom"
	}
}

func parseDeadline(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed.UTC(), nil
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return parsed.UTC(), nil
	}
	return time.Time{}, ValidationError{Message: "Goal deadline must be a valid date."}
}

func dollarsToCents(value float64) int64 {
	if value <= 0 {
		return 0
	}
	return int64(value*100 + 0.5)
}

func emptyToNil(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func jsonOrNull(value json.RawMessage) *string {
	if len(value) == 0 || string(value) == "null" {
		return nil
	}
	raw := string(value)
	return &raw
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
