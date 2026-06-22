package buds

import "testing"

func TestLooksFinanciallySensitive(t *testing.T) {
	cases := []struct {
		name      string
		value     string
		sensitive bool
	}{
		{
			name:      "allows gamification win",
			value:     "I finished my first quest and kept the streak alive",
			sensitive: false,
		},
		{
			name:      "blocks dollar amounts",
			value:     "I saved $200 this week",
			sensitive: true,
		},
		{
			name:      "blocks balance language",
			value:     "My account balance is finally better",
			sensitive: true,
		},
		{
			name:      "blocks spending language",
			value:     "I reduced my spending category",
			sensitive: true,
		},
		{
			name:      "blocks written currency amount",
			value:     "I saved 200 dollars this week",
			sensitive: true,
		},
		{
			name:      "allows score milestone",
			value:     "My Financial Score reached 620",
			sensitive: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := looksFinanciallySensitive(tc.value); got != tc.sensitive {
				t.Fatalf("looksFinanciallySensitive(%q) = %v, want %v", tc.value, got, tc.sensitive)
			}
		})
	}
}

func TestFeedCursorRoundTrip(t *testing.T) {
	timestamp := "2026-06-20T12:34:56.123456789Z"
	id := "0b4324a4-25f4-4d58-a251-ff4cb7926ca8"
	cursor := encodeFeedCursor(timestamp, id)
	decodedTime, decodedID, err := decodeFeedCursor(cursor)
	if err != nil {
		t.Fatalf("decodeFeedCursor returned error: %v", err)
	}
	if decodedID != id {
		t.Fatalf("decoded id = %q, want %q", decodedID, id)
	}
	if decodedTime == nil || decodedTime.(interface{ Format(string) string }).Format("2006-01-02T15:04:05.999999999Z07:00") != timestamp {
		t.Fatalf("decoded time did not round trip: %#v", decodedTime)
	}
}

func TestVisibilityDefaultsToBuds(t *testing.T) {
	if got := normalizeVisibility("private"); got != "private" {
		t.Fatalf("normalizeVisibility(private) = %q", got)
	}
	if got := normalizeVisibility("public"); got != "buds" {
		t.Fatalf("normalizeVisibility(public) = %q", got)
	}
}

func TestDuplicateMediaIDs(t *testing.T) {
	if !hasDuplicateStrings([]string{"one", "one"}) {
		t.Fatal("expected duplicate media ids to be rejected")
	}
	if hasDuplicateStrings([]string{"one", "two"}) {
		t.Fatal("expected unique media ids to be accepted")
	}
}

func TestDisplayNameUsesPublicInitialFormat(t *testing.T) {
	displayName, initials := displayName("Alex", "Rivera")

	if displayName != "Alex R." {
		t.Fatalf("displayName = %q, want %q", displayName, "Alex R.")
	}
	if initials != "AR" {
		t.Fatalf("initials = %q, want %q", initials, "AR")
	}
}
