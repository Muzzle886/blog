package service

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"sync"

	"github.com/go-sql-driver/mysql"

	"blog/server-go/internal/errs"
	"blog/server-go/internal/password"
)

type userRow struct {
	ID           int64
	Username     string
	Nickname     string
	Email        string
	Bio          sql.NullString
	Role         string
	PasswordHash string
	CreatedAt    sql.NullTime
}

func (u userRow) public() PublicUser {
	created := ""
	if u.CreatedAt.Valid {
		created = iso(u.CreatedAt.Time)
	}
	return PublicUser{
		ID:        u.ID,
		Username:  u.Username,
		Nickname:  u.Nickname,
		Email:     u.Email,
		Bio:       strPtr(u.Bio),
		Role:      u.Role,
		CreatedAt: created,
	}
}

func (u userRow) profile() PublicProfile {
	created := ""
	if u.CreatedAt.Valid {
		created = iso(u.CreatedAt.Time)
	}
	return PublicProfile{
		ID:        u.ID,
		Username:  u.Username,
		Nickname:  u.Nickname,
		Bio:       strPtr(u.Bio),
		CreatedAt: created,
	}
}

const userCols = `id, username, nickname, email, bio, role, passwordHash, createdAt`

func scanUser(row interface{ Scan(...any) error }) (userRow, error) {
	var u userRow
	err := row.Scan(&u.ID, &u.Username, &u.Nickname, &u.Email, &u.Bio, &u.Role, &u.PasswordHash, &u.CreatedAt)
	return u, err
}

var (
	dummyOnce sync.Once
	dummyHash string
)

func dummyPasswordHash() string {
	dummyOnce.Do(func() {
		hashed, err := password.Hash("dummy-timing-padding")
		if err != nil {
			log.Printf("[user] 无法准备登录耗时填充: %v", err)
			return
		}
		dummyHash = hashed
	})
	return dummyHash
}

func (s *Store) Register(ctx context.Context, username, email, nickname, plain string) (PublicUser, error) {
	var existingName, existingEmail string
	err := s.DB.QueryRowContext(ctx, `
		SELECT username, email FROM User
		WHERE deletedAt IS NULL AND (username = ? OR email = ?)
		LIMIT 1`, username, email).Scan(&existingName, &existingEmail)
	if err == nil {
		if existingName == username {
			return PublicUser{}, errs.Conflict("用户名已被占用")
		}
		return PublicUser{}, errs.Conflict("邮箱已被注册")
	}
	if err != sql.ErrNoRows {
		return PublicUser{}, err
	}

	hashed, err := password.Hash(plain)
	if err != nil {
		return PublicUser{}, err
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return PublicUser{}, err
	}
	defer tx.Rollback()

	var active int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM User WHERE deletedAt IS NULL`).Scan(&active); err != nil {
		return PublicUser{}, err
	}
	role := "USER"
	if active == 0 {
		role = "ADMIN"
	}
	res, err := tx.ExecContext(ctx, `
		INSERT INTO User (username, email, passwordHash, nickname, role, createdAt, updatedAt)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		username, email, hashed, nickname, role, now(), now())
	if err != nil {
		if isDup(err) {
			return PublicUser{}, errs.Conflict("用户名或邮箱已被占用")
		}
		return PublicUser{}, err
	}
	id, _ := res.LastInsertId()
	if err := tx.Commit(); err != nil {
		return PublicUser{}, err
	}
	return s.UserByID(ctx, id)
}

func (s *Store) Authenticate(ctx context.Context, identifier, plain string) (PublicUser, error) {
	row := s.DB.QueryRowContext(ctx, `
		SELECT `+userCols+` FROM User
		WHERE deletedAt IS NULL AND (username = ? OR email = ?)
		LIMIT 1`, identifier, identifier)
	user, err := scanUser(row)
	if err == sql.ErrNoRows {
		if dummy := dummyPasswordHash(); dummy != "" {
			_, _ = password.Verify(plain, dummy)
		}
		return PublicUser{}, errs.Unauthorized("账号或密码错误")
	}
	if err != nil {
		return PublicUser{}, err
	}
	result, err := password.Verify(plain, user.PasswordHash)
	if err != nil {
		return PublicUser{}, err
	}
	if !result.Valid {
		return PublicUser{}, errs.Unauthorized("账号或密码错误")
	}
	if result.NeedsRehash {
		go s.rehash(user.ID, plain)
	}
	return user.public(), nil
}

func (s *Store) rehash(userID int64, plain string) {
	hashed, err := password.Hash(plain)
	if err != nil {
		log.Printf("[user] 密码哈希升级失败: %v", err)
		return
	}
	if _, err := s.DB.ExecContext(context.Background(), `UPDATE User SET passwordHash = ?, updatedAt = ? WHERE id = ?`, hashed, now(), userID); err != nil {
		log.Printf("[user] 密码哈希升级失败: %v", err)
	}
}

func (s *Store) UserByID(ctx context.Context, id int64) (PublicUser, error) {
	user, err := scanUser(s.DB.QueryRowContext(ctx, `SELECT `+userCols+` FROM User WHERE id = ? AND deletedAt IS NULL`, id))
	if err == sql.ErrNoRows {
		return PublicUser{}, errs.NotFound("用户不存在")
	}
	if err != nil {
		return PublicUser{}, err
	}
	return user.public(), nil
}

func (s *Store) ProfileByUsername(ctx context.Context, username string) (PublicProfile, int, error) {
	user, err := scanUser(s.DB.QueryRowContext(ctx, `SELECT `+userCols+` FROM User WHERE username = ? AND deletedAt IS NULL`, username))
	if err == sql.ErrNoRows {
		return PublicProfile{}, 0, errs.NotFound("用户不存在")
	}
	if err != nil {
		return PublicProfile{}, 0, err
	}
	var count int
	if err := s.DB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM Post
		WHERE authorId = ? AND deletedAt IS NULL AND status = 'PUBLISHED'`, user.ID).Scan(&count); err != nil {
		return PublicProfile{}, 0, err
	}
	return user.profile(), count, nil
}

func (s *Store) UpdateProfile(ctx context.Context, userID int64, nickname, email *string, bioSet bool, bio *string) (PublicUser, error) {
	if email != nil {
		var id int64
		err := s.DB.QueryRowContext(ctx, `
			SELECT id FROM User WHERE email = ? AND id <> ? AND deletedAt IS NULL`, *email, userID).Scan(&id)
		if err == nil {
			return PublicUser{}, errs.Conflict("邮箱已被注册")
		}
		if err != sql.ErrNoRows {
			return PublicUser{}, err
		}
	}
	sets := []string{"updatedAt = ?"}
	args := []any{now()}
	if nickname != nil {
		sets = append(sets, "nickname = ?")
		args = append(args, *nickname)
	}
	if bioSet {
		sets = append(sets, "bio = ?")
		if bio == nil {
			args = append(args, nil)
		} else {
			args = append(args, *bio)
		}
	}
	if email != nil {
		sets = append(sets, "email = ?")
		args = append(args, *email)
	}
	args = append(args, userID)
	query := "UPDATE User SET " + join(sets) + " WHERE id = ?"
	if _, err := s.DB.ExecContext(ctx, query, args...); err != nil {
		if isDup(err) {
			return PublicUser{}, errs.Conflict("邮箱已被注册")
		}
		return PublicUser{}, err
	}
	return s.UserByID(ctx, userID)
}

func (s *Store) ChangePassword(ctx context.Context, userID int64, current, next string) error {
	var hash string
	err := s.DB.QueryRowContext(ctx, `SELECT passwordHash FROM User WHERE id = ?`, userID).Scan(&hash)
	if err == sql.ErrNoRows {
		return errs.NotFound("用户不存在")
	}
	if err != nil {
		return err
	}
	result, err := password.Verify(current, hash)
	if err != nil {
		return err
	}
	if !result.Valid {
		return errs.Unauthorized("当前密码不正确")
	}
	if current == next {
		return errs.Conflict("新密码不能与当前密码相同")
	}
	hashed, err := password.Hash(next)
	if err != nil {
		return err
	}
	_, err = s.DB.ExecContext(ctx, `UPDATE User SET passwordHash = ?, updatedAt = ? WHERE id = ?`, hashed, now(), userID)
	return err
}

func isDup(err error) bool {
	var me *mysql.MySQLError
	return errors.As(err, &me) && me.Number == 1062
}

func join(parts []string) string {
	out := parts[0]
	for _, p := range parts[1:] {
		out += ", " + p
	}
	return out
}
