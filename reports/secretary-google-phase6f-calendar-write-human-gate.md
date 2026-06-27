# AI秘書 Phase 6-F — Google Calendar write + Human Gate

**日付:** 2026-06-27  
**状態:** ✅ 実装完了  
**前提:** Phase 6-B OAuth · Phase 6-E Calendar read (`86bd95f`)

---

## スコープ

| 実装 | 禁止 |
| --- | --- |
| `events.insert` / `update` / `delete` | 確認なし write |
| Human Gate 必須（create/update/delete） | 定期予定（Recurring）編集 |
| DeepSeek = 意図抽出のみ | Google API 実行判断を LLM に委譲 |
| Phase 6-E read-only 維持 | token / secret クライアント露出 |

---

## アーキテクチャ

```
Dashboard UI
  → parseEventIntent (DeepSeek · 抽出のみ)
  → enqueueFromCalendarEvent (HSG pending)
  → 内容確認 + 承認 / キャンセル
  → executeWriteApproved
  → secretary-google-tools (action=calendar_write)
  → executeCalendarWrite + ensureGoogleAccessToken
  → Google Calendar API v3
```

`calendar_read` 経由の write は引き続き `403 calendar_read_only`。

---

## 主要ファイル

| ファイル | 役割 |
| --- | --- |
| `supabase/functions/_shared/secretary-google-calendar.ts` | Read + Write · mock · human_gate_required |
| `supabase/functions/secretary-google-tools/index.ts` | `action=calendar_write` |
| `supabase/functions/_shared/secretary-google-oauth.ts` | `calendar.events` scope |
| `admin-ai-secretary-google-calendar-client.js` | Read/Write client · parseEventIntent |
| `admin-ai-secretary-google-calendar-ui.js` | 作成/変更/削除 · 確認パネル · 状態 |
| `admin-ai-human-send-gate.js` | calendar branch · enqueueFromCalendarEvent |
| `admin-operations-dashboard.html` | 作成フォーム · confirm host |
| `scripts/test-secretary-google-calendar-phase6f.mjs` | 6-F テスト |

---

## UI 状態

| 状態 | 表示 |
| --- | --- |
| 閲覧 | 予定カード一覧 |
| 作成確認待ち | 予定作成確認 |
| 更新確認待ち | 予定変更確認 |
| 削除確認待ち | 予定削除確認 |
| 完了 | 実行結果 |

---

## テスト結果

| スクリプト | 結果 |
| --- | --- |
| `test-secretary-google-calendar-phase6f.mjs` | **39/39 PASS** |
| `test-secretary-google-calendar-phase6e.mjs` | **53/53 PASS** |
| `test-secretary-google-gmail-phase6c.mjs` | **43/43 PASS** |
| `test-secretary-google-gmail-phase6d.mjs` | **35/35 PASS** |
| `test-secretary-google-oauth-phase6b.mjs` | **45/45 PASS** |
| `test-secretary-ai-voice-integration-phase1.mjs` | **35/35 PASS** |

---

## 127.0.0.1:8788 確認

| Viewport | HTTP 200 | 予定作成 UI | Human Gate host | Console Error | 横スクロール |
| --- | --- | --- | --- | --- | --- |
| 1280 | ✅ | ✅ | ✅ | 0 | なし |
| 768 | ✅ | ✅ | ✅ | 0 | なし |
| 390 | ✅ | ✅ | ✅ | 0 | なし |

**Secret 非露出:** `sanitizeForClient` · client に token リテラルなし

---

## 次フェーズ

**Phase 6-G:** Contacts read-only
