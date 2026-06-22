package buds

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/respond"
)

const (
	defaultFeedLimit = 10
	maxFeedLimit     = 30
	maxMediaBytes    = 8 << 20
	maxPostMedia     = 4
)

const richPostSelect = `select p.id::text, p.type, p.title, p.message, p.created_at,
       u.id::text, u.first_name, u.last_name, coalesce(u.avatar_url, ''),
       u.level, u.streak, u.financial_health_score,
       exists(select 1 from bud_follows f where f.follower_id = $1 and f.following_id = u.id) as is_following,
       (select count(*) from bud_follows f where f.following_id = u.id) as follower_count,
       (select count(*) from bud_follows f where f.follower_id = u.id) as following_count,
       (select count(*) from buds_fist_bumps b where b.post_id = p.id) as fist_bumps,
       exists(select 1 from buds_fist_bumps b where b.post_id = p.id and b.user_id = $1) as has_fist_bumped,
       p.visibility, p.comments_enabled,
       (select count(*) from buds_post_comments c where c.post_id = p.id and c.deleted_at is null) as comment_count,
       coalesce(p.achievement_kind, ''), coalesce(p.achievement_label, ''), p.is_verified,
       (select coalesce(jsonb_agg(jsonb_build_object(
          'id', m.id::text,
          'mimeType', m.mime_type,
          'width', m.width,
          'height', m.height,
          'position', m.position
        ) order by m.position), '[]'::jsonb)
          from buds_post_media m where m.post_id = p.id) as media
  from buds_posts p
  join users u on u.id = p.user_id`

func (h *Handler) feedV2(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	limit := feedLimit(r.URL.Query().Get("limit"))
	cursorTime, cursorID, err := decodeFeedCursor(r.URL.Query().Get("cursor"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_cursor", "That feed page is no longer available. Refresh to start again.")
		return
	}

	rows, err := h.db.Query(
		r.Context(),
		richPostSelect+`
         where p.deleted_at is null
           and not exists (
             select 1 from bud_blocks b
              where (b.blocker_id = $1 and b.blocked_id = u.id)
                 or (b.blocker_id = u.id and b.blocked_id = $1)
           )
           and (
             p.user_id = $1
             or (p.visibility = 'buds' and exists (
               select 1 from bud_follows f where f.follower_id = $1 and f.following_id = p.user_id
             ))
           )
           and ($2::timestamptz is null or (p.created_at, p.id) < ($2::timestamptz, nullif($3, '')::uuid))
         order by p.created_at desc, p.id desc
         limit $4`,
		userID,
		cursorTime,
		cursorID,
		limit+1,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_feed_failed", "Could not load Buds feed.")
		return
	}
	defer rows.Close()

	posts := make([]FeedPost, 0, limit)
	for rows.Next() {
		post, err := h.scanRichFeedPost(rows)
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "buds_feed_failed", "Could not load Buds feed.")
			return
		}
		posts = append(posts, post)
	}
	if err := rows.Err(); err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_feed_failed", "Could not load Buds feed.")
		return
	}

	nextCursor := ""
	if len(posts) > limit {
		posts = posts[:limit]
		last := posts[len(posts)-1]
		nextCursor = encodeFeedCursor(last.Timestamp, last.ID)
	}
	respond.JSON(w, http.StatusOK, FeedPage{Items: posts, NextCursor: nextCursor})
}

func (h *Handler) createPostV2(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())

	var req createPostRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	if len(req.MediaIDs) > maxPostMedia || hasDuplicateStrings(req.MediaIDs) {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Choose up to four different images for a post.")
		return
	}

	visibility := normalizeVisibility(req.Visibility)
	commentsEnabled := true
	if req.CommentsEnabled != nil {
		commentsEnabled = *req.CommentsEnabled
	}
	postType := normalizePostType(req.Type)
	title := cleanPublicText(req.Title, 100)
	message := cleanPublicText(req.Message, 280)
	achievementKind := strings.ToLower(strings.TrimSpace(req.AchievementKind))
	achievementRefID := strings.TrimSpace(req.AchievementRefID)
	achievementLabel := ""
	verified := false

	if achievementKind != "" {
		var err error
		postType, title, achievementLabel, verified, err = h.verifyAchievement(
			r.Context(), userID, achievementKind, achievementRefID,
		)
		if err != nil {
			respond.Error(w, http.StatusBadRequest, "achievement_not_verified", err.Error())
			return
		}
	}

	if title == "" {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Choose a win before sharing.")
		return
	}
	if message == "" && len(req.MediaIDs) == 0 {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Add a short caption or a photo before sharing.")
		return
	}
	if looksFinanciallySensitive(title) || looksFinanciallySensitive(message) {
		respond.Error(w, http.StatusBadRequest, "privacy_guard", "Keep balances, transactions, income, debt, and exact amounts out of Buds posts.")
		return
	}

	tx, err := h.db.BeginTx(r.Context(), pgx.TxOptions{})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_post_failed", "Could not share this win.")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	var postID string
	err = tx.QueryRow(
		r.Context(),
		`insert into buds_posts (
          user_id, type, title, message, visibility, comments_enabled,
          is_verified, achievement_kind, achievement_ref_id, achievement_label
        ) values ($1, $2, $3, $4, $5, $6, $7, nullif($8, ''), nullif($9, ''), nullif($10, ''))
        returning id::text`,
		userID,
		postType,
		title,
		message,
		visibility,
		commentsEnabled,
		verified,
		achievementKind,
		achievementRefID,
		achievementLabel,
	).Scan(&postID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_post_failed", "Could not share this win.")
		return
	}

	for position, mediaID := range req.MediaIDs {
		result, err := tx.Exec(
			r.Context(),
			`update buds_post_media
                set post_id = $1, position = $2
              where id = $3 and owner_id = $4 and post_id is null`,
			postID,
			position,
			mediaID,
			userID,
		)
		if err != nil || result.RowsAffected() != 1 {
			respond.Error(w, http.StatusBadRequest, "media_not_available", "One of those photos is no longer available. Choose it again.")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_post_failed", "Could not share this win.")
		return
	}

	post, err := h.postByID(r.Context(), userID, postID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "buds_post_failed", "Your win was shared, but the feed could not refresh yet.")
		return
	}
	respond.JSON(w, http.StatusCreated, post)
}

func (h *Handler) postByID(ctx context.Context, userID, postID string) (FeedPost, error) {
	return h.scanRichFeedPost(
		h.db.QueryRow(
			ctx,
			richPostSelect+` where p.id = $2 and p.user_id = $1 and p.deleted_at is null`,
			userID,
			postID,
		),
	)
}

func (h *Handler) verifyAchievement(ctx context.Context, userID, kind, refID string) (string, string, string, bool, error) {
	switch kind {
	case "quest":
		var title string
		err := h.db.QueryRow(
			ctx,
			`select title from user_weekly_quests
              where id = $1 and user_id = $2 and status = 'completed' and completed_at is not null`,
			refID,
			userID,
		).Scan(&title)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", "", false, errors.New("Finish that quest first, then Bud can add the verified badge")
		}
		if err != nil {
			return "", "", "", false, errors.New("Bud could not verify that quest right now")
		}
		return "quest_complete", cleanPublicText(title+" complete", 100), "Verified quest", true, nil
	case "goal":
		parts := strings.Split(refID, ":")
		if len(parts) != 2 {
			return "", "", "", false, errors.New("Choose a completed goal milestone before sharing")
		}
		milestone, err := strconv.Atoi(parts[1])
		if err != nil || (milestone != 25 && milestone != 50 && milestone != 75 && milestone != 100) {
			return "", "", "", false, errors.New("Choose a 25%, 50%, 75%, or 100% goal milestone")
		}
		var reached bool
		err = h.db.QueryRow(
			ctx,
			`select already_saved_cents * 100 >= target_amount_cents * $3
               from goals where id = $1 and user_id = $2 and target_amount_cents > 0`,
			parts[0],
			userID,
			milestone,
		).Scan(&reached)
		if err != nil || !reached {
			return "", "", "", false, errors.New("That goal milestone has not been reached yet")
		}
		return "goal_milestone", fmt.Sprintf("Goal milestone — %d%%", milestone), "Verified goal", true, nil
	case "score":
		var score int
		if err := h.db.QueryRow(ctx, `select financial_health_score from users where id = $1`, userID).Scan(&score); err != nil {
			return "", "", "", false, errors.New("Bud could not verify your Financial Score right now")
		}
		return "score_milestone", fmt.Sprintf("Financial Score reached %d", score), "Verified score", true, nil
	case "league":
		var score int
		if err := h.db.QueryRow(ctx, `select financial_health_score from users where id = $1`, userID).Scan(&score); err != nil {
			return "", "", "", false, errors.New("Bud could not verify your league right now")
		}
		return "league_progress", "Reached " + financialScoreLeagueTier(score) + " League", "Verified league", true, nil
	default:
		return "", "", "", false, errors.New("Choose a quest, goal, score, or league win that Bud can verify")
	}
}

type rawFeedMedia struct {
	ID       string `json:"id"`
	MimeType string `json:"mimeType"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Position int    `json:"position"`
}

func (h *Handler) scanRichFeedPost(row feedRow) (FeedPost, error) {
	var post FeedPost
	var createdAt time.Time
	var firstName, lastName, achievementKind, achievementLabel string
	var isVerified bool
	var mediaJSON []byte
	err := row.Scan(
		&post.ID,
		&post.Type,
		&post.Title,
		&post.Message,
		&createdAt,
		&post.User.ID,
		&firstName,
		&lastName,
		&post.User.Avatar,
		&post.User.Level,
		&post.User.Streak,
		&post.User.FinancialHealthScore,
		&post.User.IsFollowing,
		&post.User.FollowerCount,
		&post.User.FollowingCount,
		&post.FistBumps,
		&post.HasFistBumped,
		&post.Visibility,
		&post.CommentsEnabled,
		&post.CommentCount,
		&achievementKind,
		&achievementLabel,
		&isVerified,
		&mediaJSON,
	)
	if err != nil {
		return FeedPost{}, err
	}
	post.User.DisplayName, post.User.Initials = displayName(firstName, lastName)
	post.User.LeagueTier = financialScoreLeagueTier(post.User.FinancialHealthScore)
	post.User.BadgeCount = badgeCount(post.User.Level, post.User.Streak)
	post.Timestamp = createdAt.UTC().Format(time.RFC3339Nano)
	if achievementKind != "" {
		post.Achievement = &PublicAchievement{
			Kind:     achievementKind,
			Label:    achievementLabel,
			Verified: isVerified,
		}
	}

	var rawMedia []rawFeedMedia
	if err := json.Unmarshal(mediaJSON, &rawMedia); err != nil {
		return FeedPost{}, err
	}
	post.Media = make([]FeedMedia, 0, len(rawMedia))
	for _, media := range rawMedia {
		post.Media = append(post.Media, FeedMedia{
			ID:       media.ID,
			URL:      h.basePath + "/buds/media/" + media.ID,
			MimeType: media.MimeType,
			Width:    media.Width,
			Height:   media.Height,
			Position: media.Position,
		})
	}
	return post, nil
}

func (h *Handler) uploadMedia(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	h.cleanupUnattachedMedia(r.Context())
	r.Body = http.MaxBytesReader(w, r.Body, maxMediaBytes+(1<<20))
	file, _, err := r.FormFile("image")
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "media_missing", "Choose a JPEG or PNG photo to upload.")
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxMediaBytes+1))
	if err != nil || len(data) == 0 || len(data) > maxMediaBytes {
		respond.Error(w, http.StatusBadRequest, "media_too_large", "Keep each photo under 8 MB.")
		return
	}
	mimeType := http.DetectContentType(data)
	extension := ""
	switch mimeType {
	case "image/jpeg":
		extension = ".jpg"
	case "image/png":
		extension = ".png"
	default:
		respond.Error(w, http.StatusBadRequest, "media_type_not_supported", "Buds currently supports JPEG and PNG photos.")
		return
	}
	dimensions, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || dimensions.Width <= 0 || dimensions.Height <= 0 || dimensions.Width > 12000 || dimensions.Height > 12000 {
		respond.Error(w, http.StatusBadRequest, "media_invalid", "That photo could not be read. Try a different one.")
		return
	}

	storageKey, err := mediaStorageKey(userID, data, extension)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "media_upload_failed", "Could not prepare that photo.")
		return
	}
	path := filepath.Join(h.mediaDir, storageKey)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		respond.Error(w, http.StatusInternalServerError, "media_upload_failed", "Photo storage is unavailable right now.")
		return
	}
	tempPath := path + ".uploading"
	if err := os.WriteFile(tempPath, data, 0o600); err != nil {
		respond.Error(w, http.StatusInternalServerError, "media_upload_failed", "Photo storage is unavailable right now.")
		return
	}
	if err := os.Rename(tempPath, path); err != nil {
		_ = os.Remove(tempPath)
		respond.Error(w, http.StatusInternalServerError, "media_upload_failed", "Could not finish that upload.")
		return
	}

	var media FeedMedia
	err = h.db.QueryRow(
		r.Context(),
		`insert into buds_post_media (owner_id, storage_key, mime_type, byte_size, width, height)
         values ($1, $2, $3, $4, $5, $6)
         returning id::text, mime_type, width, height, position`,
		userID,
		storageKey,
		mimeType,
		len(data),
		dimensions.Width,
		dimensions.Height,
	).Scan(&media.ID, &media.MimeType, &media.Width, &media.Height, &media.Position)
	if err != nil {
		_ = os.Remove(path)
		respond.Error(w, http.StatusInternalServerError, "media_upload_failed", "Could not save that photo.")
		return
	}
	media.URL = h.basePath + "/buds/media/" + media.ID
	respond.JSON(w, http.StatusCreated, media)
}

func (h *Handler) cleanupUnattachedMedia(ctx context.Context) {
	rows, err := h.db.Query(
		ctx,
		`delete from buds_post_media
          where post_id is null and created_at < now() - interval '24 hours'
          returning storage_key`,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var storageKey string
		if rows.Scan(&storageKey) == nil {
			_ = os.Remove(filepath.Join(h.mediaDir, filepath.Clean(storageKey)))
		}
	}
}

func (h *Handler) serveMedia(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	mediaID := r.PathValue("id")
	var storageKey, mimeType string
	var createdAt time.Time
	err := h.db.QueryRow(
		r.Context(),
		`select m.storage_key, m.mime_type, m.created_at
           from buds_post_media m
           left join buds_posts p on p.id = m.post_id and p.deleted_at is null
          where m.id = $2
            and (
              m.owner_id = $1
              or (
                p.id is not null
                and p.visibility = 'buds'
                and not exists (
                  select 1 from bud_blocks b
                   where (b.blocker_id = $1 and b.blocked_id = p.user_id)
                      or (b.blocker_id = p.user_id and b.blocked_id = $1)
                )
                and exists (
                  select 1 from bud_follows f where f.follower_id = $1 and f.following_id = p.user_id
                )
              )
            )`,
		userID,
		mediaID,
	).Scan(&storageKey, &mimeType, &createdAt)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "media_not_found", "Photo not found.")
		return
	}
	path := filepath.Join(h.mediaDir, filepath.Clean(storageKey))
	file, err := os.Open(path)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "media_not_found", "Photo not found.")
		return
	}
	defer file.Close()

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	w.Header().Set("ETag", `"`+strings.TrimSuffix(filepath.Base(storageKey), filepath.Ext(storageKey))+`"`)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, filepath.Base(storageKey), createdAt, file)
}

type commentRequest struct {
	Body string `json:"body"`
}

type CommentProfile struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Initials    string `json:"initials"`
	Avatar      string `json:"avatar,omitempty"`
}

type PostComment struct {
	ID        string         `json:"id"`
	Body      string         `json:"body"`
	Timestamp string         `json:"timestamp"`
	User      CommentProfile `json:"user"`
}

type ShareableAchievement struct {
	Kind       string `json:"kind"`
	RefID      string `json:"refId"`
	Title      string `json:"title"`
	Label      string `json:"label"`
	VerifiedAt string `json:"verifiedAt"`
}

func (h *Handler) shareableAchievements(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	rows, err := h.db.Query(
		r.Context(),
		`with goal_milestones as (
           select g.id::text || ':' ||
                  case
                    when g.already_saved_cents >= g.target_amount_cents then '100'
                    when g.already_saved_cents * 4 >= g.target_amount_cents * 3 then '75'
                    when g.already_saved_cents * 2 >= g.target_amount_cents then '50'
                    when g.already_saved_cents * 4 >= g.target_amount_cents then '25'
                  end as ref_id,
                  case
                    when g.already_saved_cents >= g.target_amount_cents then 100
                    when g.already_saved_cents * 4 >= g.target_amount_cents * 3 then 75
                    when g.already_saved_cents * 2 >= g.target_amount_cents then 50
                    when g.already_saved_cents * 4 >= g.target_amount_cents then 25
                  end as milestone,
                  g.updated_at as verified_at
             from goals g
            where g.user_id = $1 and g.target_amount_cents > 0
              and g.already_saved_cents * 4 >= g.target_amount_cents
         ), achievements as (
           select 'quest'::text as kind, q.id::text as ref_id,
                  left(q.title || ' complete', 100) as title,
                  'Verified quest'::text as label,
                  q.completed_at as verified_at
             from user_weekly_quests q
            where q.user_id = $1 and q.status = 'completed' and q.completed_at is not null
           union all
           select 'goal', gm.ref_id,
                  'Goal milestone — ' || gm.milestone::text || '%',
                  'Verified goal', gm.verified_at
             from goal_milestones gm
           union all
           select 'score', '', 'Financial Score reached ' || u.financial_health_score::text,
                  'Verified score', u.updated_at
             from users u where u.id = $1
           union all
           select 'league', '', 'Reached ' ||
                  case
                    when u.financial_health_score >= 770 then 'Champion'
                    when u.financial_health_score >= 690 then 'Diamond'
                    when u.financial_health_score >= 610 then 'Platinum'
                    when u.financial_health_score >= 530 then 'Gold'
                    when u.financial_health_score >= 450 then 'Silver'
                    else 'Bronze'
                  end || ' League',
                  'Verified league', u.updated_at
             from users u where u.id = $1
         )
         select kind, ref_id, title, label, verified_at
           from achievements
          order by verified_at desc nulls last
          limit 24`,
		userID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "shareable_achievements_failed", "Could not load your shareable wins.")
		return
	}
	defer rows.Close()

	items := []ShareableAchievement{}
	for rows.Next() {
		var item ShareableAchievement
		var verifiedAt time.Time
		if err := rows.Scan(&item.Kind, &item.RefID, &item.Title, &item.Label, &verifiedAt); err != nil {
			respond.Error(w, http.StatusInternalServerError, "shareable_achievements_failed", "Could not load your shareable wins.")
			return
		}
		item.VerifiedAt = verifiedAt.UTC().Format(time.RFC3339Nano)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		respond.Error(w, http.StatusInternalServerError, "shareable_achievements_failed", "Could not load your shareable wins.")
		return
	}
	respond.JSON(w, http.StatusOK, items)
}

func (h *Handler) comments(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	postID := r.PathValue("id")
	visible, _, err := h.canViewPost(r.Context(), userID, postID)
	if err != nil || !visible {
		respond.Error(w, http.StatusNotFound, "post_not_found", "Post not found.")
		return
	}
	rows, err := h.db.Query(
		r.Context(),
		`select c.id::text, c.body, c.created_at,
               u.id::text, u.first_name, u.last_name, coalesce(u.avatar_url, '')
           from buds_post_comments c
           join users u on u.id = c.user_id
          where c.post_id = $1 and c.deleted_at is null
          order by c.created_at asc, c.id asc
          limit 100`,
		postID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "comments_failed", "Could not load comments.")
		return
	}
	defer rows.Close()

	comments := []PostComment{}
	for rows.Next() {
		comment, err := scanComment(rows)
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "comments_failed", "Could not load comments.")
			return
		}
		comments = append(comments, comment)
	}
	if err := rows.Err(); err != nil {
		respond.Error(w, http.StatusInternalServerError, "comments_failed", "Could not load comments.")
		return
	}
	respond.JSON(w, http.StatusOK, comments)
}

func (h *Handler) addComment(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	postID := r.PathValue("id")
	var req commentRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	body := cleanPublicText(req.Body, 280)
	if body == "" {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Write a comment first.")
		return
	}
	if looksFinanciallySensitive(body) {
		respond.Error(w, http.StatusBadRequest, "privacy_guard", "Keep balances, transactions, income, debt, and exact amounts out of comments.")
		return
	}
	visible, commentsEnabled, err := h.canViewPost(r.Context(), userID, postID)
	if err != nil || !visible {
		respond.Error(w, http.StatusNotFound, "post_not_found", "Post not found.")
		return
	}
	if !commentsEnabled {
		respond.Error(w, http.StatusConflict, "comments_disabled", "Comments are turned off for this post.")
		return
	}
	comment, err := scanComment(
		h.db.QueryRow(
			r.Context(),
			`with inserted as (
               insert into buds_post_comments (post_id, user_id, body)
               values ($1, $2, $3)
               returning id, body, created_at, user_id
             )
             select i.id::text, i.body, i.created_at,
                    u.id::text, u.first_name, u.last_name, coalesce(u.avatar_url, '')
               from inserted i join users u on u.id = i.user_id`,
			postID,
			userID,
			body,
		),
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "comment_failed", "Could not add that comment.")
		return
	}
	respond.JSON(w, http.StatusCreated, comment)
}

func (h *Handler) canViewPost(ctx context.Context, userID, postID string) (bool, bool, error) {
	var visible, commentsEnabled bool
	err := h.db.QueryRow(
		ctx,
		`select (
              p.user_id = $1
              or (p.visibility = 'buds' and exists (
                select 1 from bud_follows f where f.follower_id = $1 and f.following_id = p.user_id
              ))
            ) and not exists (
              select 1 from bud_blocks b
               where (b.blocker_id = $1 and b.blocked_id = p.user_id)
                  or (b.blocker_id = p.user_id and b.blocked_id = $1)
            ), p.comments_enabled
           from buds_posts p where p.id = $2 and p.deleted_at is null`,
		userID,
		postID,
	).Scan(&visible, &commentsEnabled)
	return visible, commentsEnabled, err
}

func scanComment(row feedRow) (PostComment, error) {
	var comment PostComment
	var firstName, lastName string
	var createdAt time.Time
	err := row.Scan(
		&comment.ID,
		&comment.Body,
		&createdAt,
		&comment.User.ID,
		&firstName,
		&lastName,
		&comment.User.Avatar,
	)
	if err != nil {
		return PostComment{}, err
	}
	comment.User.DisplayName, comment.User.Initials = displayName(firstName, lastName)
	comment.Timestamp = createdAt.UTC().Format(time.RFC3339Nano)
	return comment, nil
}

func feedLimit(raw string) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return defaultFeedLimit
	}
	if value > maxFeedLimit {
		return maxFeedLimit
	}
	return value
}

func decodeFeedCursor(raw string) (any, string, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, "", nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return nil, "", err
	}
	parts := strings.SplitN(string(decoded), "|", 2)
	if len(parts) != 2 || !uuidPattern.MatchString(parts[1]) {
		return nil, "", errors.New("invalid cursor")
	}
	timestamp, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return nil, "", err
	}
	return timestamp, parts[1], nil
}

func encodeFeedCursor(timestamp, id string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(timestamp + "|" + id))
}

func normalizeVisibility(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "private") {
		return "private"
	}
	return "buds"
}

func hasDuplicateStrings(values []string) bool {
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			return true
		}
		if _, exists := seen[value]; exists {
			return true
		}
		seen[value] = struct{}{}
	}
	return false
}

func mediaStorageKey(userID string, data []byte, extension string) (string, error) {
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	hash := sha256.New()
	_, _ = hash.Write([]byte(userID))
	_, _ = hash.Write(nonce)
	_, _ = hash.Write(data)
	digest := hex.EncodeToString(hash.Sum(nil))
	return filepath.Join(digest[:2], digest+extension), nil
}
