package plaid

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/config"
)

type claimedWebhookEvent struct {
	ID          string
	PlaidItemID string
	WebhookType string
	WebhookCode string
	Attempts    int
}

func RunWebhookWorker(ctx context.Context, db *pgxpool.Pool, cfg config.Config, logger *slog.Logger) {
	if !cfg.PlaidConfigured() || !cfg.PlaidTokenEncryptionConfigured() {
		logger.Info("plaid webhook worker disabled", "reason", "plaid configuration incomplete")
		return
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		processed, err := processNextWebhook(ctx, db, cfg)
		if err != nil && !errors.Is(err, context.Canceled) {
			logger.Error("plaid webhook processing failed", "error", err)
		}
		if processed {
			continue
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func processNextWebhook(ctx context.Context, db *pgxpool.Pool, cfg config.Config) (bool, error) {
	event, err := claimWebhookEvent(ctx, db)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if strings.ToUpper(event.WebhookType) != "TRANSACTIONS" || event.PlaidItemID == "" {
		return true, markWebhookProcessed(ctx, db, event.ID)
	}

	var userID string
	err = db.QueryRow(
		ctx,
		`select user_id::text
		   from plaid_items
		  where plaid_item_id = $1 and archived_at is null`,
		event.PlaidItemID,
	).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return true, markWebhookProcessed(ctx, db, event.ID)
	}
	if err != nil {
		_ = markWebhookFailed(ctx, db, event, err)
		return true, err
	}

	if _, err := SyncUserItems(ctx, db, cfg, userID); err != nil {
		_ = markWebhookFailed(ctx, db, event, err)
		return true, err
	}
	return true, markWebhookProcessed(ctx, db, event.ID)
}

func claimWebhookEvent(ctx context.Context, db *pgxpool.Pool) (claimedWebhookEvent, error) {
	var event claimedWebhookEvent
	err := db.QueryRow(
		ctx,
		`update plaid_webhook_events
		    set processing_started_at = now(),
		        processing_attempts = processing_attempts + 1,
		        processing_error = null
		  where id = (
		    select id
		      from plaid_webhook_events
		     where processed_at is null
		       and next_attempt_at <= now()
		       and (
		         processing_started_at is null
		         or processing_started_at < now() - interval '5 minutes'
		       )
		     order by created_at
		     for update skip locked
		     limit 1
		  )
		 returning id::text, coalesce(plaid_item_id, ''), webhook_type,
		           webhook_code, processing_attempts`,
	).Scan(&event.ID, &event.PlaidItemID, &event.WebhookType, &event.WebhookCode, &event.Attempts)
	return event, err
}

func markWebhookProcessed(ctx context.Context, db *pgxpool.Pool, eventID string) error {
	_, err := db.Exec(
		ctx,
		`update plaid_webhook_events
		    set processed_at = now(),
		        processing_started_at = null,
		        processing_error = null
		  where id = $1`,
		eventID,
	)
	return err
}

func markWebhookFailed(ctx context.Context, db *pgxpool.Pool, event claimedWebhookEvent, processingErr error) error {
	backoff := time.Duration(1<<min(event.Attempts, 6)) * time.Minute
	_, err := db.Exec(
		ctx,
		`update plaid_webhook_events
		    set processing_started_at = null,
		        processing_error = $2,
		        next_attempt_at = now() + make_interval(secs => $3)
		  where id = $1`,
		event.ID,
		processingErr.Error(),
		int(backoff.Seconds()),
	)
	return err
}
