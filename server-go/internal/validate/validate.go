package validate

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"blog/server-go/internal/errs"
)

var (
	usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	emailRe    = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	letterRe   = regexp.MustCompile(`[a-zA-Z]`)
	digitRe    = regexp.MustCompile(`[0-9]`)
)

type Register struct {
	Username string
	Email    string
	Password string
	Nickname string
}

type Login struct {
	Identifier string
	Password   string
}

type Profile struct {
	Nickname *string
	BioSet   bool
	Bio      *string
	Email    *string
}

type Passwords struct {
	Current string
	New     string
}

type PostWrite struct {
	Title      *string
	Summary    *string
	SummarySet bool
	Content    *string
	Status     *string
	Tags       []string
	TagsSet    bool
}

type PostQuery struct {
	Page     int
	PageSize int
	Q        string
	Tag      string
	Author   string
	Status   string
	Sort     string
}

type CommentWrite struct {
	Content  string
	ParentID *int64
}

type CommentQuery struct {
	Cursor *int64
	Limit  int
}

func ReadObject(r *http.Request) (map[string]any, error) {
	r.Body = http.MaxBytesReader(nil, r.Body, 2<<20)
	dec := json.NewDecoder(r.Body)
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, errs.Validation("请求体解析失败", errs.Detail{Path: "_", Message: "请求体必须是合法 JSON"})
	}
	obj, ok := v.(map[string]any)
	if !ok {
		return nil, errs.Validation("", errs.Detail{Path: "_", Message: "请求体必须是 JSON 对象"})
	}
	return obj, nil
}

func RegisterInput(obj map[string]any) (Register, error) {
	var d []errs.Detail
	username, ok := trimmed(obj, "username")
	if !ok {
		d = append(d, errs.Detail{Path: "username", Message: "用户名至少 3 个字符"})
	} else if msg := checkUsername(username); msg != "" {
		d = append(d, errs.Detail{Path: "username", Message: msg})
	}
	email, ok := trimmed(obj, "email")
	if !ok || !emailRe.MatchString(email) || utf8.RuneCountInString(email) > 128 {
		d = append(d, errs.Detail{Path: "email", Message: "邮箱格式不正确"})
	}
	password, ok := rawString(obj, "password")
	if !ok || strings.TrimSpace(password) == "" {
		d = append(d, errs.Detail{Path: "password", Message: "请输入密码"})
	} else if msg := checkEnvelope(password); msg != "" {
		d = append(d, errs.Detail{Path: "password", Message: msg})
	}
	nickname, ok := trimmed(obj, "nickname")
	if !ok || nickname == "" {
		d = append(d, errs.Detail{Path: "nickname", Message: "昵称不能为空"})
	} else if utf8.RuneCountInString(nickname) > 32 {
		d = append(d, errs.Detail{Path: "nickname", Message: "昵称最多 32 个字符"})
	}
	if len(d) > 0 {
		return Register{}, errs.Validation("", d...)
	}
	return Register{Username: username, Email: email, Password: password, Nickname: nickname}, nil
}

func LoginInput(obj map[string]any) (Login, error) {
	var d []errs.Detail
	id, ok := trimmed(obj, "identifier")
	if !ok || id == "" {
		d = append(d, errs.Detail{Path: "identifier", Message: "请输入用户名或邮箱"})
	} else if utf8.RuneCountInString(id) > 128 {
		d = append(d, errs.Detail{Path: "identifier", Message: "输入过长"})
	}
	password, ok := rawString(obj, "password")
	if !ok || strings.TrimSpace(password) == "" {
		d = append(d, errs.Detail{Path: "password", Message: "请输入密码"})
	} else if msg := checkEnvelope(password); msg != "" {
		d = append(d, errs.Detail{Path: "password", Message: msg})
	}
	if len(d) > 0 {
		return Login{}, errs.Validation("", d...)
	}
	return Login{Identifier: id, Password: password}, nil
}

func ProfileInput(obj map[string]any) (Profile, error) {
	var out Profile
	var d []errs.Detail
	if _, ok := obj["nickname"]; ok {
		s, ok := trimmed(obj, "nickname")
		if !ok || s == "" || utf8.RuneCountInString(s) > 32 {
			d = append(d, errs.Detail{Path: "nickname", Message: "昵称最多 32 个字符"})
		} else {
			out.Nickname = &s
		}
	}
	if raw, ok := obj["bio"]; ok {
		out.BioSet = true
		if raw == nil {
			out.Bio = nil
		} else {
			s, ok := raw.(string)
			if !ok {
				d = append(d, errs.Detail{Path: "bio", Message: "简介最多 200 字"})
			} else {
				s = strings.TrimSpace(s)
				if utf8.RuneCountInString(s) > 200 {
					d = append(d, errs.Detail{Path: "bio", Message: "简介最多 200 字"})
				} else {
					out.Bio = &s
				}
			}
		}
	}
	if _, ok := obj["email"]; ok {
		s, ok := trimmed(obj, "email")
		if !ok || !emailRe.MatchString(s) || utf8.RuneCountInString(s) > 128 {
			d = append(d, errs.Detail{Path: "email", Message: "邮箱格式不正确"})
		} else {
			out.Email = &s
		}
	}
	if len(d) > 0 {
		return Profile{}, errs.Validation("", d...)
	}
	return out, nil
}

func PasswordInput(obj map[string]any) (Passwords, error) {
	var d []errs.Detail
	cur, ok1 := rawString(obj, "currentPassword")
	next, ok2 := rawString(obj, "newPassword")
	if !ok1 || strings.TrimSpace(cur) == "" {
		d = append(d, errs.Detail{Path: "currentPassword", Message: "请输入密码"})
	} else if msg := checkEnvelope(cur); msg != "" {
		d = append(d, errs.Detail{Path: "currentPassword", Message: msg})
	}
	if !ok2 || strings.TrimSpace(next) == "" {
		d = append(d, errs.Detail{Path: "newPassword", Message: "请输入密码"})
	} else if msg := checkEnvelope(next); msg != "" {
		d = append(d, errs.Detail{Path: "newPassword", Message: msg})
	}
	if len(d) > 0 {
		return Passwords{}, errs.Validation("", d...)
	}
	return Passwords{Current: cur, New: next}, nil
}

func CreatePost(obj map[string]any) (PostWrite, error) {
	write, d := postFields(obj, true)
	if len(d) > 0 {
		return PostWrite{}, errs.Validation("", d...)
	}
	if write.Status == nil {
		draft := "DRAFT"
		write.Status = &draft
	}
	if !write.TagsSet {
		write.Tags = []string{}
		write.TagsSet = true
	}
	return write, nil
}

func UpdatePost(obj map[string]any) (PostWrite, error) {
	write, d := postFields(obj, false)
	if len(d) > 0 {
		return PostWrite{}, errs.Validation("", d...)
	}
	if write.Title == nil && !write.SummarySet && write.Content == nil && write.Status == nil && !write.TagsSet {
		return PostWrite{}, errs.Validation("", errs.Detail{Path: "_", Message: "至少需要提供一个待更新字段"})
	}
	return write, nil
}

func PostListQuery(r *http.Request) (PostQuery, error) {
	q := PostQuery{Page: 1, PageSize: 10, Status: "PUBLISHED", Sort: "latest"}
	var d []errs.Detail
	if v, ok := query(r, "page"); ok {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 10000 {
			d = append(d, errs.Detail{Path: "page", Message: "页码不合法"})
		} else {
			q.Page = n
		}
	}
	if v, ok := query(r, "pageSize"); ok {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 50 {
			d = append(d, errs.Detail{Path: "pageSize", Message: "每页数量不合法"})
		} else {
			q.PageSize = n
		}
	}
	if v, ok := query(r, "q"); ok {
		v = strings.TrimSpace(v)
		if utf8.RuneCountInString(v) > 64 {
			d = append(d, errs.Detail{Path: "q", Message: "关键词过长"})
		} else {
			q.Q = v
		}
	}
	if v, ok := query(r, "tag"); ok {
		v = strings.TrimSpace(v)
		if utf8.RuneCountInString(v) > 48 {
			d = append(d, errs.Detail{Path: "tag", Message: "标签过长"})
		} else {
			q.Tag = v
		}
	}
	if v, ok := query(r, "author"); ok {
		v = strings.TrimSpace(v)
		if utf8.RuneCountInString(v) > 32 {
			d = append(d, errs.Detail{Path: "author", Message: "作者过长"})
		} else {
			q.Author = v
		}
	}
	if v, ok := query(r, "status"); ok {
		switch v {
		case "PUBLISHED", "DRAFT", "ALL":
			q.Status = v
		default:
			d = append(d, errs.Detail{Path: "status", Message: "状态不合法"})
		}
	}
	if v, ok := query(r, "sort"); ok {
		switch v {
		case "latest", "oldest", "popular":
			q.Sort = v
		default:
			d = append(d, errs.Detail{Path: "sort", Message: "排序不合法"})
		}
	}
	if len(d) > 0 {
		return PostQuery{}, errs.Validation("", d...)
	}
	return q, nil
}

func CommentInput(obj map[string]any) (CommentWrite, error) {
	content, ok := trimmed(obj, "content")
	if !ok || content == "" {
		return CommentWrite{}, errs.Validation("", errs.Detail{Path: "content", Message: "评论不能为空"})
	}
	if utf8.RuneCountInString(content) > 1000 {
		return CommentWrite{}, errs.Validation("", errs.Detail{Path: "content", Message: "评论最多 1000 字"})
	}
	var parent *int64
	if raw, ok := obj["parentId"]; ok && raw != nil {
		n, ok := positive(raw)
		if !ok {
			return CommentWrite{}, errs.Validation("", errs.Detail{Path: "parentId", Message: "id 必须是正整数"})
		}
		parent = &n
	}
	return CommentWrite{Content: content, ParentID: parent}, nil
}

func CommentListQuery(r *http.Request) (CommentQuery, error) {
	q := CommentQuery{Limit: 20}
	if v, ok := query(r, "cursor"); ok {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n <= 0 {
			return CommentQuery{}, errs.Validation("", errs.Detail{Path: "cursor", Message: "游标不合法"})
		}
		q.Cursor = &n
	}
	if v, ok := query(r, "limit"); ok {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 50 {
			return CommentQuery{}, errs.Validation("", errs.Detail{Path: "limit", Message: "数量不合法"})
		}
		q.Limit = n
	}
	return q, nil
}

func PositiveID(raw string) (int64, error) {
	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || n <= 0 {
		return 0, errs.Validation("", errs.Detail{Path: "id", Message: "id 必须是正整数"})
	}
	return n, nil
}

func PasswordStrength(pw, field string) error {
	var d []errs.Detail
	if utf8.RuneCountInString(pw) < 8 {
		d = append(d, errs.Detail{Path: field, Message: "密码至少 8 位"})
	}
	if utf8.RuneCountInString(pw) > 64 {
		d = append(d, errs.Detail{Path: field, Message: "密码最多 64 位"})
	}
	if !letterRe.MatchString(pw) {
		d = append(d, errs.Detail{Path: field, Message: "密码需包含字母"})
	}
	if !digitRe.MatchString(pw) {
		d = append(d, errs.Detail{Path: field, Message: "密码需包含数字"})
	}
	if len(d) > 0 {
		return errs.Validation("", d...)
	}
	return nil
}

func postFields(obj map[string]any, creating bool) (PostWrite, []errs.Detail) {
	var out PostWrite
	var d []errs.Detail
	if _, ok := obj["title"]; ok || creating {
		s, ok := trimmed(obj, "title")
		if !ok || s == "" {
			d = append(d, errs.Detail{Path: "title", Message: "标题不能为空"})
		} else if utf8.RuneCountInString(s) > 120 {
			d = append(d, errs.Detail{Path: "title", Message: "标题最多 120 字"})
		} else {
			out.Title = &s
		}
	}
	if _, ok := obj["summary"]; ok {
		out.SummarySet = true
		s, ok := obj["summary"].(string)
		if !ok {
			d = append(d, errs.Detail{Path: "summary", Message: "摘要最多 300 字"})
		} else {
			s = strings.TrimSpace(s)
			if utf8.RuneCountInString(s) > 300 {
				d = append(d, errs.Detail{Path: "summary", Message: "摘要最多 300 字"})
			} else {
				out.Summary = &s
			}
		}
	}
	if _, ok := obj["content"]; ok || creating {
		s, ok := rawString(obj, "content")
		if !ok || s == "" {
			d = append(d, errs.Detail{Path: "content", Message: "正文不能为空"})
		} else {
			out.Content = &s
		}
	}
	if raw, ok := obj["status"]; ok {
		s, _ := raw.(string)
		if s != "DRAFT" && s != "PUBLISHED" {
			d = append(d, errs.Detail{Path: "status", Message: "状态不合法"})
		} else {
			out.Status = &s
		}
	}
	if raw, ok := obj["tags"]; ok {
		out.TagsSet = true
		arr, ok := raw.([]any)
		if !ok {
			d = append(d, errs.Detail{Path: "tags", Message: "最多 8 个标签"})
		} else if len(arr) > 8 {
			d = append(d, errs.Detail{Path: "tags", Message: "最多 8 个标签"})
		} else {
			for _, item := range arr {
				name, ok := item.(string)
				name = strings.TrimSpace(name)
				if !ok || name == "" || utf8.RuneCountInString(name) > 32 {
					d = append(d, errs.Detail{Path: "tags", Message: "标签不合法"})
					break
				}
				out.Tags = append(out.Tags, name)
			}
		}
	}
	return out, d
}

func checkUsername(s string) string {
	if utf8.RuneCountInString(s) < 3 {
		return "用户名至少 3 个字符"
	}
	if utf8.RuneCountInString(s) > 32 {
		return "用户名最多 32 个字符"
	}
	if !usernameRe.MatchString(s) {
		return "用户名只能包含字母、数字、下划线和连字符"
	}
	return ""
}

func checkEnvelope(s string) string {
	if utf8.RuneCountInString(s) > 2048 {
		return "密文过长"
	}
	if !strings.HasPrefix(s, "rsa-oaep-sha256:") {
		return "密码必须以加密形式提交"
	}
	return ""
}

func trimmed(obj map[string]any, key string) (string, bool) {
	s, ok := rawString(obj, key)
	if !ok {
		return "", false
	}
	return strings.TrimSpace(s), true
}

func rawString(obj map[string]any, key string) (string, bool) {
	v, ok := obj[key]
	if !ok || v == nil {
		return "", false
	}
	s, ok := v.(string)
	return s, ok
}

func positive(v any) (int64, bool) {
	switch n := v.(type) {
	case json.Number:
		i, err := n.Int64()
		return i, err == nil && i > 0
	case string:
		i, err := strconv.ParseInt(strings.TrimSpace(n), 10, 64)
		return i, err == nil && i > 0
	default:
		return 0, false
	}
}

func query(r *http.Request, key string) (string, bool) {
	vs, ok := r.URL.Query()[key]
	if !ok || len(vs) == 0 {
		return "", false
	}
	v := vs[len(vs)-1]
	if v == "" {
		return "", false
	}
	return v, true
}
