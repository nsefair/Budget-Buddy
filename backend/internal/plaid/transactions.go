package plaid

import (
	"context"
	"strings"
)

type SyncTransactionsRequest struct {
	AccessToken string
	Cursor      string
	Count       int
}

type SyncTransactionsResponse struct {
	Added      []SyncedTransaction `json:"added"`
	Modified   []SyncedTransaction `json:"modified"`
	Removed    []RemovedTransaction `json:"removed"`
	NextCursor string              `json:"next_cursor"`
	HasMore    bool                `json:"has_more"`
	RequestID  string              `json:"request_id"`
}

type SyncedTransaction struct {
	TransactionID              string                    `json:"transaction_id"`
	AccountID                  string                    `json:"account_id"`
	Amount                     float64                   `json:"amount"`
	IsoCurrencyCode            string                    `json:"iso_currency_code"`
	UnofficialCurrencyCode     string                    `json:"unofficial_currency_code"`
	Date                       string                    `json:"date"`
	AuthorizedDate             string                    `json:"authorized_date"`
	Name                       string                    `json:"name"`
	MerchantName               string                    `json:"merchant_name"`
	Category                   []string                  `json:"category"`
	Pending                    bool                      `json:"pending"`
	PersonalFinanceCategory    *PersonalFinanceCategory  `json:"personal_finance_category"`
}

type PersonalFinanceCategory struct {
	Primary string `json:"primary"`
	Detailed string `json:"detailed"`
}

type RemovedTransaction struct {
	TransactionID string `json:"transaction_id"`
}

type AccountsBalanceResponse struct {
	Accounts  []AccountBalance `json:"accounts"`
	RequestID string           `json:"request_id"`
}

type AccountBalance struct {
	AccountID string  `json:"account_id"`
	Balances  Balances `json:"balances"`
}

type Balances struct {
	Current          *float64 `json:"current"`
	Available        *float64 `json:"available"`
	IsoCurrencyCode  string   `json:"iso_currency_code"`
}

func (c *Client) SyncTransactions(ctx context.Context, req SyncTransactionsRequest) (SyncTransactionsResponse, error) {
	payload := map[string]any{
		"client_id":    c.clientID,
		"secret":       c.secret,
		"access_token": strings.TrimSpace(req.AccessToken),
		"cursor":       strings.TrimSpace(req.Cursor),
	}
	if req.Count > 0 {
		payload["count"] = req.Count
	}

	var result SyncTransactionsResponse
	if err := c.post(ctx, "/transactions/sync", payload, &result); err != nil {
		return SyncTransactionsResponse{}, err
	}
	return result, nil
}

func (c *Client) GetAccountsBalance(ctx context.Context, accessToken string) (AccountsBalanceResponse, error) {
	payload := map[string]any{
		"client_id":    c.clientID,
		"secret":       c.secret,
		"access_token": strings.TrimSpace(accessToken),
	}

	var result AccountsBalanceResponse
	if err := c.post(ctx, "/accounts/balance/get", payload, &result); err != nil {
		return AccountsBalanceResponse{}, err
	}
	return result, nil
}
