package requestjson

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

const DefaultMaxBytes int64 = 1 << 20

var ErrTooLarge = errors.New("request body is too large")

// Decode reads exactly one JSON value with a hard byte limit and rejects
// unknown object fields. Callers should use IsTooLarge to select HTTP 413.
func Decode(w http.ResponseWriter, r *http.Request, target any, maxBytes int64) error {
	if maxBytes <= 0 {
		maxBytes = DefaultMaxBytes
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	defer r.Body.Close()

	return decodeReader(r.Body, target)
}

// DecodeBytes applies strict JSON object rules to an already size-bounded body.
// This is useful when a webhook signature must be checked before JSON parsing.
func DecodeBytes(body []byte, target any) error {
	return decodeReader(bytes.NewReader(body), target)
}

func decodeReader(reader io.Reader, target any) error {
	decoder := json.NewDecoder(reader)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return normalizeError(err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("request body must contain one JSON value")
		}
		return normalizeError(fmt.Errorf("request body must contain one JSON value: %w", err))
	}
	return nil
}

// ReadRaw returns the exact request bytes so signatures can cover whitespace
// and field ordering. It applies the same hard limit as Decode.
func ReadRaw(w http.ResponseWriter, r *http.Request, maxBytes int64) ([]byte, error) {
	if maxBytes <= 0 {
		maxBytes = DefaultMaxBytes
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	defer r.Body.Close()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, normalizeError(err)
	}
	return body, nil
}

func IsTooLarge(err error) bool {
	return errors.Is(err, ErrTooLarge)
}

func normalizeError(err error) error {
	var maxBytesError *http.MaxBytesError
	if errors.As(err, &maxBytesError) {
		return fmt.Errorf("%w: maximum is %d bytes", ErrTooLarge, maxBytesError.Limit)
	}
	return err
}
