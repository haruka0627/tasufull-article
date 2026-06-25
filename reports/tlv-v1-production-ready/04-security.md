# TLV v1.0 — Security 最終結果

**実施日:** 2026-06-25  
**判定:** 認証バイパスなし · Production Ready 達成時点で Critical 0

---

## 1. クライアント（dev 漏れ対策）

| チェック | 本番期待 | 検証 |
|---------|---------|------|
| `isLocalTlvDevHost()` | `localhost` / `127.0.0.1` のみ | `test-tlv-dev-auth-security.mjs` unit |
| `shouldUseTlvDevDemo()` | `false` on pages.dev | ✅ |
| `shouldUseTlvFollowLocalFallback()` | `false` | `test-tlv-prod-guest-check.mjs` |
| `shouldUseTlvNotifyLocalFallback()` | `false` | ✅ |
| `getTalkUserId()`（ゲスト） | `""` | ✅ |
| `tlvDevForceGuest` on prod host | 無効 | ✅ |
| JWT 優先 | demo より JWT が勝つ | `jwt-overrides-demo-local` テスト |

**P0 修正（維持）:** `live-profile.js`, `live-watch-later.js`, `live-liked-videos.js` — demo は `isLocalTlvDevHost()` 限定

---

## 2. Edge Function（`live-notify`）

| 項目 | 実装 |
|------|------|
| JWT | `Valid user JWT required` → 401 |
| `system` 通知 | `isOpsOrAdminFromClaims()` → 403（P1-2） |
| `target_user_id` | 必須 · 400 |
| イベント種別 | `follow_created`, `comment_created`, `live_started`, `video_published`, `system` |
| 未知イベント | 400 |

**ファイル:** `supabase/functions/live-notify/index.ts`, `supabase/functions/_shared/talk-room-auth.ts`

---

## 3. RLS / DB

- v1.0 時点で migration 変更なし（Feature Freeze）
- 通知・フォローは既存 RLS + Edge 経由

---

## 4. Production Build

| 項目 | 状態 |
|------|------|
| `system-notify-dev.html` in dist | 同梱（runtime localhost ブロック） |
| `debugger` | なし |
| localhost 文字列 | runtime ガード用のみ |

---

## 5. 本番アクセス制御

- `tasufull-article.pages.dev` は **Cloudflare Access** で保護
- 未認証は TLV 未到達（多層防御）

---

## 6. 残存 Security TODO（Critical 以外）

| ファイル | 内容 | 分類 |
|---------|------|------|
| `supabase/functions/live-video-admin/index.ts:10` | moderation_logs content_type 拡張 | Low / 将来 |

---

## 7. テスト根拠

- `test-tlv-dev-auth-security.mjs` — PASS
- `test-tlv-prod-guest-check.mjs` — PASS
- `test-tlv-system-notify-dev.mjs` — ops gate PASS
