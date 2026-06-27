# AI秘書 Phase 6-H — Google Drive read-only

**日付:** 2026-06-27  
**状態:** ✅ 実装完了  
**前提:** Phase 6-B OAuth · Phase 6-G Contacts (`cf24c54`)

---

## スコープ

| 実装 | 禁止 |
| --- | --- |
| `files.list` | `files.create` |
| `files.get` | `files.update` / `delete` |
| `files.export` (Docs/Sheets/Slides) | `permissions.*` |
| フォルダ表示 · keyword · mimeType · recent | `files.upload` · Human Gate |

---

## アーキテクチャ

```
Dashboard UI (Mail | Calendar | Contacts | Drive tabs)
  → admin-ai-secretary-google-drive-client.js
  → secretary-google-tools (action=drive_read)
  → _shared/secretary-google-drive.ts
  → ensureGoogleAccessToken
  → Google Drive API v3 (live) | mock fixtures
```

---

## UI

- Preset: 最近のファイル · マイドライブ
- mimeType chips: フォルダ · Docs · Sheets · Slides · PDF
- キーワード検索 (`fullText contains`)
- フォルダクリックで配下表示（パンくず）
- 詳細パネル + テキスト抽出プレビュー

---

## テスト結果

| スクリプト | 結果 |
| --- | --- |
| `test-secretary-google-drive-phase6h.mjs` | **44/44 PASS** |
| `test-secretary-google-contacts-phase6g.mjs` | **42/42 PASS** |
| `test-secretary-google-calendar-phase6f.mjs` | **39/39 PASS** |
| `test-secretary-google-calendar-phase6e.mjs` | **53/53 PASS** |
| `test-secretary-google-gmail-phase6c.mjs` | **43/43 PASS** |
| `test-secretary-google-gmail-phase6d.mjs` | **35/35 PASS** |
| `test-secretary-google-oauth-phase6b.mjs` | **45/45 PASS** |
| `test-secretary-ai-voice-integration-phase1.mjs` | **35/35 PASS** |

---

## 127.0.0.1:8788 確認

| Viewport | HTTP 200 | Drive tab | recent/search | Console Error | 横スクロール |
| --- | --- | --- | --- | --- | --- |
| 1280 | ✅ | ✅ | ✅ | 0 | なし |
| 768 | ✅ | ✅ | ✅ | 0 | なし |
| 390 | ✅ | ✅ | ✅ | 0 | なし |

**Secret 非露出:** `sanitizeForClient` · client に token リテラルなし
