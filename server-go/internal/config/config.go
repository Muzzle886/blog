package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr         string
	DSN          string
	CookieName   string
	CookieSecure bool
	Production   bool
	SessionTTL   time.Duration
	SessionIdle  time.Duration
}

func Load() (Config, error) {
	rawURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if rawURL == "" {
		return Config{}, fmt.Errorf("必须设置 DATABASE_URL")
	}
	dsn, err := mysqlDSN(rawURL)
	if err != nil {
		return Config{}, err
	}

	port := getenv("API_PORT", "3001")
	ttlDays := getenvInt("SESSION_TTL_DAYS", 14)
	idleDays := getenvInt("SESSION_IDLE_DAYS", 7)
	production := os.Getenv("NODE_ENV") == "production" || os.Getenv("APP_ENV") == "production"

	return Config{
		Addr:         ":" + port,
		DSN:          dsn,
		CookieName:   getenv("SESSION_COOKIE_NAME", "blog_session"),
		CookieSecure: os.Getenv("COOKIE_SECURE") == "true",
		Production:   production,
		SessionTTL:   time.Duration(ttlDays) * 24 * time.Hour,
		SessionIdle:  time.Duration(idleDays) * 24 * time.Hour,
	}, nil
}

func mysqlDSN(raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("DATABASE_URL 无法解析: %w", err)
	}
	if u.Scheme != "mysql" {
		return "", fmt.Errorf("DATABASE_URL 必须是 mysql://")
	}
	user := ""
	pass := ""
	if u.User != nil {
		user = u.User.Username()
		pass, _ = u.User.Password()
	}
	host := u.Host
	if !strings.Contains(host, ":") {
		host += ":3306"
	}
	dbName := strings.TrimPrefix(u.Path, "/")
	if user == "" || dbName == "" {
		return "", fmt.Errorf("DATABASE_URL 缺少用户名或数据库名")
	}
	q := url.Values{}
	q.Set("parseTime", "true")
	q.Set("loc", "UTC")
	q.Set("charset", "utf8mb4")
	q.Set("collation", "utf8mb4_unicode_ci")
	return fmt.Sprintf("%s:%s@tcp(%s)/%s?%s", user, pass, host, dbName, q.Encode()), nil
}

func getenv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
