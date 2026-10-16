package markdown

import "testing"

func TestRenderStripsScript(t *testing.T) {
	html := Render("# 标题\n\n<script>alert(1)</script>\n\n[ok](javascript:alert(1))")
	if html == "" {
		t.Fatal("empty html")
	}
	if contains(html, "<script") || contains(html, "javascript:") {
		t.Fatalf("unsafe html: %s", html)
	}
}

func TestSummary(t *testing.T) {
	got := Summary("# 你好\n\n**世界**", 10)
	if got == "" || contains(got, "#") || contains(got, "*") {
		t.Fatalf("summary = %q", got)
	}
}

func contains(s, part string) bool {
	return len(s) >= len(part) && (s == part || len(part) == 0 || index(s, part) >= 0)
}

func index(s, part string) int {
	for i := 0; i+len(part) <= len(s); i++ {
		if s[i:i+len(part)] == part {
			return i
		}
	}
	return -1
}
