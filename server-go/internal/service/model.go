package service

import (
	"context"
	"database/sql"
	"time"

	"blog/server-go/internal/config"
	"blog/server-go/internal/password"
	"blog/server-go/internal/ratelimit"
)

type Store struct {
	DB     *sql.DB
	Config config.Config
	Keys   *password.KeyStore
	Limit  *ratelimit.Limiter
}

type Q interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type PublicUser struct {
	ID        int64   `json:"id"`
	Username  string  `json:"username"`
	Nickname  string  `json:"nickname"`
	Email     string  `json:"email"`
	Bio       *string `json:"bio"`
	Role      string  `json:"role"`
	CreatedAt string  `json:"createdAt"`
}

type PublicProfile struct {
	ID        int64   `json:"id"`
	Username  string  `json:"username"`
	Nickname  string  `json:"nickname"`
	Bio       *string `json:"bio"`
	CreatedAt string  `json:"createdAt"`
}

type Author struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Nickname string `json:"nickname"`
}

type TagSummary struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	PostCount *int   `json:"postCount,omitempty"`
}

type PostSummary struct {
	ID           int64        `json:"id"`
	Slug         string       `json:"slug"`
	Title        string       `json:"title"`
	Summary      string       `json:"summary"`
	Status       string       `json:"status"`
	Views        int          `json:"views"`
	PublishedAt  *string      `json:"publishedAt"`
	CreatedAt    string       `json:"createdAt"`
	UpdatedAt    string       `json:"updatedAt"`
	Author       Author       `json:"author"`
	Tags         []TagSummary `json:"tags"`
	CommentCount *int         `json:"commentCount,omitempty"`
}

type PostDetail struct {
	PostSummary
	Content string `json:"content"`
	HTML    string `json:"html"`
}

type CommentItem struct {
	ID        int64         `json:"id"`
	Content   string        `json:"content"`
	ParentID  *int64        `json:"parentId"`
	CreatedAt string        `json:"createdAt"`
	Author    Author        `json:"author"`
	Replies   []CommentItem `json:"replies"`
}

type SessionInfo struct {
	ID                string  `json:"id"`
	Current           bool    `json:"current"`
	RecordedUserAgent *string `json:"recordedUserAgent"`
	RecordedIP        *string `json:"recordedIp"`
	CreatedAt         string  `json:"createdAt"`
	LastUsedAt        string  `json:"lastUsedAt"`
	ExpiresAt         string  `json:"expiresAt"`
}

func Open(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func iso(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

func isoPtr(t sql.NullTime) *string {
	if !t.Valid {
		return nil
	}
	s := iso(t.Time)
	return &s
}

func strPtr(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	s := v.String
	return &s
}

func now() time.Time { return time.Now().UTC() }
