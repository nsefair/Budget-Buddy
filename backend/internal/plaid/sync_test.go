package plaid

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

type scriptedSync struct {
	calls []string
	step  int
	fail  bool
}

func (s *scriptedSync) SyncTransactions(_ context.Context, r SyncTransactionsRequest) (SyncTransactionsResponse, error) {
	s.calls = append(s.calls, r.Cursor)
	s.step++
	switch s.step {
	case 1:
		return SyncTransactionsResponse{Added: []SyncedTransaction{{TransactionID: "discard"}}, HasMore: true, NextCursor: "page2"}, nil
	case 2:
		if s.fail {
			return SyncTransactionsResponse{}, errors.New("network failed")
		}
		return SyncTransactionsResponse{}, apiError{ErrorCode: "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"}
	case 3:
		return SyncTransactionsResponse{Added: []SyncedTransaction{{TransactionID: "keep"}}, NextCursor: "committed"}, nil
	}
	panic("unexpected call")
}
func TestMutationRestartsOriginalCursor(t *testing.T) {
	s := &scriptedSync{}
	r, e := collectSync(context.Background(), s, "token", "original")
	if e != nil || len(r.Added) != 1 || r.Added[0].TransactionID != "keep" || r.NextCursor != "committed" || !reflect.DeepEqual(s.calls, []string{"original", "page2", "original"}) {
		t.Fatal(r, e, s.calls)
	}
}
func TestPartialSyncNeverLeaks(t *testing.T) {
	s := &scriptedSync{fail: true}
	r, e := collectSync(context.Background(), s, "token", "original")
	if e == nil || len(r.Added) != 0 {
		t.Fatal(r, e)
	}
}
