package service

import (
	"context"
	"database/sql"
	"fmt"

	"blog/server-go/internal/errs"
	"blog/server-go/internal/slug"
)

func (s *Store) ListTags(ctx context.Context) ([]TagSummary, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT t.id, t.name, t.slug, COUNT(p.id) AS postCount
		FROM Tag t
		JOIN PostTag pt ON pt.tagId = t.id
		JOIN Post p ON p.id = pt.postId AND p.status = 'PUBLISHED' AND p.deletedAt IS NULL
		GROUP BY t.id, t.name, t.slug
		HAVING postCount > 0
		ORDER BY postCount DESC, t.name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TagSummary{}
	for rows.Next() {
		var tag TagSummary
		var count int
		if err := rows.Scan(&tag.ID, &tag.Name, &tag.Slug, &count); err != nil {
			return nil, err
		}
		tag.PostCount = &count
		out = append(out, tag)
	}
	return out, rows.Err()
}

func (s *Store) TagBySlug(ctx context.Context, slugValue string) (TagSummary, error) {
	var tag TagSummary
	err := s.DB.QueryRowContext(ctx, `SELECT id, name, slug FROM Tag WHERE slug = ?`, slugValue).
		Scan(&tag.ID, &tag.Name, &tag.Slug)
	if err == sql.ErrNoRows {
		return TagSummary{}, errs.NotFound("标签不存在")
	}
	return tag, err
}

func (s *Store) syncPostTags(ctx context.Context, q Q, postID int64, names []string) error {
	ids, err := s.resolveTags(ctx, q, names)
	if err != nil {
		return err
	}
	if _, err := q.ExecContext(ctx, `DELETE FROM PostTag WHERE postId = ?`, postID); err != nil {
		return err
	}
	for _, id := range ids {
		if _, err := q.ExecContext(ctx, `INSERT IGNORE INTO PostTag (postId, tagId) VALUES (?, ?)`, postID, id); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) resolveTags(ctx context.Context, q Q, names []string) ([]int64, error) {
	clean := slug.Normalize(names, 8)
	seen := map[int64]struct{}{}
	var ids []int64
	for _, name := range clean {
		tagSlug := slug.Tag(name)
		res, err := q.ExecContext(ctx, `INSERT INTO Tag (name, slug, createdAt) VALUES (?, ?, ?)`, name, tagSlug, now())
		var id int64
		if err != nil {
			if !isDup(err) {
				return nil, err
			}
			err = q.QueryRowContext(ctx, `SELECT id FROM Tag WHERE name = ? OR slug = ? LIMIT 1`, name, tagSlug).Scan(&id)
			if err == sql.ErrNoRows {
				return nil, errs.Conflict(fmt.Sprintf("标签「%s」创建失败，请重试", name))
			}
			if err != nil {
				return nil, err
			}
		} else {
			id, err = res.LastInsertId()
			if err != nil {
				return nil, err
			}
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids, nil
}

func (s *Store) pruneOrphanTags(ctx context.Context, q Q) error {
	_, err := q.ExecContext(ctx, `
		DELETE t FROM Tag t
		LEFT JOIN PostTag pt ON pt.tagId = t.id
		WHERE pt.tagId IS NULL`)
	return err
}
