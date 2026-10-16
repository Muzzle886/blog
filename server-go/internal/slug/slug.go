package slug

import (
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode"
)

func Tag(name string) string {
	normalized := strings.ToLower(strings.TrimSpace(name))
	normalized = strings.Join(strings.Fields(normalized), "-")
	var b strings.Builder
	for _, r := range normalized {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || (r >= 0x4e00 && r <= 0x9fa5) {
			b.WriteRune(r)
		}
	}
	normalized = collapseHyphen(b.String())
	normalized = strings.Trim(normalized, "-")
	if normalized == "" {
		return "tag-" + hash36(name)
	}
	if hasHan(normalized) {
		return url.PathEscape(normalized) + "-" + hash36(name)
	}
	if len(normalized) > 40 {
		return normalized[:40]
	}
	return normalized
}

func Normalize(tags []string, max int) []string {
	if max <= 0 {
		max = 8
	}
	seen := map[string]struct{}{}
	var out []string
	for _, raw := range tags {
		name := strings.Join(strings.Fields(strings.TrimSpace(raw)), " ")
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, name)
		if len(out) >= max {
			break
		}
	}
	return out
}

func Post() string {
	buf := make([]byte, 3)
	_, _ = rand.Read(buf)
	return strconv.FormatInt(time.Now().UnixMilli(), 36) + hex.EncodeToString(buf)
}

func hash36(input string) string {
	h := int32(5381)
	for _, r := range input {
		h = (h * 33) ^ int32(r)
	}
	s := strconv.FormatUint(uint64(uint32(h)), 36)
	if len(s) > 6 {
		return s[:6]
	}
	return s
}

func collapseHyphen(s string) string {
	var b strings.Builder
	prev := false
	for _, r := range s {
		if r == '-' {
			if prev {
				continue
			}
			prev = true
		} else {
			prev = false
		}
		b.WriteRune(r)
	}
	return b.String()
}

func hasHan(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}
