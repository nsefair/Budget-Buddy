package buds

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/respond"
)

type authMiddleware func(http.Handler) http.Handler

type Handler struct {
	db       *pgxpool.Pool
	mediaDir string
	basePath string
}

type BudProfile struct {
	ID                   string `json:"id"`
	DisplayName          string `json:"displayName"`
	Avatar               string `json:"avatar,omitempty"`
	Initials             string `json:"initials"`
	Level                int    `json:"level"`
	Streak               int    `json:"streak"`
	LeagueTier           string `json:"leagueTier"`
	BadgeCount           int    `json:"badgeCount"`
	IsFollowing          bool   `json:"isFollowing"`
	FollowerCount        int    `json:"followerCount"`
	FollowingCount       int    `json:"followingCount"`
	FinancialHealthScore int    `json:"financialHealthScore,omitempty"`
}

type FeedPost struct {
	ID              string             `json:"id"`
	User            BudProfile         `json:"user"`
	Type            string             `json:"type"`
	Title           string             `json:"title"`
	Message         string             `json:"message"`
	Timestamp       string             `json:"timestamp"`
	FistBumps       int                `json:"fistBumps"`
	HasFistBumped   bool               `json:"hasFistBumped"`
	Visibility      string             `json:"visibility"`
	CommentsEnabled bool               `json:"commentsEnabled"`
	CommentCount    int                `json:"commentCount"`
	Achievement     *PublicAchievement `json:"achievement,omitempty"`
	Media           []FeedMedia        `json:"media"`
}

type PublicAchievement struct {
	Kind     string `json:"kind"`
	Label    string `json:"label"`
	Verified bool   `json:"verified"`
}

type FeedMedia struct {
	ID       string `json:"id"`
	URL      string `json:"url"`
	MimeType string `json:"mimeType"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Position int    `json:"position"`
}

type FeedPage struct {
	Items      []FeedPost `json:"items"`
	NextCursor string     `json:"nextCursor,omitempty"`
}

type WealthLeague struct {
	Tier            string       `json:"tier"`
	ResetDate       string       `json:"resetDate"`
	Users           []LeagueUser `json:"users"`
	CurrentUserRank int          `json:"currentUserRank"`
}

type LeagueUser struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Avatar         string `json:"avatar,omitempty"`
	Level          int    `json:"level"`
	XP             int    `json:"xp"`
	Streak         int    `json:"streak"`
	FinancialScore int    `json:"financialScore"`
	IsCurrentUser  bool   `json:"isCurrentUser,omitempty"`
}

type createPostRequest struct {
	Type             string   `json:"type"`
	Title            string   `json:"title"`
	Message          string   `json:"message"`
	Visibility       string   `json:"visibility"`
	CommentsEnabled  *bool    `json:"commentsEnabled"`
	MediaIDs         []string `json:"mediaIds"`
	AchievementKind  string   `json:"achievementKind"`
	AchievementRefID string   `json:"achievementRefId"`
}

type reportRequest struct {
	PostID  string `json:"postId"`
	Reason  string `json:"reason"`
	Details string `json:"details"`
}

type fistBumpResponse struct {
	NewCount      int  `json:"newCount"`
	HasFistBumped bool `json:"hasFistBumped"`
}

func RegisterRoutes(mux *http.ServeMux, basePath string, db *pgxpool.Pool, mediaDir string, requireAuth authMiddleware) {
	handler := &Handler{db: db, mediaDir: mediaDir, basePath: basePath}
	mux.Handle("GET "+basePath+"/buds/feed", requireAuth(http.HandlerFunc(handler.feedV2)))
	mux.Handle("GET "+basePath+"/buds/league", requireAuth(http.HandlerFunc(handler.league)))
	mux.Handle("GET "+basePath+"/buds/following", requireAuth(http.HandlerFunc(handler.following)))
	mux.Handle("GET "+basePath+"/buds/followers", requireAuth(http.HandlerFunc(handler.followers)))
	mux.Handle("GET "+basePath+"/buds/discover", requireAuth(http.HandlerFunc(handler.discover)))
	mux.Handle("GET "+basePath+"/buds/shareable-achievements", requireAuth(http.HandlerFunc(handler.shareableAchievements)))
	mux.Handle("GET "+basePath+"/buds/profile/{id}", requireAuth(http.HandlerFunc(handler.profile)))
	mux.Handle("POST "+basePath+"/buds/{id}/follow", requireAuth(http.HandlerFunc(handler.follow)))
	mux.Handle("POST "+basePath+"/buds/{id}/unfollow", requireAuth(http.HandlerFunc(handler.unfollow)))
	mux.Handle("POST "+basePath+"/buds/{id}/block", requireAuth(http.HandlerFunc(handler.block)))
	mux.Handle("POST "+basePath+"/buds/{id}/report", requireAuth(http.HandlerFunc(handler.report)))
	mux.Handle("POST "+basePath+"/buds/posts", requireAuth(http.HandlerFunc(handler.createPostV2)))
	mux.Handle("POST "+basePath+"/buds/posts/{id}/fist-bump", requireAuth(http.HandlerFunc(handler.fistBump)))
	mux.Handle("GET "+basePath+"/buds/posts/{id}/comments", requireAuth(http.HandlerFunc(handler.comments)))
	mux.Handle("POST "+basePath+"/buds/posts/{id}/comments", requireAuth(http.HandlerFunc(handler.addComment)))
	mux.Handle("POST "+basePath+"/buds/media", requireAuth(http.HandlerFunc(handler.uploadMedia)))
	mux.Handle("GET "+basePath+"/buds/media/{id}", requireAuth(http.HandlerFunc(handler.serveMedia)))
}

func (h *Handler) league(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())

	rows, err := h.db.Query(
		r.Context(),
		`with current_tier as (
		   select case
		            when financial_health_score >= 770 then 6
		            when financial_health_score >= 690 then 5
		            when financial_health_score >= 610 then 4
		            when financial_health_score >= 530 then 3
		            when financial_health_score >= 450 then 2
		            else 1
		          end as tier
		     from users where id = $1
		 ), ranked as (
		   select u.id::text,
		          u.first_name,
		          u.last_name,
		          coalesce(u.avatar_url, '') as avatar_url,
		          u.level,
		          u.xp,
		          u.streak,
		          u.financial_health_score,
		          row_number() over (
		            order by u.financial_health_score desc, u.xp desc, u.streak desc, u.joined_at asc
		          )::integer as league_rank
		     from users u
		     cross join current_tier ct
		    where u.onboarding_complete = true
		      and (case
		             when u.financial_health_score >= 770 then 6
		             when u.financial_health_score >= 690 then 5
		             when u.financial_health_score >= 610 then 4
		             when u.financial_health_score >= 530 then 3
		             when u.financial_health_score >= 450 then 2
		             else 1
		           end) = ct.tier
		      and not exists (
		        select 1 from bud_blocks b
		         where (b.blocker_id = $1::uuid and b.blocked_id = u.id)
		            or (b.blocker_id = u.id and b.blocked_id = $1::uuid)
		      )
		 )
		 select id, first_name, last_name, avatar_url, level, xp, streak, financial_health_score,
		        league_rank, id = $1::text as is_current_user
		   from ranked
		  where league_rank <= 30 or id = $1::text
		  order by league_rank asc`,
		userID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_league_failed", "Could not load Wealth League.")
		return
	}
	defer rows.Close()

	users := []LeagueUser{}
	currentRank := 0
	currentScore := 500
	for rows.Next() {
		var user LeagueUser
		var firstName string
		var lastName string
		var rank int
		if err := rows.Scan(
			&user.ID,
			&firstName,
			&lastName,
			&user.Avatar,
			&user.Level,
			&user.XP,
			&user.Streak,
			&user.FinancialScore,
			&rank,
			&user.IsCurrentUser,
		); err != nil {
			respond.Error(w, http.StatusInternalServerError, "buds_league_failed", "Could not load Wealth League.")
			return
		}
		user.Name, _ = displayName(firstName, lastName)
		if user.IsCurrentUser {
			currentRank = rank
			currentScore = user.FinancialScore
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_league_failed", "Could not load Wealth League.")
		return
	}

	respond.JSON(w, http.StatusOK, WealthLeague{
		Tier:            financialScoreLeagueTier(currentScore),
		ResetDate:       nextLeagueReset().Format(time.RFC3339),
		Users:           users,
		CurrentUserRank: currentRank,
	})
}

func (h *Handler) following(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	rows, err := h.db.Query(
		r.Context(),
		`select u.id::text, u.first_name, u.last_name, coalesce(u.avatar_url, ''),
		        u.level, u.streak, u.financial_health_score, true as is_following,
		        (select count(*) from bud_follows c where c.following_id = u.id) as follower_count,
		        (select count(*) from bud_follows c where c.follower_id = u.id) as following_count
		   from bud_follows f
		   join users u on u.id = f.following_id
		  where f.follower_id = $1
		    and not exists (
		      select 1 from bud_blocks b
		       where (b.blocker_id = $1 and b.blocked_id = u.id)
		          or (b.blocker_id = u.id and b.blocked_id = $1)
		    )
		  order by f.created_at desc`,
		userID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_following_failed", "Could not load your Buds.")
		return
	}
	defer rows.Close()

	profiles, err := scanProfiles(rows)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_following_failed", "Could not load your Buds.")
		return
	}
	respond.JSON(w, http.StatusOK, profiles)
}

func (h *Handler) followers(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	rows, err := h.db.Query(
		r.Context(),
		`select u.id::text, u.first_name, u.last_name, coalesce(u.avatar_url, ''),
		        u.level, u.streak, u.financial_health_score,
		        exists(select 1 from bud_follows c where c.follower_id = $1 and c.following_id = u.id) as is_following,
		        (select count(*) from bud_follows c where c.following_id = u.id) as follower_count,
		        (select count(*) from bud_follows c where c.follower_id = u.id) as following_count
		   from bud_follows f
		   join users u on u.id = f.follower_id
		  where f.following_id = $1
		    and not exists (
		      select 1 from bud_blocks b
		       where (b.blocker_id = $1 and b.blocked_id = u.id)
		          or (b.blocker_id = u.id and b.blocked_id = $1)
		    )
		  order by f.created_at desc`,
		userID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_followers_failed", "Could not load your Bud followers.")
		return
	}
	defer rows.Close()

	profiles, err := scanProfiles(rows)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_followers_failed", "Could not load your Bud followers.")
		return
	}
	respond.JSON(w, http.StatusOK, profiles)
}

func (h *Handler) discover(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	rows, err := h.db.Query(
		r.Context(),
		`select u.id::text, u.first_name, u.last_name, coalesce(u.avatar_url, ''),
		        u.level, u.streak, u.financial_health_score,
		        exists(select 1 from bud_follows f where f.follower_id = $1 and f.following_id = u.id) as is_following,
		        (select count(*) from bud_follows f where f.following_id = u.id) as follower_count,
		        (select count(*) from bud_follows f where f.follower_id = u.id) as following_count
		   from users u
		  where u.id <> $1
		    and u.onboarding_complete = true
		    and not exists (
		      select 1 from bud_blocks b
		       where (b.blocker_id = $1 and b.blocked_id = u.id)
		          or (b.blocker_id = u.id and b.blocked_id = $1)
		    )
		  order by u.level desc, u.streak desc, u.joined_at desc
		  limit 30`,
		userID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_discover_failed", "Could not load suggested Buds.")
		return
	}
	defer rows.Close()

	profiles, err := scanProfiles(rows)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_discover_failed", "Could not load suggested Buds.")
		return
	}
	respond.JSON(w, http.StatusOK, profiles)
}

func (h *Handler) profile(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	targetID := r.PathValue("id")

	var profile BudProfile
	err := scanProfile(
		h.db.QueryRow(
			r.Context(),
			`select u.id::text, u.first_name, u.last_name, coalesce(u.avatar_url, ''),
			        u.level, u.streak, u.financial_health_score,
			        exists(select 1 from bud_follows f where f.follower_id = $1 and f.following_id = u.id) as is_following,
			        (select count(*) from bud_follows f where f.following_id = u.id) as follower_count,
			        (select count(*) from bud_follows f where f.follower_id = u.id) as following_count
			   from users u
			  where u.id = $2 and u.onboarding_complete = true
			    and not exists (
			      select 1 from bud_blocks b
			       where (b.blocker_id = $1 and b.blocked_id = u.id)
			          or (b.blocker_id = u.id and b.blocked_id = $1)
			    )`,
			userID,
			targetID,
		),
		&profile,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respond.Error(w, http.StatusNotFound, "bud_not_found", "Bud not found.")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "bud_profile_failed", "Could not load Bud profile.")
		return
	}

	respond.JSON(w, http.StatusOK, profile)
}

func (h *Handler) follow(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	targetID := r.PathValue("id")
	if userID == targetID {
		respond.Error(w, http.StatusBadRequest, "validation_error", "You cannot follow yourself.")
		return
	}

	result, err := h.db.Exec(
		r.Context(),
		`insert into bud_follows (follower_id, following_id)
		 select $1, $2
		 where exists(select 1 from users where id = $2 and onboarding_complete = true)
		   and not exists (
		     select 1 from bud_blocks b
		      where (b.blocker_id = $1 and b.blocked_id = $2)
		         or (b.blocker_id = $2 and b.blocked_id = $1)
		   )
		 on conflict do nothing`,
		userID,
		targetID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "bud_follow_failed", "Could not follow this Bud.")
		return
	}
	if result.RowsAffected() == 0 {
		allowed, err := h.canSeeUser(r, userID, targetID)
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "bud_follow_failed", "Could not follow this Bud.")
			return
		}
		if !allowed {
			respond.Error(w, http.StatusNotFound, "bud_not_found", "Bud not found.")
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) unfollow(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	targetID := r.PathValue("id")

	_, err := h.db.Exec(
		r.Context(),
		"delete from bud_follows where follower_id = $1 and following_id = $2",
		userID,
		targetID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "bud_unfollow_failed", "Could not unfollow this Bud.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) block(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	targetID := r.PathValue("id")
	if userID == targetID {
		respond.Error(w, http.StatusBadRequest, "validation_error", "You cannot block yourself.")
		return
	}

	tx, err := h.db.BeginTx(r.Context(), pgx.TxOptions{})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "bud_block_failed", "Could not block this Bud.")
		return
	}
	defer func() {
		_ = tx.Rollback(r.Context())
	}()

	result, err := tx.Exec(
		r.Context(),
		`insert into bud_blocks (blocker_id, blocked_id)
		 select $1, $2
		 where exists(select 1 from users where id = $2)
		 on conflict do nothing`,
		userID,
		targetID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "bud_block_failed", "Could not block this Bud.")
		return
	}
	if result.RowsAffected() == 0 {
		exists := false
		if err := tx.QueryRow(r.Context(), "select exists(select 1 from users where id = $1)", targetID).Scan(&exists); err != nil {
			respond.Error(w, http.StatusInternalServerError, "bud_block_failed", "Could not block this Bud.")
			return
		}
		if !exists {
			respond.Error(w, http.StatusNotFound, "bud_not_found", "Bud not found.")
			return
		}
	}

	if _, err := tx.Exec(
		r.Context(),
		`delete from bud_follows
		  where (follower_id = $1 and following_id = $2)
		     or (follower_id = $2 and following_id = $1)`,
		userID,
		targetID,
	); err != nil {
		respond.Error(w, http.StatusInternalServerError, "bud_block_failed", "Could not block this Bud.")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respond.Error(w, http.StatusInternalServerError, "bud_block_failed", "Could not block this Bud.")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) report(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	targetID := r.PathValue("id")
	if userID == targetID {
		respond.Error(w, http.StatusBadRequest, "validation_error", "You cannot report yourself.")
		return
	}

	var req reportRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}

	reason := normalizeReportReason(req.Reason)
	details := cleanPublicText(req.Details, 500)
	postID := strings.TrimSpace(req.PostID)

	result, err := h.db.Exec(
		r.Context(),
		`insert into bud_reports (reporter_id, reported_user_id, post_id, reason, details)
		 select $1, $2, nullif($3, '')::uuid, $4, $5
		 where exists(select 1 from users where id = $2)`,
		userID,
		targetID,
		postID,
		reason,
		details,
	)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "bud_report_failed", "Could not report this Bud.")
		return
	}
	if result.RowsAffected() == 0 {
		respond.Error(w, http.StatusNotFound, "bud_not_found", "Bud not found.")
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *Handler) fistBump(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	postID := r.PathValue("id")

	tx, err := h.db.BeginTx(r.Context(), pgx.TxOptions{})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "fist_bump_failed", "Could not send Fist Bump.")
		return
	}
	defer func() {
		_ = tx.Rollback(r.Context())
	}()

	var postOwnerID string
	visible := false
	err = tx.QueryRow(
		r.Context(),
		`select p.user_id::text,
		        not exists (
		          select 1 from bud_blocks b
		           where (b.blocker_id = $1 and b.blocked_id = p.user_id)
		              or (b.blocker_id = p.user_id and b.blocked_id = $1)
		        )
		        and (
		          p.user_id = $1
		          or (p.visibility = 'buds' and exists (
		            select 1 from bud_follows f where f.follower_id = $1 and f.following_id = p.user_id
		          ))
		        ) as visible
		   from buds_posts p
		  where p.id = $2 and p.deleted_at is null`,
		userID,
		postID,
	).Scan(&postOwnerID, &visible)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respond.Error(w, http.StatusNotFound, "post_not_found", "Post not found.")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "fist_bump_failed", "Could not send Fist Bump.")
		return
	}
	if !visible {
		respond.Error(w, http.StatusNotFound, "post_not_found", "Post not found.")
		return
	}
	if postOwnerID == userID {
		respond.Error(w, http.StatusBadRequest, "validation_error", "You cannot Fist Bump your own win.")
		return
	}

	exists := false
	err = tx.QueryRow(
		r.Context(),
		"select exists(select 1 from buds_fist_bumps where post_id = $1 and user_id = $2)",
		postID,
		userID,
	).Scan(&exists)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "fist_bump_failed", "Could not send Fist Bump.")
		return
	}

	hasFistBumped := !exists
	if exists {
		if _, err := tx.Exec(r.Context(), "delete from buds_fist_bumps where post_id = $1 and user_id = $2", postID, userID); err != nil {
			respond.Error(w, http.StatusInternalServerError, "fist_bump_failed", "Could not update Fist Bump.")
			return
		}
	} else {
		if _, err := tx.Exec(r.Context(), "insert into buds_fist_bumps (post_id, user_id) values ($1, $2) on conflict do nothing", postID, userID); err != nil {
			respond.Error(w, http.StatusNotFound, "post_not_found", "Post not found.")
			return
		}
	}

	newCount := 0
	if err := tx.QueryRow(r.Context(), "select count(*) from buds_fist_bumps where post_id = $1", postID).Scan(&newCount); err != nil {
		respond.Error(w, http.StatusInternalServerError, "fist_bump_failed", "Could not update Fist Bump.")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respond.Error(w, http.StatusInternalServerError, "fist_bump_failed", "Could not update Fist Bump.")
		return
	}

	respond.JSON(w, http.StatusOK, fistBumpResponse{
		NewCount:      newCount,
		HasFistBumped: hasFistBumped,
	})
}

type feedRow interface {
	Scan(dest ...any) error
}

type profileRow interface {
	Scan(dest ...any) error
}

func scanProfiles(rows pgx.Rows) ([]BudProfile, error) {
	profiles := []BudProfile{}
	for rows.Next() {
		var profile BudProfile
		if err := scanProfile(rows, &profile); err != nil {
			return nil, err
		}
		profiles = append(profiles, profile)
	}
	return profiles, rows.Err()
}

func scanProfile(row profileRow, profile *BudProfile) error {
	var firstName string
	var lastName string
	err := row.Scan(
		&profile.ID,
		&firstName,
		&lastName,
		&profile.Avatar,
		&profile.Level,
		&profile.Streak,
		&profile.FinancialHealthScore,
		&profile.IsFollowing,
		&profile.FollowerCount,
		&profile.FollowingCount,
	)
	if err != nil {
		return err
	}
	profile.DisplayName, profile.Initials = displayName(firstName, lastName)
	profile.LeagueTier = financialScoreLeagueTier(profile.FinancialHealthScore)
	profile.BadgeCount = badgeCount(profile.Level, profile.Streak)
	return nil
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func (h *Handler) canSeeUser(r *http.Request, userID, targetID string) (bool, error) {
	allowed := false
	err := h.db.QueryRow(
		r.Context(),
		`select exists(
		  select 1 from users u
		   where u.id = $2
		     and u.onboarding_complete = true
		     and not exists (
		       select 1 from bud_blocks b
		        where (b.blocker_id = $1 and b.blocked_id = u.id)
		           or (b.blocker_id = u.id and b.blocked_id = $1)
		     )
		)`,
		userID,
		targetID,
	).Scan(&allowed)
	return allowed, err
}

func displayName(firstName, lastName string) (string, string) {
	firstName = strings.TrimSpace(firstName)
	lastName = strings.TrimSpace(lastName)
	if firstName == "" {
		firstName = "Bud"
	}
	initials := firstInitial(firstName)
	if lastName != "" {
		lastInitial := firstInitial(lastName)
		initials += lastInitial
		return firstName + " " + lastInitial + ".", initials
	}
	return firstName, initials
}

func firstInitial(value string) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) == 0 {
		return ""
	}
	return strings.ToUpper(string(runes[0]))
}

func nextLeagueReset() time.Time {
	now := time.Now().UTC()
	daysUntilMonday := (8 - int(now.Weekday())) % 7
	if daysUntilMonday == 0 {
		daysUntilMonday = 7
	}
	reset := time.Date(
		now.Year(),
		now.Month(),
		now.Day(),
		0,
		0,
		0,
		0,
		time.UTC,
	).AddDate(0, 0, daysUntilMonday)
	return reset
}

func leagueTier(level int) string {
	switch {
	case level >= 20:
		return "Platinum"
	case level >= 10:
		return "Gold"
	case level >= 5:
		return "Silver"
	default:
		return "Bronze"
	}
}

func financialScoreLeagueTier(score int) string {
	switch {
	case score >= 770:
		return "Champion"
	case score >= 690:
		return "Diamond"
	case score >= 610:
		return "Platinum"
	case score >= 530:
		return "Gold"
	case score >= 450:
		return "Silver"
	default:
		return "Bronze"
	}
}

func badgeCount(level, streak int) int {
	count := level / 3
	if streak >= 7 {
		count++
	}
	if streak >= 30 {
		count++
	}
	return count
}

func normalizePostType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "quest_complete", "goal_milestone", "score_milestone", "league_progress", "level_up", "streak_milestone", "badge_earned", "week_review":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "quest_complete"
	}
}

func normalizeReportReason(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "spam", "harassment", "privacy", "unsafe_social_content", "impersonation":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "other"
	}
}

func cleanPublicText(value string, max int) string {
	value = strings.Join(strings.Fields(value), " ")
	runes := []rune(value)
	if len(runes) > max {
		return string(runes[:max])
	}
	return value
}

var sensitivePattern = regexp.MustCompile(`(?i)(\$|£|€|\b\d[\d,.]*\s*(dollars?|bucks?|usd)\b|\bbalance\b|\bincome\b|\bdebt balance\b|\btransaction\b|\bspent\b|\bspending\b|\bsalary\b|\bpaycheck\b|\baccount\b|\b(saved?|saving|paid|earned)\b.{0,30}\b\d[\d,.]*\b)`)
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

func looksFinanciallySensitive(value string) bool {
	return sensitivePattern.MatchString(value)
}
