# AI秘書 Phase 6-G — Google Contacts read-only

**日付:** 2026-06-27  
**状態:** ✅ 実装完了  
**前提:** Phase 6-B OAuth · Phase 6-F Calendar (`7dab0f4`)

---

## スコープ

| 実装 | 禁止 |
| --- | --- |
| `people.connections.list` | `people.createContact` |
| `people.searchContacts` | `people.updateContact` / `deleteContact` |
| `people.get` | Human Gate（read-only のため不要） |
| UI カード + 詳細 | DeepSeek |

---

## アーキテクチャ

```
Dashboard UI (Mail | Calendar | Contacts tabs)
  → admin-ai-secretary-google-contacts-client.js
  → secretary-google-tools (action=contacts_read)
  → _shared/secretary-google-contacts.ts
  → ensureGoogleAccessToken
  → Google People API v1 (live) | mock fixtures
```

---

## 補助導線

| ボタン | 動作 |
| --- | --- |
| Gmail返信へ | Mail タブへ切替 · 検索 `to:{email}` をプリフィル |
| Calendar参加者へ | Calendar タブへ切替 · 作成入力に参加者ヒントをプリフィル |

---

## テスト結果

| スクリプト | 結果 |
| --- | --- |
| `test-secretary-google-contacts-phase6g.mjs` | **42/42 PASS** |
| `test-secretary-google-calendar-phase6f.mjs` | **39/39 PASS** |
| `test-secretary-google-calendar-phase6e.mjs` | **53/53 PASS** |
| `test-secretary-google-gmail-phase6c.mjs` | **43/43 PASS** |
| `test-secretary-google-gmail-phase6d.mjs` | **35/35 PASS** |
| `test-secretary-google-oauth-phase6b.mjs` | **45/45 PASS** |
| `test-secretary-ai-voice-integration-phase1.mjs` | **35/35 PASS** |

## 127.0.0.1:8788 確認

| Viewport | HTTP 200 | Contacts tab | 検索 UI | Console Error | 横スクロール |
| --- | --- | --- | --- | --- | --- |
| 1280 | ✅ | ✅ | ✅ | 0 | なし |
| 768 | ✅ | ✅ | ✅ | 0 | なし |
| 390 | ✅ | ✅ | ✅ | 0 | なし |

---

## 次フェーズ

**Phase 6-H:** Drive read-only
