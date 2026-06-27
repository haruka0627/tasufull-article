# AI秘書 Phase 6-E — Google Calendar read-only

**日付:** 2026-06-27  
**状態:** ✅ 実装完了（未コミット）  
**前提:** Phase 6-B OAuth · Phase 6-D Gmail (`52b9425`)

---

## スコープ

| 実装 | 禁止 |
| --- | --- |
| `calendarList.list` | `events.insert` |
| `events.list` | `events.update` / `delete` |
| `events.get` | `calendars.clear` |
| preset / keyword 検索 | Human Gate（read-only のため不要） |
| UI カード + 詳細 | DeepSeek |

---

## アーキテクチャ

```
Dashboard UI (Mail | Calendar tabs)
  → admin-ai-secretary-google-calendar-client.js
  → secretary-google-tools (action=calendar_read)
  → _shared/secretary-google-calendar.ts
  → ensureGoogleAccessToken
  → Google Calendar API v3 (live) | mock fixtures
```

---

## 主要ファイル

| ファイル | 役割 |
| --- | --- |
| `supabase/functions/_shared/secretary-google-calendar.ts` | Read API · presets · mock · write block |
| `supabase/functions/secretary-google-tools/index.ts` | `action=calendar_read` |
| `supabase/functions/_shared/secretary-google-oauth.ts` | `calendar.readonly` scope |
| `admin-ai-secretary-google-calendar-client.js` | Edge プロキシ client |
| `admin-ai-secretary-google-calendar-ui.js` | カード · 詳細 · タブ |
| `admin-operations-dashboard.html` | Mail / Calendar タブ |

---

## UI

- Google 接続バー下: **Mail | Calendar** タブ
- Preset: 今日 / 明日 / 今週 / 今後7日
- キーワード検索
- 予定カード: タイトル · 開始/終了 · 終日 · 場所 · 参加者 · カレンダー名 · ステータス
- クリックで詳細パネル

---

## テスト

```bash
node scripts/test-secretary-google-calendar-phase6e.mjs
node scripts/test-secretary-google-gmail-phase6c.mjs
node scripts/test-secretary-google-gmail-phase6d.mjs
node scripts/test-secretary-google-oauth-phase6b.mjs
node scripts/test-secretary-ai-voice-integration-phase1.mjs
```

---

## 次フェーズ

**Phase 6-F:** Calendar write + Human Gate
