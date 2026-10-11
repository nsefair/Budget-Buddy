package plaid

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Synthetic descriptors. Servers write raw bytes because json.Encoder would
// replace invalid UTF-8 before it reached the client under test.
func TestPlaidResponsesKeepAccentedText(t *testing.T) {
	cases := []struct{ name, wire, want string }{
		{"latin-1 byte", "TRANSACCI\xd3N", "TRANSACCIÓN"},
		{"windows-1252 dash", "COMPRA EN L\xcdNEA \x96 CUOTA 1", "COMPRA EN LÍNEA – CUOTA 1"},
		{"mixed with utf-8", "CAF\xc3\x89 PEQUE\xd1O", "CAFÉ PEQUEÑO"},
		{"utf-8", "TRANSACCIÓN", "TRANSACCIÓN"},
		{"json escape", `TRANSACCIÓN`, "TRANSACCIÓN"},
		{"replacement sent by plaid", "TRANSACCI�N", "TRANSACCI�N"},
		{"undefined windows-1252 byte", "A\x81B", "A�B"},
	}
	for _, tc := range cases {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"added":[{"transaction_id":"t1","name":"` + tc.wire + `"}],"next_cursor":"c1"}`))
		}))
		client := &Client{baseURL: server.URL, httpClient: server.Client()}
		got, err := client.SyncTransactions(context.Background(), SyncTransactionsRequest{AccessToken: "token"})
		server.Close()
		name := ""
		if len(got.Added) == 1 {
			name = got.Added[0].Name
		}
		if err != nil || name != tc.want {
			t.Fatalf("%s: name = %q, err = %v; want %q", tc.name, name, err, tc.want)
		}
	}
}

func TestPlaidErrorResponseUsesSameDecoding(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("{\"error_code\":\"INVALID_INPUT\",\"error_message\":\"descripci\xf3n inv\xe1lida\"}"))
	}))
	defer server.Close()
	client := &Client{baseURL: server.URL, httpClient: server.Client()}
	_, err := client.SyncTransactions(context.Background(), SyncTransactionsRequest{AccessToken: "token"})
	var plaidErr apiError
	if !errors.As(err, &plaidErr) || plaidErr.ErrorCode != "INVALID_INPUT" || plaidErr.ErrorMessage != "descripción inválida" {
		t.Fatalf("SyncTransactions() error = %v", err)
	}
}
