package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"blog/server-go/internal/errs"
)

func newToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func TokenFromRequest(r *http.Request, name string) string {
	header := r.Header.Get("Cookie")
	if header == "" {
		return ""
	}
	for _, part := range strings.Split(header, ";") {
		part = strings.TrimSpace(part)
		key, val, ok := strings.Cut(part, "=")
		if !ok || key != name || val == "" {
			continue
		}
		decoded, err := url.PathUnescape(val)
		if err != nil || decoded == "" {
			return ""
		}
		return decoded
	}
	return ""
}

func (s *Store) CurrentUser(ctx context.Context, token string) (*PublicUser, error) {
	if len(token) != 64 {
		return nil, nil
	}
	id := hashToken(token)
	var user userRow
	var expires, lastUsed time.Time
	var deleted sql.NullTime
	err := s.DB.QueryRowContext(ctx, `
		SELECT u.id, u.username, u.nickname, u.email, u.bio, u.role, u.createdAt, u.deletedAt,
		       sess.expiresAt, sess.lastUsedAt
		FROM Session sess
		JOIN User u ON u.id = sess.userId
		WHERE sess.id = ?`, id).Scan(
		&user.ID, &user.Username, &user.Nickname, &user.Email, &user.Bio, &user.Role, &user.CreatedAt, &deleted,
		&expires, &lastUsed,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	idleBefore := time.Now().Add(-s.Config.SessionIdle)
	if expires.Before(time.Now()) || lastUsed.Before(idleBefore) {
		_, _ = s.DB.ExecContext(ctx, `DELETE FROM Session WHERE id = ?`, id)
		return nil, nil
	}
	if deleted.Valid {
		return nil, nil
	}
	if time.Since(lastUsed) > time.Minute {
		go func() {
			if _, err := s.DB.ExecContext(context.Background(), `UPDATE Session SET lastUsedAt = ? WHERE id = ?`, now(), id); err != nil {
				log.Printf("[auth] 更新 lastUsedAt 失败: %v", err)
			}
		}()
	}
	pub := user.public()
	return &pub, nil
}

func (s *Store) RequireUser(ctx context.Context, token string) (*PublicUser, error) {
	user, err := s.CurrentUser(ctx, token)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errs.Unauthorized("")
	}
	return user, nil
}

func (s *Store) CreateSession(ctx context.Context, userID int64, userAgent, ip string) (token string, expires time.Time, err error) {
	s.cleanupExpired()
	token, err = newToken()
	if err != nil {
		return "", time.Time{}, err
	}
	expires = time.Now().Add(s.Config.SessionTTL)
	ua := clip(userAgent, 255)
	ip = clip(ip, 64)
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO Session (id, userId, userAgent, ip, expiresAt, lastUsedAt, createdAt)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		hashToken(token), userID, nullIfEmpty(ua), nullIfEmpty(ip), expires, now(), now(),
	)
	return token, expires, err
}

func (s *Store) DestroySession(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	_, err := s.DB.ExecContext(ctx, `DELETE FROM Session WHERE id = ?`, hashToken(token))
	return err
}

func (s *Store) DestroyAllSessions(ctx context.Context, userID int64) (int64, error) {
	res, err := s.DB.ExecContext(ctx, `DELETE FROM Session WHERE userId = ?`, userID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (s *Store) DestroyOtherSessions(ctx context.Context, token string, userID int64) (int64, error) {
	var res sql.Result
	var err error
	if token == "" {
		res, err = s.DB.ExecContext(ctx, `DELETE FROM Session WHERE userId = ?`, userID)
	} else {
		res, err = s.DB.ExecContext(ctx, `DELETE FROM Session WHERE userId = ? AND id <> ?`, userID, hashToken(token))
	}
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (s *Store) ListSessions(ctx context.Context, userID int64, token string) ([]SessionInfo, error) {
	current := ""
	if token != "" {
		current = hashToken(token)
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, userAgent, ip, createdAt, lastUsedAt, expiresAt
		FROM Session
		WHERE userId = ? AND expiresAt > ?
		ORDER BY lastUsedAt DESC`, userID, now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SessionInfo{}
	for rows.Next() {
		var id string
		var ua, ip sql.NullString
		var created, used, expires time.Time
		if err := rows.Scan(&id, &ua, &ip, &created, &used, &expires); err != nil {
			return nil, err
		}
		out = append(out, SessionInfo{
			ID:                id,
			Current:           id == current,
			RecordedUserAgent: strPtr(ua),
			RecordedIP:        strPtr(ip),
			CreatedAt:         iso(created),
			LastUsedAt:        iso(used),
			ExpiresAt:         iso(expires),
		})
	}
	return out, rows.Err()
}

var (
	cleanupMu   sync.Mutex
	lastCleanup time.Time
)

func (s *Store) cleanupExpired() {
	cleanupMu.Lock()
	if time.Since(lastCleanup) < 10*time.Minute {
		cleanupMu.Unlock()
		return
	}
	lastCleanup = time.Now()
	cleanupMu.Unlock()

	go func() {
		idle := time.Now().Add(-s.Config.SessionIdle)
		res, err := s.DB.ExecContext(context.Background(),
			`DELETE FROM Session WHERE expiresAt < ? OR lastUsedAt < ?`, now(), idle)
		if err != nil {
			log.Printf("[auth] 清理过期会话失败: %v", err)
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			log.Printf("[auth] 清理过期会话 %d 条", n)
		}
	}()
}

func clip(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
