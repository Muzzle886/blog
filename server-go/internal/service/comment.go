package service

import (
	"context"
	"database/sql"

	"blog/server-go/internal/errs"
	"blog/server-go/internal/validate"
)

type Cursor struct {
	NextCursor *int64 `json:"nextCursor"`
	HasMore    bool   `json:"hasMore"`
	Total      int    `json:"total"`
}

func (s *Store) ListComments(ctx context.Context, slugValue string, q validate.CommentQuery, viewer *PublicUser) ([]CommentItem, Cursor, error) {
	postID, err := s.visiblePostID(ctx, slugValue, viewer)
	if err != nil {
		return nil, Cursor{}, err
	}
	var total int
	if err := s.DB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM Comment
		WHERE postId = ? AND deletedAt IS NULL AND parentId IS NULL`, postID).Scan(&total); err != nil {
		return nil, Cursor{}, err
	}
	args := []any{postID}
	cursorSQL := ""
	if q.Cursor != nil {
		cursorSQL = " AND id < ?"
		args = append(args, *q.Cursor)
	}
	args = append(args, q.Limit+1)
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, content, parentId, createdAt, authorId
		FROM Comment
		WHERE postId = ? AND deletedAt IS NULL AND parentId IS NULL`+cursorSQL+`
		ORDER BY createdAt DESC
		LIMIT ?`, args...)
	if err != nil {
		return nil, Cursor{}, err
	}
	defer rows.Close()
	roots, err := scanComments(rows)
	if err != nil {
		return nil, Cursor{}, err
	}
	hasMore := len(roots) > q.Limit
	if hasMore {
		roots = roots[:q.Limit]
	}
	if err := s.attachAuthors(ctx, roots); err != nil {
		return nil, Cursor{}, err
	}
	if err := s.attachReplies(ctx, roots); err != nil {
		return nil, Cursor{}, err
	}
	var next *int64
	if len(roots) > 0 {
		id := roots[len(roots)-1].ID
		next = &id
	}
	return roots, Cursor{NextCursor: next, HasMore: hasMore, Total: total}, nil
}

func (s *Store) CreateComment(ctx context.Context, slugValue string, in validate.CommentWrite, author PublicUser) (CommentItem, error) {
	postID, err := s.visiblePostID(ctx, slugValue, &author)
	if err != nil {
		return CommentItem{}, err
	}
	parentID := in.ParentID
	if parentID != nil {
		var existingParent sql.NullInt64
		err := s.DB.QueryRowContext(ctx, `
			SELECT parentId FROM Comment
			WHERE id = ? AND postId = ? AND deletedAt IS NULL`, *parentID, postID).Scan(&existingParent)
		if err == sql.ErrNoRows {
			return CommentItem{}, errs.NotFound("要回复的评论不存在")
		}
		if err != nil {
			return CommentItem{}, err
		}
		if existingParent.Valid {
			parentID = &existingParent.Int64
		}
	}
	stamp := now()
	res, err := s.DB.ExecContext(ctx, `
		INSERT INTO Comment (content, postId, authorId, parentId, createdAt, updatedAt)
		VALUES (?, ?, ?, ?, ?, ?)`,
		in.Content, postID, author.ID, parentID, stamp, stamp)
	if err != nil {
		return CommentItem{}, err
	}
	id, _ := res.LastInsertId()
	return CommentItem{
		ID:        id,
		Content:   in.Content,
		ParentID:  parentID,
		CreatedAt: iso(stamp),
		Author:    Author{ID: author.ID, Username: author.Username, Nickname: author.Nickname},
		Replies:   []CommentItem{},
	}, nil
}

func (s *Store) DeleteComment(ctx context.Context, id int64, viewer *PublicUser) error {
	var authorID, postID int64
	err := s.DB.QueryRowContext(ctx, `
		SELECT authorId, postId FROM Comment WHERE id = ? AND deletedAt IS NULL`, id).Scan(&authorID, &postID)
	if err == sql.ErrNoRows {
		return errs.NotFound("评论不存在")
	}
	if err != nil {
		return err
	}
	var postAuthor int64
	if err := s.DB.QueryRowContext(ctx, `SELECT authorId FROM Post WHERE id = ?`, postID).Scan(&postAuthor); err != nil && err != sql.ErrNoRows {
		return err
	}
	if authorID != viewer.ID && postAuthor != viewer.ID && viewer.Role != "ADMIN" {
		return errs.Forbidden("只能删除自己的评论")
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	stamp := now()
	if _, err := tx.ExecContext(ctx, `UPDATE Comment SET deletedAt = ?, updatedAt = ? WHERE id = ?`, stamp, stamp, id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE Comment SET deletedAt = ?, updatedAt = ?
		WHERE parentId = ? AND deletedAt IS NULL`, stamp, stamp, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) visiblePostID(ctx context.Context, slugValue string, viewer *PublicUser) (int64, error) {
	where, args := visibility(viewer)
	where = append([]string{"p.slug = ?"}, where...)
	args = append([]any{slugValue}, args...)
	var id int64
	err := s.DB.QueryRowContext(ctx, `SELECT p.id FROM Post p WHERE `+joinAnd(where), args...).Scan(&id)
	if err == sql.ErrNoRows {
		return 0, errs.NotFound("文章不存在或未公开")
	}
	return id, err
}

type rawComment struct {
	CommentItem
	authorID int64
}

func scanComments(rows *sql.Rows) ([]CommentItem, error) {
	var out []CommentItem
	for rows.Next() {
		var item CommentItem
		var parent sql.NullInt64
		var created sql.NullTime
		var authorID int64
		if err := rows.Scan(&item.ID, &item.Content, &parent, &created, &authorID); err != nil {
			return nil, err
		}
		if parent.Valid {
			item.ParentID = &parent.Int64
		}
		if created.Valid {
			item.CreatedAt = iso(created.Time)
		}
		item.Author.ID = authorID
		item.Replies = []CommentItem{}
		out = append(out, item)
	}
	if out == nil {
		out = []CommentItem{}
	}
	return out, rows.Err()
}

func (s *Store) attachAuthors(ctx context.Context, comments []CommentItem) error {
	ids := map[int64]struct{}{}
	for _, c := range comments {
		ids[c.Author.ID] = struct{}{}
	}
	authors, err := s.authorsByID(ctx, ids)
	if err != nil {
		return err
	}
	for i := range comments {
		if a, ok := authors[comments[i].Author.ID]; ok {
			comments[i].Author = a
		}
	}
	return nil
}

func (s *Store) attachReplies(ctx context.Context, roots []CommentItem) error {
	if len(roots) == 0 {
		return nil
	}
	ids := make([]int64, len(roots))
	for i, c := range roots {
		ids[i] = c.ID
	}
	query, args := inClause(`
		SELECT id, content, parentId, createdAt, authorId
		FROM Comment
		WHERE deletedAt IS NULL AND parentId IN (%s)
		ORDER BY createdAt ASC`, ids)
	rows, err := s.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	replies, err := scanComments(rows)
	if err != nil {
		return err
	}
	if err := s.attachAuthors(ctx, replies); err != nil {
		return err
	}
	grouped := map[int64][]CommentItem{}
	for _, reply := range replies {
		if reply.ParentID == nil {
			continue
		}
		list := grouped[*reply.ParentID]
		if len(list) >= 50 {
			continue
		}
		grouped[*reply.ParentID] = append(list, reply)
	}
	for i := range roots {
		if list := grouped[roots[i].ID]; list != nil {
			roots[i].Replies = list
		}
	}
	return nil
}

func (s *Store) authorsByID(ctx context.Context, ids map[int64]struct{}) (map[int64]Author, error) {
	if len(ids) == 0 {
		return map[int64]Author{}, nil
	}
	list := make([]int64, 0, len(ids))
	for id := range ids {
		list = append(list, id)
	}
	query, args := inClause(`SELECT id, username, nickname FROM User WHERE id IN (%s)`, list)
	rows, err := s.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]Author{}
	for rows.Next() {
		var a Author
		if err := rows.Scan(&a.ID, &a.Username, &a.Nickname); err != nil {
			return nil, err
		}
		out[a.ID] = a
	}
	return out, rows.Err()
}

func joinAnd(parts []string) string {
	out := parts[0]
	for _, p := range parts[1:] {
		out += " AND " + p
	}
	return out
}
