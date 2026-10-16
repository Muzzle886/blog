package ratelimit

import (
	"fmt"
	"sync"
	"time"

	"blog/server-go/internal/errs"
)

type Rule struct {
	Window time.Duration
	Max    int
}

var (
	Login     = Rule{Window: 15 * time.Minute, Max: 20}
	LoginByIP = Rule{Window: 15 * time.Minute, Max: 60}
	Register  = Rule{Window: time.Hour, Max: 20}
)

type bucket struct {
	count   int
	resetAt time.Time
}

type Limiter struct {
	mu      sync.Mutex
	buckets map[string]bucket
}

func New() *Limiter {
	return &Limiter{buckets: map[string]bucket{}}
}

func (l *Limiter) Enforce(key string, rule Rule) error {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.buckets) > 10_000 {
		for k, b := range l.buckets {
			if !b.resetAt.After(now) {
				delete(l.buckets, k)
			}
		}
	}

	b, ok := l.buckets[key]
	if !ok || !b.resetAt.After(now) {
		l.buckets[key] = bucket{count: 1, resetAt: now.Add(rule.Window)}
		return nil
	}
	b.count++
	l.buckets[key] = b
	if b.count > rule.Max {
		seconds := int(time.Until(b.resetAt).Seconds())
		if seconds < 1 {
			seconds = 1
		}
		return errs.TooMany(fmt.Sprintf("操作过于频繁，请 %d 秒后重试", seconds))
	}
	return nil
}
