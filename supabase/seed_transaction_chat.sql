-- 開発用サンプルデータ（任意）
-- 実行前に transaction_chat.sql を適用してください。

insert into public.transaction_rooms (
  id, listing_id, listing_type, title,
  partner_id, partner_display_name, partner_avatar_url,
  buyer_id, seller_id, expires_at
) values
(
  '11111111-1111-1111-1111-111111111001',
  'worker_hiro_001', 'worker', '渋谷周辺で買い物代行・即日対応します',
  'u_hiro', 'ひろ', 'https://placehold.co/64x64/fff6df/7a5710?text=H',
  'u_me', 'u_hiro', now() + interval '42 hours'
),
(
  '11111111-1111-1111-1111-111111111002',
  'skill_sd_2026', 'skill', 'SDキャラ制作（商用OK）',
  'u_sachi', 'さちこ', 'https://placehold.co/64x64/f3ead4/967622?text=S',
  'u_me', 'u_sachi', now() + interval '7 hours'
),
(
  '11111111-1111-1111-1111-111111111003',
  'product_set_2026', 'product', 'プレミアム家電セット 2026',
  'u_store', 'premium_home', 'https://placehold.co/64x64/f3ead4/967622?text=PH',
  'u_me', 'u_store', now() - interval '5 hours'
)
on conflict (id) do nothing;

insert into public.transaction_messages (room_id, sender_id, message, created_at) values
('11111111-1111-1111-1111-111111111001', 'u_me', 'はじめまして。明日18時ごろに、スーパーで買い物代行をお願いできますか？', now() - interval '6 hours'),
('11111111-1111-1111-1111-111111111001', 'u_hiro', '可能です！対応エリア内なのでスムーズに動けます。', now() - interval '5 hours'),
('11111111-1111-1111-1111-111111111002', 'u_sachi', 'ご依頼ありがとうございます。参考画像があれば共有ください。', now() - interval '15 hours');

insert into public.transaction_reads (room_id, user_id, last_read_at) values
('11111111-1111-1111-1111-111111111001', 'u_me', now() - interval '2 hours'),
('11111111-1111-1111-1111-111111111002', 'u_me', now() - interval '12 hours')
on conflict (room_id, user_id) do nothing;
