-- 開発用 review_scores サンプル（reviews.sql 適用後）
-- 詳細ページの data-author-user-id と一致させる

insert into public.review_scores (user_id, average_rating, total_reviews, skipped_reviews, updated_at)
values
  ('u_hiro', 4.9, 23, 2, now()),
  ('u_store', 4.8, 52, 5, now()),
  ('u_sachi', 4.9, 256, 12, now()),
  ('u_company', 4.7, 18, 1, now())
on conflict (user_id) do update set
  average_rating = excluded.average_rating,
  total_reviews = excluded.total_reviews,
  skipped_reviews = excluded.skipped_reviews,
  updated_at = excluded.updated_at;
