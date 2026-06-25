# TLV v1.0 — 公開後削除候補（dead code）

**実施日:** 2026-06-25  
**方針:** v1.0 では **削除しない**。安定稼働後の v1.1+ で整理。

---

## 判定方法

- `scripts/audit-tlv-dead-js.mjs` — HTML `src` からの直接参照のみ（動的 import・相対パスは要人手確認）
- 手動コードレビュー（dev 専用・レガシー移行・プレースホルダー）

---

## 削除候補一覧

| # | 対象 | 理由 | リスク | 推奨タイミング |
|---|------|------|--------|----------------|
| 1 | `live/system-notify-dev.html` | localhost 限定 system 通知デバッグ UI | 低（`isLocalTlvDevHost()` ガード） | dist から除外する hardening 時 |
| 2 | `live/system-notify-dev.js` | 上記のロジック | 低 | 同上 |
| 3 | `tlv-dev-auth.js` 内 `NOTIFY_STORE_KEY_LEGACY` / `legacyNotifyRowToItem` | 旧 localStorage キーからの一回限り移行 | 中（既存 dev データ） | 移行完了確認後 |
| 4 | `live/live-studio-placeholder.js` のプレースホルダーデータ塊 | Studio 未接続ページの mock UI | 低（本番はプレースホルダー表示） | Studio API 接続後 |
| 5 | `live/index.html` | ルートリダイレクト／旧エントリの可能性 | 要確認（ブックマーク） | アクセスログ確認後 |
| 6 | `live/watch.html` vs `live/watch-live.html` | ライブ視聴の旧／新 URL 併存 | 中（外部リンク） | リダイレクト統一後 |
| 7 | `live/create.html` + `live-create.js` | 旧配信作成フロー（studio 移行済みの場合） | 中 | Studio 導線一本化後 |
| 8 | `live/short-upload.html` + `live-short-upload.js` | ショート投稿の独立ページ（studio 統合候補） | 中 | アップロード導線整理時 |
| 9 | `live/offline.html` + `live-offline.js` | オフライン告知の独立ページ | 低 | 通知チャネル統合後 |
| 10 | `live/gifts.html` / `live/tips.html` | ギフト・応援の Phase 1 ページ（利用頻度要確認） | 中 | 収益化 v2 設計後 |

---

## 誤検出（削除しない）

| 対象 | 理由 |
|------|------|
| `live/live-shorts-watch.js` | `live/shorts/watch.html` から `../live-shorts-watch.js` で参照（audit スクリプトは未検出） |
| `live/tlv-dev-auth.js` | 本番では無効化されるが **dev 必須** |
| `live/tlv-private-test-gate.js` | 本番プライベートテスト用ゲート |
| `live/live-talk-bridge.js` | `profile.html` から参照 |
| `live/live-my-page.js` | `my-videos.html` から参照 |

---

## dist 同梱の整理候補

| 対象 | 備考 |
|------|------|
| `deploy/cloudflare/dist/live/system-notify-dev.*` | ビルドパイプラインで dev ファイル除外可能（optional hardening） |

---

## 削除済み（参考）

| 対象 | 時期 |
|------|------|
| `TasuTlvNotificationService.renderFollowText` | Phase 5 dead code 整理（未使用） |

---

## 再監査コマンド

```bash
node scripts/audit-tlv-dead-js.mjs
```
