package api

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"blog/server-go/internal/errs"
	"blog/server-go/internal/httpx"
	"blog/server-go/internal/password"
	"blog/server-go/internal/ratelimit"
	"blog/server-go/internal/service"
	"blog/server-go/internal/validate"
)

type API struct {
	Store *service.Store
}

func New(store *service.Store) *API {
	return &API{Store: store}
}

func (a *API) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(a.recover)
	r.Use(securityHeaders)
	r.Get("/api/auth/public-key", a.wrap(a.publicKey))
	r.Post("/api/auth/login", a.wrap(a.login))
	r.Post("/api/auth/register", a.wrap(a.register))
	r.Delete("/api/auth/session", a.wrap(a.logout))
	r.Get("/api/users/me", a.wrap(a.me))
	r.Patch("/api/users/me", a.wrap(a.updateMe))
	r.Patch("/api/users/me/password", a.wrap(a.changePassword))
	r.Get("/api/users/me/sessions", a.wrap(a.sessions))
	r.Delete("/api/users/me/sessions", a.wrap(a.revokeSessions))
	r.Get("/api/users/{username}", a.wrap(a.profile))
	r.Get("/api/posts", a.wrap(a.listPosts))
	r.Post("/api/posts", a.wrap(a.createPost))
	r.Get("/api/posts/{slug}/comments", a.wrap(a.listComments))
	r.Post("/api/posts/{slug}/comments", a.wrap(a.createComment))
	r.Get("/api/posts/{slug}", a.wrap(a.getPost))
	r.Patch("/api/posts/{slug}", a.wrap(a.updatePost))
	r.Put("/api/posts/{slug}", a.wrap(a.updatePost))
	r.Delete("/api/posts/{slug}", a.wrap(a.deletePost))
	r.Delete("/api/comments/{id}", a.wrap(a.deleteComment))
	r.Get("/api/tags", a.wrap(a.tags))
	r.Get("/api/stats", a.wrap(a.stats))
	return r
}

func (a *API) wrap(fn func(http.ResponseWriter, *http.Request) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := fn(w, r); err != nil {
			httpx.WriteError(w, err)
		}
	}
}

func (a *API) recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("[api] panic: %v", rec)
				httpx.WriteError(w, errors.New("panic"))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
		w.Header().Set("X-XSS-Protection", "0")
		next.ServeHTTP(w, r)
	})
}

func (a *API) viewer(r *http.Request) (*service.PublicUser, error) {
	token := service.TokenFromRequest(r, a.Store.Config.CookieName)
	return a.Store.CurrentUser(r.Context(), token)
}

func (a *API) require(r *http.Request) (*service.PublicUser, error) {
	token := service.TokenFromRequest(r, a.Store.Config.CookieName)
	return a.Store.RequireUser(r.Context(), token)
}

func (a *API) publicKey(w http.ResponseWriter, _ *http.Request) error {
	payload, err := a.Store.Keys.Public()
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, payload, nil)
	return nil
}

func (a *API) login(w http.ResponseWriter, r *http.Request) error {
	obj, err := validate.ReadObject(r)
	if err != nil {
		return err
	}
	input, err := validate.LoginInput(obj)
	if err != nil {
		return err
	}
	ip := httpx.ClientIP(r)
	if err := a.Store.Limit.Enforce("login:ip:"+ip, ratelimit.LoginByIP); err != nil {
		return err
	}
	if err := a.Store.Limit.Enforce("login:acct:"+strings.ToLower(input.Identifier), ratelimit.Login); err != nil {
		return err
	}
	plain, err := decryptField(a.Store.Keys, input.Password, "password")
	if err != nil {
		return err
	}
	user, err := a.Store.Authenticate(r.Context(), input.Identifier, plain)
	if err != nil {
		return err
	}
	if err := a.issue(w, r, user.ID, ip); err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, map[string]any{"user": user}, nil)
	return nil
}

func (a *API) register(w http.ResponseWriter, r *http.Request) error {
	ip := httpx.ClientIP(r)
	if err := a.Store.Limit.Enforce("register:ip:"+ip, ratelimit.Register); err != nil {
		return err
	}
	obj, err := validate.ReadObject(r)
	if err != nil {
		return err
	}
	input, err := validate.RegisterInput(obj)
	if err != nil {
		return err
	}
	plain, err := decryptField(a.Store.Keys, input.Password, "password")
	if err != nil {
		return err
	}
	if err := validate.PasswordStrength(plain, "password"); err != nil {
		return err
	}
	user, err := a.Store.Register(r.Context(), input.Username, input.Email, input.Nickname, plain)
	if err != nil {
		return err
	}
	if err := a.issue(w, r, user.ID, ip); err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusCreated, map[string]any{"user": user}, nil)
	return nil
}

func (a *API) logout(w http.ResponseWriter, r *http.Request) error {
	token := service.TokenFromRequest(r, a.Store.Config.CookieName)
	if err := a.Store.DestroySession(r.Context(), token); err != nil {
		return err
	}
	if err := a.clearCookie(w); err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, map[string]any{"loggedOut": token != ""}, nil)
	return nil
}

func (a *API) me(w http.ResponseWriter, r *http.Request) error {
	user, err := a.require(r)
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, map[string]any{"user": user}, nil)
	return nil
}

func (a *API) updateMe(w http.ResponseWriter, r *http.Request) error {
	user, err := a.require(r)
	if err != nil {
		return err
	}
	obj, err := validate.ReadObject(r)
	if err != nil {
		return err
	}
	input, err := validate.ProfileInput(obj)
	if err != nil {
		return err
	}
	updated, err := a.Store.UpdateProfile(r.Context(), user.ID, input.Nickname, input.Email, input.BioSet, input.Bio)
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, map[string]any{"user": updated}, nil)
	return nil
}

func (a *API) changePassword(w http.ResponseWriter, r *http.Request) error {
	user, err := a.require(r)
	if err != nil {
		return err
	}
	obj, err := validate.ReadObject(r)
	if err != nil {
		return err
	}
	input, err := validate.PasswordInput(obj)
	if err != nil {
		return err
	}
	current, err := decryptField(a.Store.Keys, input.Current, "currentPassword")
	if err != nil {
		return err
	}
	next, err := decryptField(a.Store.Keys, input.New, "newPassword")
	if err != nil {
		return err
	}
	if err := validate.PasswordStrength(next, "newPassword"); err != nil {
		return err
	}
	if err := a.Store.ChangePassword(r.Context(), user.ID, current, next); err != nil {
		return err
	}
	revoked, err := a.Store.DestroyAllSessions(r.Context(), user.ID)
	if err != nil {
		return err
	}
	if err := a.clearCookie(w); err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, map[string]any{"reauthRequired": true, "revokedSessions": revoked}, nil)
	return nil
}

func (a *API) sessions(w http.ResponseWriter, r *http.Request) error {
	user, err := a.require(r)
	if err != nil {
		return err
	}
	token := service.TokenFromRequest(r, a.Store.Config.CookieName)
	list, err := a.Store.ListSessions(r.Context(), user.ID, token)
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, list, nil)
	return nil
}

func (a *API) revokeSessions(w http.ResponseWriter, r *http.Request) error {
	user, err := a.require(r)
	if err != nil {
		return err
	}
	token := service.TokenFromRequest(r, a.Store.Config.CookieName)
	n, err := a.Store.DestroyOtherSessions(r.Context(), token, user.ID)
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, map[string]any{"revokedSessions": n}, nil)
	return nil
}

func (a *API) profile(w http.ResponseWriter, r *http.Request) error {
	profile, count, err := a.Store.ProfileByUsername(r.Context(), chi.URLParam(r, "username"))
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, map[string]any{"user": profile, "postCount": count}, nil)
	return nil
}

func (a *API) listPosts(w http.ResponseWriter, r *http.Request) error {
	q, err := validate.PostListQuery(r)
	if err != nil {
		return err
	}
	viewer, err := a.viewer(r)
	if err != nil {
		return err
	}
	items, page, err := a.Store.ListPosts(r.Context(), q, viewer)
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, items, map[string]any{"pagination": page})
	return nil
}

func (a *API) createPost(w http.ResponseWriter, r *http.Request) error {
	user, err := a.require(r)
	if err != nil {
		return err
	}
	obj, err := validate.ReadObject(r)
	if err != nil {
		return err
	}
	input, err := validate.CreatePost(obj)
	if err != nil {
		return err
	}
	post, err := a.Store.CreatePost(r.Context(), input, *user)
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusCreated, post, nil)
	return nil
}

func (a *API) getPost(w http.ResponseWriter, r *http.Request) error {
	slug := chi.URLParam(r, "slug")
	if r.URL.Query().Get("view") == "edit" {
		user, err := a.require(r)
		if err != nil {
			return err
		}
		post, err := a.Store.PostForEdit(r.Context(), slug, user)
		if err != nil {
			return err
		}
		httpx.WriteData(w, http.StatusOK, post, nil)
		return nil
	}
	viewer, err := a.viewer(r)
	if err != nil {
		return err
	}
	post, err := a.Store.PostBySlug(r.Context(), slug, viewer, true)
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, post, nil)
	return nil
}

func (a *API) updatePost(w http.ResponseWriter, r *http.Request) error {
	user, err := a.require(r)
	if err != nil {
		return err
	}
	obj, err := validate.ReadObject(r)
	if err != nil {
		return err
	}
	input, err := validate.UpdatePost(obj)
	if err != nil {
		return err
	}
	post, err := a.Store.UpdatePost(r.Context(), chi.URLParam(r, "slug"), input, user)
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, post, nil)
	return nil
}

func (a *API) deletePost(w http.ResponseWriter, r *http.Request) error {
	user, err := a.require(r)
	if err != nil {
		return err
	}
	slug := chi.URLParam(r, "slug")
	if err := a.Store.DeletePost(r.Context(), slug, user); err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, map[string]any{"slug": slug, "deleted": true}, nil)
	return nil
}

func (a *API) listComments(w http.ResponseWriter, r *http.Request) error {
	q, err := validate.CommentListQuery(r)
	if err != nil {
		return err
	}
	viewer, err := a.viewer(r)
	if err != nil {
		return err
	}
	items, cursor, err := a.Store.ListComments(r.Context(), chi.URLParam(r, "slug"), q, viewer)
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, items, map[string]any{"cursor": cursor})
	return nil
}

func (a *API) createComment(w http.ResponseWriter, r *http.Request) error {
	user, err := a.require(r)
	if err != nil {
		return err
	}
	obj, err := validate.ReadObject(r)
	if err != nil {
		return err
	}
	input, err := validate.CommentInput(obj)
	if err != nil {
		return err
	}
	comment, err := a.Store.CreateComment(r.Context(), chi.URLParam(r, "slug"), input, *user)
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusCreated, comment, nil)
	return nil
}

func (a *API) deleteComment(w http.ResponseWriter, r *http.Request) error {
	user, err := a.require(r)
	if err != nil {
		return err
	}
	id, err := validate.PositiveID(chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	if err := a.Store.DeleteComment(r.Context(), id, user); err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, map[string]any{"id": id, "deleted": true}, nil)
	return nil
}

func (a *API) tags(w http.ResponseWriter, r *http.Request) error {
	tags, err := a.Store.ListTags(r.Context())
	if err != nil {
		return err
	}
	if r.URL.Query().Get("include") == "stats" {
		stats, err := a.Store.Stats(r.Context())
		if err != nil {
			return err
		}
		httpx.WriteData(w, http.StatusOK, tags, map[string]any{"stats": stats})
		return nil
	}
	httpx.WriteData(w, http.StatusOK, tags, nil)
	return nil
}

func (a *API) stats(w http.ResponseWriter, r *http.Request) error {
	stats, err := a.Store.Stats(r.Context())
	if err != nil {
		return err
	}
	httpx.WriteData(w, http.StatusOK, stats, nil)
	return nil
}

func (a *API) issue(w http.ResponseWriter, r *http.Request, userID int64, ip string) error {
	if err := a.assertSecure(); err != nil {
		return err
	}
	token, expires, err := a.Store.CreateSession(r.Context(), userID, r.UserAgent(), ip)
	if err != nil {
		return err
	}
	http.SetCookie(w, sessionCookie(a.Store.Config.CookieName, token, a.Store.Config.CookieSecure, expires))
	return nil
}

func (a *API) clearCookie(w http.ResponseWriter) error {
	if err := a.assertSecure(); err != nil {
		return err
	}
	cookie := sessionCookie(a.Store.Config.CookieName, "", a.Store.Config.CookieSecure, time.Unix(0, 0))
	cookie.MaxAge = -1
	http.SetCookie(w, cookie)
	return nil
}

func (a *API) assertSecure() error {
	if a.Store.Config.Production && !a.Store.Config.CookieSecure {
		return errors.New("生产环境必须设置 COOKIE_SECURE=true（否则会话 Cookie 会在明文 HTTP 上泄露）。即使 TLS 在反向代理处终止，也仍需开启该选项。")
	}
	return nil
}

func sessionCookie(name, value string, secure bool, expires time.Time) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		Expires:  expires,
	}
}

func decryptField(keys *password.KeyStore, envelope, field string) (string, error) {
	result := keys.Decrypt(envelope)
	if result.OK {
		return result.Plaintext, nil
	}
	if result.Reason == "unknown_key" {
		return "", errs.BadRequest(field + ": 加密密钥已更新，请刷新页面后重试")
	}
	return "", errs.BadRequest(field + ": 密码解密失败，请刷新页面后重试")
}
