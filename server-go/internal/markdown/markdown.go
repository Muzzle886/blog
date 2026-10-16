package markdown

import (
	"bytes"
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
	"github.com/yuin/goldmark"
	highlighting "github.com/yuin/goldmark-highlighting/v2"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/renderer/html"
)

var (
	md = goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			highlighting.NewHighlighting(
				highlighting.WithStyle("github"),
			),
		),
		goldmark.WithRendererOptions(html.WithHardWraps()),
	)
	policy     = newPolicy()
	dataURI    = regexp.MustCompile(`(?i)^data:image/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$`)
	dataSrc    = regexp.MustCompile(`(?i)(\ssrc\s*=\s*")(data:[^"]*)"`)
	summaryCut = 160
)

func newPolicy() *bluemonday.Policy {
	p := bluemonday.NewPolicy()
	p.AllowElements(
		"h1", "h2", "h3", "h4", "h5", "h6",
		"p", "br", "hr", "blockquote", "pre", "code",
		"ul", "ol", "li", "dl", "dt", "dd",
		"a", "strong", "em", "del", "s", "sub", "sup", "mark", "kbd", "abbr",
		"table", "thead", "tbody", "tr", "th", "td",
		"img", "figure", "figcaption",
		"span", "div", "input",
	)
	p.AllowAttrs("href", "title", "target", "rel").OnElements("a")
	p.AllowAttrs("src", "alt", "title").OnElements("img")
	p.AllowAttrs("class", "id").Globally()
	p.AllowAttrs("align").OnElements("th", "td", "p")
	p.AllowAttrs("colspan", "rowspan").OnElements("th", "td")
	p.AllowAttrs("type", "checked", "disabled").OnElements("input")
	p.AllowAttrs("start").OnElements("ol")
	p.AllowURLSchemes("http", "https", "mailto", "tel")
	p.AllowRelativeURLs(true)
	p.RequireNoFollowOnLinks(false)
	return p
}

func Render(source string) string {
	var buf bytes.Buffer
	if err := md.Convert([]byte(source), &buf); err != nil {
		return ""
	}
	clean := policy.Sanitize(buf.String())
	return stripUnsafeDataURI(clean)
}

func stripUnsafeDataURI(html string) string {
	return dataSrc.ReplaceAllStringFunc(html, func(match string) string {
		parts := dataSrc.FindStringSubmatch(match)
		if len(parts) < 3 {
			return match
		}
		if dataURI.MatchString(parts[2]) {
			return match
		}
		return ""
	})
}

func Summary(markdown string, length int) string {
	if length <= 0 {
		length = summaryCut
	}
	text := markdown
	text = regexp.MustCompile("```[\\s\\S]*?```").ReplaceAllString(text, " ")
	text = regexp.MustCompile("`[^`]*`").ReplaceAllString(text, " ")
	text = regexp.MustCompile(`!\[[^\]]*\]\([^)]*\)`).ReplaceAllString(text, " ")
	text = regexp.MustCompile(`\[([^\]]*)\]\([^)]*\)`).ReplaceAllString(text, "$1")
	text = regexp.MustCompile(`(?m)^\s{0,3}#{1,6}\s+`).ReplaceAllString(text, "")
	text = regexp.MustCompile(`(?m)^\s{0,3}>\s?`).ReplaceAllString(text, "")
	text = strings.NewReplacer("*", "", "_", "", "~", "").Replace(text)
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	runes := []rune(text)
	if len(runes) > length {
		return string(runes[:length]) + "…"
	}
	return text
}
