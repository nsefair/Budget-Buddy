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
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := looksFinanciallySensitive(tc.value); got != tc.sensitive {
				t.Fatalf("looksFinanciallySensitive(%q) = %v, want %v", tc.value, got, tc.sensitive)
			}
		})
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
