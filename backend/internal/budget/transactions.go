package budget

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// One bank ledger feeds the overview, month totals and transaction drill-downs.
// Amounts keep Plaid's sign: positive outflow, negative inflow. No currency mixing.
type bankTransaction struct {
	Transaction
	cents    int64
	income   bool
	spending bool
}

func loadBankTransactions(ctx context.Context, db *pgxpool.Pool, user, month string) ([]bankTransaction, error) {
	rows, err := db.Query(ctx, `select pt.id::text, coalesce(nullif(pt.merchant_name,''),pt.name),
 coalesce(pt.personal_finance_category_primary,''), coalesce(pt.personal_finance_category_detailed,''),
 pt.category, pt.amount_cents, pt.date::text, pt.pending
 from plaid_transactions pt
 join plaid_accounts pa on pa.id=pt.account_id and pa.user_id=pt.user_id
 join plaid_items pi on pi.id=pt.item_id and pi.user_id=pt.user_id
 where pt.user_id=$1 and pa.is_active and pi.archived_at is null
 and pt.iso_currency_code='USD'
 and ($2='' or to_char(pt.date,'YYYY-MM')=$2)
 and not (pt.pending and exists(select 1 from plaid_transactions posted
   where posted.user_id=pt.user_id and posted.pending_transaction_id=pt.plaid_transaction_id and not posted.pending))
 order by pt.date desc, pt.created_at desc, pt.id desc`, user, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []bankTransaction{}
	for rows.Next() {
		var t bankTransaction
		var primary, detailed, day string
		var legacy []string
		if err := rows.Scan(&t.ID, &t.Merchant, &primary, &detailed, &legacy, &t.cents, &day, &t.IsPending); err != nil {
			return nil, err
		}
		t.income = isDetectedIncome(t.cents, primary, detailed, legacy)
		t.CategoryID = categoryForTransaction(primary, detailed, legacy)
		if t.income {
			t.CategoryID = "income"
		}
		// Incoming unknowns/transfers are not paychecks or refunds. A refund must
		// carry a direct spending category, and must have posted before it offsets spend.
		t.spending = !t.income && !isTransferCategory(primary, detailed, legacy) &&
			(t.cents > 0 || (!t.IsPending && t.CategoryID != "uncategorized" && !strings.HasPrefix(primary, "TRANSFER")))
		t.Category = categoryNameByID(t.CategoryID)
		t.Amount = centsToDollars(t.cents)
		t.Date = day + "T12:00:00Z"
		t.CountsTowardSpending = t.spending
		result = append(result, t)
	}
	return result, rows.Err()
}

func bankTotals(transactions []bankTransaction) (map[string]int64, int64) {
	spending := map[string]int64{}
	var income int64
	for _, t := range transactions {
		if t.income && !t.IsPending {
			income -= t.cents
		}
		if t.spending {
			spending[t.CategoryID] += t.cents
		}
	}
	// Refunds cannot create negative category spending or extra income.
	for id, amount := range spending {
		spending[id] = max(0, amount)
	}
	return spending, income
}
