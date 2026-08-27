package respond

import (
	"encoding/json"
	"net/http"

	"budget-buddy/backend/internal/requestjson"
)

type errorBody struct {
	Error errorDetails `json:"error"`
}

type errorDetails struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func JSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
	}
}

func Error(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, errorBody{
		Error: errorDetails{
			Code:    code,
			Message: message,
		},
	})
}

func JSONBodyError(w http.ResponseWriter, err error) {
	if requestjson.IsTooLarge(err) {
		Error(w, http.StatusRequestEntityTooLarge, "request_too_large", "Request body is too large.")
		return
	}
	Error(w, http.StatusBadRequest, "invalid_json", "Request body must contain one valid JSON object with supported fields.")
}
