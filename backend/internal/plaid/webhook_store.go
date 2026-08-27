package plaid

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type webhookEvent struct {
	PlaidItemID      string
	WebhookType      string
	WebhookCode      string
	Payload          json.RawMessage
	VerificationHash string
	PlaidIssuedAt    time.Time
}

type webhookEventRecorder interface {
	RecordWebhook(context.Context, webhookEvent) (bool, error)
}

type postgresWebhookEventRecorder struct {
	db *pgxpool.Pool
}

func (r postgresWebhookEventRecorder) RecordWebhook(ctx context.Context, event webhookEvent) (bool, error) {
	result, err := r.db.Exec(
		ctx,
		`insert into plaid_webhook_events (
		   plaid_item_id, webhook_type, webhook_code, payload,
		   verification_hash, plaid_issued_at
		 ) values ($1, $2, $3, $4::jsonb, $5, $6)
		 on conflict (verification_hash) do nothing`,
		event.PlaidItemID,
		event.WebhookType,
		event.WebhookCode,
		string(event.Payload),
		event.VerificationHash,
		event.PlaidIssuedAt,
	)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() == 1, nil
}
