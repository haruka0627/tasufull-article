# Platform Live Phase 5 — P5-7 Comments vs Platform Chat Policy

**Date:** 2026-06-29  
**Status:** Policy locked for Phase 5 (no full Chat merge)

## 現状（Phase 5 完了時点）

| 経路 | 実装 | watch 画面での役割 |
| --- | --- | --- |
| **Supabase comments** | `live/live-comments.js` · `TasuLiveComments.mountComments` | **正** — 視聴ページのコメント UI / 投稿 / 一覧 |
| **Platform Chat** | `TlvPlatformLiveAdapter.sendChatMessage` → Integration Chat Gateway | **別経路** — RTC/Platform Live セッション用。watch UI からは **未接続** |

## Phase 5 方針（P5-7）

1. **Supabase comments を壊さない** — 既存 `mountComments` フロー維持。
2. **Platform Chat 本体統合はしない** — watch コメント入力を Chat Gateway に切り替えない。
3. **Flag ON でも comments バックエンドは supabase** — `data-live-comments-backend="supabase"` を付与。
4. **Platform Chat は deferred** — `data-live-platform-chat-deferred="true"`（Flag ON 時）。
5. **診断用ポリシー** — `window.__tlvPlatformLiveCommentsPolicy` に backend / defer 情報を記録。

## 責務分離

```
watch.html
  ├─ TasuLiveComments (Supabase)     ← ユーザー可視コメント（Phase 5 正）
  └─ TlvPlatformLiveBridge (RTC)     ← player / join / leave（P5-5〜P5-8）
       └─ Adapter.sendChatMessage     ← Platform Chat 入口（Future · UI未接続）
```

## Future / Phase 6 候補（本番統合時）

- 二重投稿防止（Supabase + Platform Chat）
- `set_watching` / messageId 同期（P4-3 系 Integration 経路）
- モデレーション・レート制限の単一正本
- Flag による段階的切替（read-only mirror → write path）

## 実装タッチポイント（Phase 5 最小）

- `live/live-broadcasts.js` — `applyPlatformLiveCommentsPolicy(commentsMount)` on watch mount
- **変更なし:** `live-comments.js` ロジック · Chat Gateway 契約 · DB schema

## 非目標（Phase 5）

- Platform Chat UI の watch 埋め込み
- comments テーブル移行
- Chat / comments のマージリファクタ
