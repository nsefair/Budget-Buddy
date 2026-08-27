package requestjson

import (
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
)

type decodeFixture struct {
	Name string `json:"name"`
}

func TestDecodeAcceptsOneStrictJSONObject(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"Bud"}`))
	var fixture decodeFixture

	if err := Decode(recorder, request, &fixture, 64); err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if fixture.Name != "Bud" {
		t.Fatalf("Name = %q, want Bud", fixture.Name)
	}
}

func TestDecodeRejectsUnsafeBodies(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		maxBytes int64
		tooLarge bool
	}{
		{name: "oversized", body: `{"name":"more than sixteen bytes"}`, maxBytes: 16, tooLarge: true},
		{name: "unknown field", body: `{"name":"Bud","admin":true}`, maxBytes: 128},
		{name: "malformed", body: `{"name":`, maxBytes: 128},
		{name: "trailing JSON", body: `{"name":"Bud"} {"name":"Again"}`, maxBytes: 128},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest("POST", "/", strings.NewReader(test.body))
			var fixture decodeFixture
			err := Decode(recorder, request, &fixture, test.maxBytes)
			if err == nil {
				t.Fatal("Decode returned nil error")
			}
			if got := IsTooLarge(err); got != test.tooLarge {
				t.Fatalf("IsTooLarge(%v) = %v, want %v", err, got, test.tooLarge)
			}
			if test.tooLarge && !errors.Is(err, ErrTooLarge) {
				t.Fatalf("error %v does not wrap ErrTooLarge", err)
			}
		})
	}
}

func TestReadRawPreservesExactBytesAndLimit(t *testing.T) {
	const body = "{\n  \"name\": \"Bud\"\n}"
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("POST", "/", strings.NewReader(body))
	got, err := ReadRaw(recorder, request, int64(len(body)))
	if err != nil {
		t.Fatalf("ReadRaw returned error: %v", err)
	}
	if string(got) != body {
		t.Fatalf("ReadRaw = %q, want exact %q", got, body)
	}

	tooSmall := httptest.NewRequest("POST", "/", strings.NewReader(body))
	if _, err := ReadRaw(recorder, tooSmall, int64(len(body)-1)); !IsTooLarge(err) {
		t.Fatalf("ReadRaw oversized error = %v, want ErrTooLarge", err)
	}
}
