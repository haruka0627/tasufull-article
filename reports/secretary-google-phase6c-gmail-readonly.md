# AI秘書 Phase 6-C — Gmail read-only

**日付:** 2026-06-27  
**状態:** ✅ 実装完了（未コミット）  
**前提:** Phase 6-B OAuth + Token Vault (`67ec43a`)

---

## スコープ

| 許可 | 禁止（Phase 6-D まで） |
| --- | --- |
| `messages.list` | `messages.send` |
| `messages.get` | `drafts.create` / `drafts.send` |
| `threads.get` | `messages.trash` / `messages.delete` |
| `labels.list` | `messages.modify` 等 |
| 検索 `q` · preset | 本文送信 · 下書き保存 · 削除 |
| 添付 **metadata** のみ | 添付ファイル DL |

---

## アーキテクチャ

```
Dashboard UI (cards)
  → admin-ai-secretary-google-gmail-client.js
  → secretary-google-tools (action=gmail)
  → _shared/secretary-google-gmail.ts
  → ensureGoogleAccessToken (refresh)
  → Gmail API v1 (live) | mock fixtures
```

---

## 主要ファイル

| ファイル | 役割 |
| --- | --- |
| `supabase/functions/_shared/secretary-google-gmail.ts` | Read API · mock · normalize · write block |
| `supabase/functions/secretary-google-tools/index.ts` | `action=gmail` ルーティング |
| `supabase/functions/_shared/secretary-google-oauth.ts` | `ensureGoogleAccessToken` |
| `admin-ai-secretary-google-gmail-client.js` | Edge プロキシ client |
| `admin-ai-secretary-google-gmail-ui.js` | カード UI · preset · 検索 |
| `admin-operations-dashboard.html` | Gmail パネル + script タグ |
| `admin-operations-dashboard.css` | Gmail カードスタイル |

---

## UI

- Google 接続バー直下に **Gmail（閲覧のみ）** パネル
- Preset: 未読 / 重要 / 添付 / 受信トレイ
- 検索 `q` 入力（Gmail 検索構文）
- メールカード: 件名 · From · 日時 · snippet · バッジ · 添付 metadata
- フッター: 「送信・下書き・削除は Phase 6-D 以降」

mock モード（Secret 未設定 or `SECRETARY_GOOGLE_OAUTH_MOCK=1`）では fixture 3 件を返す。

---

## テスト

```bash
node scripts/test-secretary-google-gmail-phase6c.mjs
node scripts/test-secretary-google-oauth-phase6b.mjs   # 回帰
```

---

## 次フェーズ

**Phase 6-D:** Gmail write + Human Send Gate（L3）— 送信前承認必須
