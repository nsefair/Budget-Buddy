package plaid

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"budget-buddy/backend/internal/config"
)

type Client struct {
	baseURL    string
	clientID   string
	secret     string
	httpClient *http.Client
}

type LinkTokenRequest struct {
	ClientName         string
	ClientUserID       string
	Products           []string
	OptionalProducts   []string
	CountryCodes       []string
	Language           string
	WebhookURL         string
	RedirectURI        string
	AndroidPackageName string
}

type LinkTokenResponse struct {
	LinkToken  string `json:"link_token"`
	Expiration string `json:"expiration"`
	RequestID  string `json:"request_id"`
}

type ExchangeTokenResponse struct {
	AccessToken string `json:"access_token"`
	ItemID      string `json:"item_id"`
	RequestID   string `json:"request_id"`
}

type apiError struct {
	ErrorType    string `json:"error_type"`
	ErrorCode    string `json:"error_code"`
	ErrorMessage string `json:"error_message"`
	Display      string `json:"display_message"`
	RequestID    string `json:"request_id"`
}

func (e apiError) Error() string {
	if e.ErrorCode == "" && e.ErrorMessage == "" {
		return "plaid api error"
	}
	return fmt.Sprintf("plaid api error %s: %s", e.ErrorCode, e.ErrorMessage)
}

func NewClient(cfg config.Config) (*Client, error) {
	baseURL, err := environmentBaseURL(cfg.PlaidEnvironment)
	if err != nil {
		return nil, err
	}
	return &Client{
		baseURL:  baseURL,
		clientID: cfg.PlaidClientID,
		secret:   cfg.PlaidSecret,
		httpClient: &http.Client{
			Timeout: 12 * time.Second,
		},
	}, nil
}

func (c *Client) CreateLinkToken(ctx context.Context, req LinkTokenRequest) (LinkTokenResponse, error) {
	if strings.TrimSpace(req.ClientUserID) == "" {
		return LinkTokenResponse{}, errors.New("client user id is required")
	}

	payload := map[string]any{
		"client_id":     c.clientID,
		"secret":        c.secret,
		"client_name":   firstNonEmpty(req.ClientName, "Budget Buddy"),
		"country_codes": defaultStrings(req.CountryCodes, []string{"US"}),
		"language":      firstNonEmpty(req.Language, "en"),
		"products":      defaultStrings(req.Products, []string{"transactions"}),
		"user": map[string]string{
			"client_user_id": req.ClientUserID,
		},
	}
	if len(req.OptionalProducts) > 0 {
		payload["optional_products"] = req.OptionalProducts
	}
	if strings.TrimSpace(req.WebhookURL) != "" {
		payload["webhook"] = strings.TrimSpace(req.WebhookURL)
	}
	if strings.TrimSpace(req.RedirectURI) != "" {
		payload["redirect_uri"] = strings.TrimSpace(req.RedirectURI)
	}
	if strings.TrimSpace(req.AndroidPackageName) != "" {
		payload["android_package_name"] = strings.TrimSpace(req.AndroidPackageName)
	}

	var result LinkTokenResponse
	if err := c.post(ctx, "/link/token/create", payload, &result); err != nil {
		return LinkTokenResponse{}, err
	}
	return result, nil
}

func (c *Client) ExchangePublicToken(ctx context.Context, publicToken string) (ExchangeTokenResponse, error) {
	publicToken = strings.TrimSpace(publicToken)
	if publicToken == "" {
		return ExchangeTokenResponse{}, errors.New("public token is required")
	}

	payload := map[string]any{
		"client_id":    c.clientID,
		"secret":       c.secret,
		"public_token": publicToken,
	}

	var result ExchangeTokenResponse
	if err := c.post(ctx, "/item/public_token/exchange", payload, &result); err != nil {
		return ExchangeTokenResponse{}, err
	}
	return result, nil
}

func (c *Client) post(ctx context.Context, path string, payload, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	response, err := c.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		var plaidErr apiError
		if err := json.NewDecoder(response.Body).Decode(&plaidErr); err != nil {
			return fmt.Errorf("plaid api returned status %d", response.StatusCode)
		}
		return plaidErr
	}

	return json.NewDecoder(response.Body).Decode(out)
}

func environmentBaseURL(env string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(env)) {
	case "", "sandbox":
		return "https://sandbox.plaid.com", nil
	case "development":
		return "https://development.plaid.com", nil
	case "production":
		return "https://production.plaid.com", nil
	default:
		return "", fmt.Errorf("unsupported plaid environment %q", env)
	}
}

func defaultStrings(values, fallback []string) []string {
	clean := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			clean = append(clean, trimmed)
		}
	}
	if len(clean) == 0 {
		return fallback
	}
	return clean
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
