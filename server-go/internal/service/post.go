package service

import (
	"context"
	"database/sql"
	"log"
	"math"
	"strings"

	"blog/server-go/internal/errs"
	"blog/server-go/internal/markdown"
	"blog/server-go/internal/slug"
	"blog/server-go/internal/validate"
)

type Page struct {
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

func (s *Store) ListPosts(ctx context.Context, q validate.PostQuery, viewer *PublicUser) ([]PostSummary, Page, error) {
	if q.Status == "DRAFT" && viewer == nil {
		return nil, Page{}, errs.Forbidden("查看草稿需要登录")
	}
	where, args := visibility(viewer)
	if q.Status != "ALL" {
		where = append(where, "p.status = ?")
		args = append(args, q.Status)
	}
	if q.Tag != "" {
		where = append(where, `EXISTS (
			SELECT 1 FROM PostTag pt JOIN Tag t ON t.id = pt.tagId
			WHERE pt.postId = p.id AND t.slug = ?)`)
		args = append(args, q.Tag)
	}
	if q.Author != "" {
		where = append(where, `(u.username = ? OR u.nickname = ?)`)
		args = append(args, q.Author, q.Author)
	}
	if q.Q != "" {
		like := "%" + q.Q + "%"
		where = append(where, `(p.title LIKE ? OR p.summary LIKE ? OR p.content LIKE ?)`)
		args = append(args, like, like, like)
	}
	clause := strings.Join(where, " AND ")
	var total int
	if err := s.DB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM Post p JOIN User u ON u.id = p.authorId WHERE `+clause, args...).Scan(&total); err != nil {
		return nil, Page{}, err
	}
	order := "p.publishedAt DESC, p.id DESC"
	switch q.Sort {
	case "oldest":
		order = "p.publishedAt ASC, p.id ASC"
	case "popular":
		order = "p.views DESC, p.publishedAt DESC"
	}
	listArgs := append(append([]any{}, args...), q.PageSize, (q.Page-1)*q.PageSize)
	rows, err := s.DB.QueryContext(ctx, `
		SELECT p.id, p.slug, p.title, p.summary, p.status, p.views, p.publishedAt, p.createdAt, p.updatedAt,
		       u.id, u.username, u.nickname
		FROM Post p JOIN User u ON u.id = p.authorId
		WHERE `+clause+` ORDER BY `+order+` LIMIT ? OFFSET ?`, listArgs...)
	if err != nil {
		return nil, Page{}, err
	}
	defer rows.Close()
	posts, ids, err := scanPosts(rows)
	if err != nil {
		return nil, Page{}, err
	}
	if err := s.attachTags(ctx, s.DB, posts, ids); err != nil {
		return nil, Page{}, err
	}
	if err := s.attachCounts(ctx, s.DB, posts, ids); err != nil {
		return nil, Page{}, err
	}
	pages := 1
	if q.PageSize > 0 {
		pages = int(math.Max(1, math.Ceil(float64(total)/float64(q.PageSize))))
	}
	return values(posts), Page{Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: pages}, nil
}

func (s *Store) PostBySlug(ctx context.Context, slugValue string, viewer *PublicUser, increment bool) (PostDetail, error) {
	where, args := visibility(viewer)
	where = append([]string{"p.slug = ?"}, where...)
	args = append([]any{slugValue}, args...)
	post, err := s.onePost(ctx, strings.Join(where, " AND "), args)
	if err == sql.ErrNoRows {
		return PostDetail{}, errs.NotFound("文章不存在或未公开")
	}
	if err != nil {
		return PostDetail{}, err
	}
	if increment && post.Status == "PUBLISHED" {
		id := post.ID
		go func() {
			if _, err := s.DB.ExecContext(context.Background(), `UPDATE Post SET views = views + 1, updatedAt = ? WHERE id = ?`, now(), id); err != nil {
				log.Printf("[post] increment views failed: %v", err)
			}
		}()
	}
	return s.detail(post)
}

func (s *Store) PostForEdit(ctx context.Context, slugValue string, viewer *PublicUser) (PostDetail, error) {
	post, err := s.onePost(ctx, `p.slug = ? AND p.deletedAt IS NULL`, []any{slugValue})
	if err == sql.ErrNoRows {
		return PostDetail{}, errs.NotFound("文章不存在")
	}
	if err != nil {
		return PostDetail{}, err
	}
	if post.Author.ID != viewer.ID && viewer.Role != "ADMIN" {
		return PostDetail{}, errs.Forbidden("只能编辑自己的文章")
	}
	return s.detail(post)
}

func (s *Store) CreatePost(ctx context.Context, in validate.PostWrite, author PublicUser) (PostDetail, error) {
	summary := ""
	if in.Summary != nil {
		summary = strings.TrimSpace(*in.Summary)
	}
	if summary == "" {
		summary = markdown.Summary(*in.Content, 160)
	}
	status := "DRAFT"
	if in.Status != nil {
		status = *in.Status
	}
	var published any
	if status == "PUBLISHED" {
		published = now()
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return PostDetail{}, err
	}
	defer tx.Rollback()

	var id int64
	for attempt := 0; attempt < 3; attempt++ {
		res, err := tx.ExecContext(ctx, `
			INSERT INTO Post (slug, title, summary, content, status, views, authorId, publishedAt, createdAt, updatedAt)
			VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
			slug.Post(), *in.Title, summary, *in.Content, status, author.ID, published, now(), now())
		if err == nil {
			id, _ = res.LastInsertId()
			break
		}
		if !isDup(err) || attempt == 2 {
			return PostDetail{}, err
		}
	}
	if err := s.syncPostTags(ctx, tx, id, in.Tags); err != nil {
		return PostDetail{}, err
	}
	if err := tx.Commit(); err != nil {
		return PostDetail{}, err
	}
	return s.postByID(ctx, id)
}

func (s *Store) UpdatePost(ctx context.Context, slugValue string, in validate.PostWrite, viewer *PublicUser) (PostDetail, error) {
	var existing struct {
		id          int64
		authorID    int64
		content     string
		status      string
		publishedAt sql.NullTime
	}
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, authorId, content, status, publishedAt FROM Post
		WHERE slug = ? AND deletedAt IS NULL`, slugValue).
		Scan(&existing.id, &existing.authorID, &existing.content, &existing.status, &existing.publishedAt)
	if err == sql.ErrNoRows {
		return PostDetail{}, errs.NotFound("文章不存在")
	}
	if err != nil {
		return PostDetail{}, err
	}
	if existing.authorID != viewer.ID && viewer.Role != "ADMIN" {
		return PostDetail{}, errs.Forbidden("只能编辑自己的文章")
	}

	sets := []string{}
	args := []any{}
	if in.Title != nil {
		sets = append(sets, "title = ?")
		args = append(args, *in.Title)
	}
	if in.Content != nil {
		sets = append(sets, "content = ?")
		args = append(args, *in.Content)
	}
	contentForSummary := existing.content
	if in.Content != nil {
		contentForSummary = *in.Content
	}
	if in.SummarySet {
		summary := ""
		if in.Summary != nil {
			summary = strings.TrimSpace(*in.Summary)
		}
		if summary == "" {
			summary = markdown.Summary(contentForSummary, 160)
		}
		sets = append(sets, "summary = ?")
		args = append(args, summary)
	} else if in.Content != nil {
		sets = append(sets, "summary = ?")
		args = append(args, markdown.Summary(*in.Content, 160))
	}
	if in.Status != nil && *in.Status != existing.status {
		sets = append(sets, "status = ?")
		args = append(args, *in.Status)
		if *in.Status == "PUBLISHED" && !existing.publishedAt.Valid {
			sets = append(sets, "publishedAt = ?")
			args = append(args, now())
		}
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return PostDetail{}, err
	}
	defer tx.Rollback()
	if len(sets) > 0 {
		sets = append(sets, "updatedAt = ?")
		args = append(args, now(), existing.id)
		if _, err := tx.ExecContext(ctx, `UPDATE Post SET `+join(sets)+` WHERE id = ?`, args...); err != nil {
			return PostDetail{}, err
		}
	}
	if in.TagsSet {
		if err := s.syncPostTags(ctx, tx, existing.id, in.Tags); err != nil {
			return PostDetail{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return PostDetail{}, err
	}
	return s.postByID(ctx, existing.id)
}

func (s *Store) DeletePost(ctx context.Context, slugValue string, viewer *PublicUser) error {
	var id, authorID int64
	err := s.DB.QueryRowContext(ctx, `SELECT id, authorId FROM Post WHERE slug = ? AND deletedAt IS NULL`, slugValue).Scan(&id, &authorID)
	if err == sql.ErrNoRows {
		return errs.NotFound("文章不存在")
	}
	if err != nil {
		return err
	}
	if authorID != viewer.ID && viewer.Role != "ADMIN" {
		return errs.Forbidden("只能删除自己的文章")
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `UPDATE Post SET deletedAt = ?, updatedAt = ? WHERE id = ?`, now(), now(), id); err != nil {
		return err
	}
	if err := s.pruneOrphanTags(ctx, tx); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) Stats(ctx context.Context) (map[string]int, error) {
	out := map[string]int{}
	queries := []struct {
		key string
		sql string
	}{
		{"posts", `SELECT COUNT(*) FROM Post WHERE deletedAt IS NULL AND status = 'PUBLISHED'`},
		{"drafts", `SELECT COUNT(*) FROM Post WHERE deletedAt IS NULL AND status = 'DRAFT'`},
		{"tags", `SELECT COUNT(*) FROM Tag`},
		{"comments", `SELECT COUNT(*) FROM Comment WHERE deletedAt IS NULL`},
	}
	for _, item := range queries {
		var n int
		if err := s.DB.QueryRowContext(ctx, item.sql).Scan(&n); err != nil {
			return nil, err
		}
		out[item.key] = n
	}
	return out, nil
}

func (s *Store) postByID(ctx context.Context, id int64) (PostDetail, error) {
	post, err := s.onePost(ctx, `p.id = ? AND p.deletedAt IS NULL`, []any{id})
	if err == sql.ErrNoRows {
		return PostDetail{}, errs.NotFound("文章不存在")
	}
	if err != nil {
		return PostDetail{}, err
	}
	return s.detail(post)
}

type loadedPost struct {
	PostSummary
	Content string
}

func (s *Store) onePost(ctx context.Context, where string, args []any) (loadedPost, error) {
	row := s.DB.QueryRowContext(ctx, `
		SELECT p.id, p.slug, p.title, p.summary, p.content, p.status, p.views, p.publishedAt, p.createdAt, p.updatedAt,
		       u.id, u.username, u.nickname
		FROM Post p JOIN User u ON u.id = p.authorId
		WHERE `+where, args...)
	var p loadedPost
	var published sql.NullTime
	var created, updated sql.NullTime
	err := row.Scan(
		&p.ID, &p.Slug, &p.Title, &p.Summary, &p.Content, &p.Status, &p.Views, &published, &created, &updated,
		&p.Author.ID, &p.Author.Username, &p.Author.Nickname,
	)
	if err != nil {
		return loadedPost{}, err
	}
	p.PublishedAt = isoPtr(published)
	if created.Valid {
		p.CreatedAt = iso(created.Time)
	}
	if updated.Valid {
		p.UpdatedAt = iso(updated.Time)
	}
	p.Tags = []TagSummary{}
	posts := []*PostSummary{&p.PostSummary}
	if err := s.attachTags(ctx, s.DB, posts, []int64{p.ID}); err != nil {
		return loadedPost{}, err
	}
	if err := s.attachCounts(ctx, s.DB, posts, []int64{p.ID}); err != nil {
		return loadedPost{}, err
	}
	return p, nil
}

func (s *Store) detail(post loadedPost) (PostDetail, error) {
	return PostDetail{
		PostSummary: post.PostSummary,
		Content:     post.Content,
		HTML:        markdown.Render(post.Content),
	}, nil
}

func visibility(viewer *PublicUser) ([]string, []any) {
	if viewer != nil && viewer.Role == "ADMIN" {
		return []string{"p.deletedAt IS NULL"}, nil
	}
	if viewer != nil {
		return []string{"p.deletedAt IS NULL", "(p.status = 'PUBLISHED' OR p.authorId = ?)"}, []any{viewer.ID}
	}
	return []string{"p.deletedAt IS NULL", "p.status = 'PUBLISHED'"}, nil
}

func scanPosts(rows *sql.Rows) ([]*PostSummary, []int64, error) {
	var posts []*PostSummary
	var ids []int64
	for rows.Next() {
		p := &PostSummary{Tags: []TagSummary{}}
		var published, created, updated sql.NullTime
		if err := rows.Scan(&p.ID, &p.Slug, &p.Title, &p.Summary, &p.Status, &p.Views, &published, &created, &updated, &p.Author.ID, &p.Author.Username, &p.Author.Nickname); err != nil {
			return nil, nil, err
		}
		p.PublishedAt = isoPtr(published)
		if created.Valid {
			p.CreatedAt = iso(created.Time)
		}
		if updated.Valid {
			p.UpdatedAt = iso(updated.Time)
		}
		posts = append(posts, p)
		ids = append(ids, p.ID)
	}
	if posts == nil {
		posts = []*PostSummary{}
	}
	return posts, ids, rows.Err()
}

func (s *Store) attachTags(ctx context.Context, q Q, posts []*PostSummary, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	query, args := inClause(`
		SELECT pt.postId, t.id, t.name, t.slug
		FROM PostTag pt JOIN Tag t ON t.id = pt.tagId
		WHERE pt.postId IN (%s)
		ORDER BY t.id ASC`, ids)
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	byPost := map[int64][]TagSummary{}
	for rows.Next() {
		var postID int64
		var tag TagSummary
		if err := rows.Scan(&postID, &tag.ID, &tag.Name, &tag.Slug); err != nil {
			return err
		}
		byPost[postID] = append(byPost[postID], tag)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, p := range posts {
		if tags := byPost[p.ID]; tags != nil {
			p.Tags = tags
		}
	}
	return nil
}

func (s *Store) attachCounts(ctx context.Context, q Q, posts []*PostSummary, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	query, args := inClause(`
		SELECT postId, COUNT(*) FROM Comment
		WHERE deletedAt IS NULL AND postId IN (%s)
		GROUP BY postId`, ids)
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	counts := map[int64]int{}
	for rows.Next() {
		var id int64
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			return err
		}
		counts[id] = n
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, p := range posts {
		n := counts[p.ID]
		p.CommentCount = &n
	}
	return nil
}

func inClause(format string, ids []int64) (string, []any) {
	marks := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		marks[i] = "?"
		args[i] = id
	}
	return sprintf(format, strings.Join(marks, ",")), args
}

func sprintf(format, inner string) string {
	return strings.Replace(format, "%s", inner, 1)
}

func values(posts []*PostSummary) []PostSummary {
	out := make([]PostSummary, len(posts))
	for i, p := range posts {
		out[i] = *p
	}
	return out
}
