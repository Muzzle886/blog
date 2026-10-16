package httpx

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"blog/server-go/internal/errs"
)

func WriteData(w http.ResponseWriter, status int, data any, meta map[string]any) {
	body := map[string]any{"data": data}
	if meta != nil {
		body["meta"] = meta
	}
	write(w, status, body)
}

func WriteError(w http.ResponseWriter, err error) {
	var app *errs.Error
	if errors.As(err, &app) {
		payload := map[string]any{
			"code":    app.Code,
			"message": app.Message,
		}
		if len(app.Details) > 0 {
			payload["details"] = app.Details
		}
		write(w, app.Status, map[string]any{"error": payload})
		return
	}
	log.Printf("[api] unhandled error: %v", err)
	write(w, http.StatusInternalServerError, map[string]any{
		"error": map[string]any{
			"code":    "INTERNAL_ERROR",
			"message": "服务器内部错误",
		},
	})
}

func write(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if w.Header().Get("Cache-Control") == "" {
		w.Header().Set("Cache-Control", "no-store, must-revalidate")
	}
	if w.Header().Get("Vary") == "" {
		w.Header().Set("Vary", "Cookie")
	}
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(body)
}

func ClientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		for i := 0; i < len(forwarded); i++ {
			if forwarded[i] == ',' {
				return trim(forwarded[:i])
			}
		}
		return trim(forwarded)
	}
	if real := trim(r.Header.Get("X-Real-IP")); real != "" {
		return real
	}
	return "unknown"
}

func trim(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}
