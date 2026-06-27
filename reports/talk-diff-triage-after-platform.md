# Talk 差分棚卸し（Platform 完了後）

**実施日:** 2026-06-26  
**HEAD:** `88fbcca` — `build(platform): update Pages dist assets`  
**作業種別:** 調査・分類のみ（コード変更 / stage / commit なし）

---

## 1. git status 概要

| 区分 | 件数（概算） | 備考 |
|------|-------------|------|
| 全体 `M`（tracked 変更） | **71** | うち Talk 直結は **4**（source 2 + dist chat 2） |
| 全体 `??`（未追跡） | **~200+** | dist ビルド未反映・reports・scripts 混在 |
| **Talk source `M`** | **2** | `talk-home.html`, `talk-runtime.js` |
| **Talk dist `talk-*` `??`** | **74** | dist 初回コピー |
| **Talk 隣接 dist `M`** | **2** | `chat-service.js`, `chat-detail.html` |

`git diff --stat` 全体: **71 files, +4992 / -613**（TLV live・ANPI・AI秘書・reports が大半）

---

## 2. Talk 候補一覧

### A. Talk source（コミット候補 · 変更あり）

| ファイル | 状態 | 差分概要 | 分類 |
|----------|------|----------|------|
| `talk-runtime.js` | `M` | NB-1.5: `TasuAuthCurrentUser.isOpsUser` / JWT `is_ops` 判定、`resolvePlatformActorCompat()` 追加 | **A Talk** |
| `talk-home.html` | `M` | `platform-actor-resolver.js` 読込追加（1行） | **A Talk**（Platform actor 連携） |

**その他 `talk-*` ソース（~100+ ファイル）:** git 追跡済み・**working tree クリーン**（dist のみ未同期）

### B. Talk dist

#### B-1. 未追跡 `talk-*`（74件 · dist 初回 stage 候補）

```
talk-ai-draft.js / talk-ai-draft-apply.js / talk-ai-drafts-store.js
talk-ai-search-bridge.js / talk-ai-usage-history.js / talk-ai-vendor-search.js
talk-anpi-notify-master-v1.js
talk-broadcast-audience.js / talk-broadcast-drafts-store.js
talk-builder-notify-master-v1.js
talk-calendar.html / talk-calendar.js
talk-call.css
talk-category-normalize.js
talk-chat-demo-review-mode.js / talk-chat-entry-url.js / talk-chat-profile.js / talk-chat-thread-model.js
talk-filter-ui.js
talk-follow-notify.js / talk-follow-store.js
talk-friend-hub-store.js / talk-friend-hub-ui.js / talk-friend-memo-store.js
talk-home.css / talk-home.html / talk-home.js / talk-home-data.js / talk-home-layout.js
talk-inquiry-draft.css / .html / .js / talk-inquiry-drafts-store.js
talk-job-review-mode.js
talk-line-room.js / talk-line-room-menu.js
talk-memo.html / talk-memo.js
talk-nav-phase4-mockup.html
talk-notification-settings-store.js / talk-notifications-store.js
talk-notify-actions.js / talk-notify-audience.js / talk-notify-content-type.js
talk-notify-detail.js / talk-notify-tier.js
talk-official-notify-card.js / talk-official-rooms.js
talk-ops-assistant.js
talk-ops-room.css / .html / .js
talk-ops-watch-notify.js / talk-ops-watch-notify-ui.js / talk-ops-watch-ui.js
talk-pending-draft-message.js
talk-platform-fee-notify.js / talk-platform-notify.js / talk-platform-notify-master-v1.js
talk-profile.html / talk-profile.js
talk-room-calendar-demo-seed.js / talk-room-calendar-store.js
talk-room-ensure.js / talk-room-safety-store.js
talk-runtime.js
talk-service-worker.js
talk-sub-nav.js / talk-sub-page.css
talk-supabase-sync.js
talk-support-room.js
talk-tasful-ai-sheet.css / talk-tasful-ai-sheet.js
talk-worker-review-mode.js
```

#### B-2. 変更あり dist（`talk-` 以外だが Talk チャット層）

| ファイル | 状態 | 差分 | 分類 |
|----------|------|------|------|
| `deploy/cloudflare/dist/chat-service.js` | `M` | +120/-16 · Content Gate `scanChatMessage` / `applyReviewGate` | **E → Talk dist に同梱推奨** |
| `deploy/cloudflare/dist/chat-detail.html` | `M` | +5 行（軽微配線） | **E → Talk dist に同梱推奨** |
| `deploy/cloudflare/dist/ops-talk.html` | `??` | 運営 Talk 画面 | **B Talk** |

**注意:** ルート `chat-service.js` は **クリーン**（Gate 統合はソース正本に既反映 · dist のみ遅れ）

### C. Talk test/scripts

| ファイル | 状態 | 判断 |
|----------|------|------|
| `scripts/test-talk-*.mjs`（49本） | 追跡済み・**クリーン** | 今回コミット対象外 |
| `scripts/test-ai-voice-core-browser.mjs` | `??` | **Voice API** · Talk 本体ではない |
| `scripts/talk-call-*.js` 等 | 追跡済み・クリーン | コミット不要 |

### D. Talk reports

| パターン | 状態 | 判断 |
|----------|------|------|
| `reports/talk-*.md`（既存多数） | おおむねクリーン | 今回未着手 |
| `reports/ai-secretary-text-chat-first.md` | `??` | **F AI秘書** · パターン誤検出 |

---

## 3. 特記ファイル分類（必須確認）

| パス | 判定 | 理由 |
|------|------|------|
| `chat-service.js`（root） | **E 共通基盤** | 取引チャットデータ層 · Platform/Talk/掲載横断 · Gate 統合済み |
| `deploy/.../chat-service.js` | **E（dist 同期）** | 上記の dist ミラー · Talk コミットに **同梱可** |
| `talk-platform-notify*.js` | **B Talk** | Platform 画面→TALK 通知タブ橋渡し（Talk 専用モジュール） |
| `talk-worker-review-mode.js` | **B Talk** | `talk-home?review=worker` デモ/レビュー UI |
| `talk-admin*` | **該当なし** | 未変更 · 運営は `talk-ops-*` |
| `talk-notification*` / `talk-notify-*` | **B Talk** | 通知センター・未読・ナビ |
| `talk-thread*` | **B Talk** | `talk-chat-thread-model.js`（スレッドモデル） |
| `talk-connect*` | **該当なし** | 未変更ファイル名 |
| `talk-room*` | **B Talk** | ルーム ensure / safety / calendar / line-room |
| `talk-ai-*` | **B Talk**（TASFUL AI 橋） | Talk 内 AI 下書き・検索 · **AI秘書ではない** |
| `talk-tasful-ai-sheet.*` | **B Talk** | Talk 内 TASFUL AI シート UI |
| `talk-anpi-notify-master-v1.js` | **B + ANPI 境界** | Talk 通知に ANPI イベント注入 · **Talk dist に含め可**（ANPI 本体は別） |
| `talk-builder-notify-master-v1.js` | **G Builder 誤検出リスク** | Builder→Talk 通知 · **Talk モジュールとして dist に含める**（Builder ソース変更なし） |
| `deploy/cloudflare/dist/talk*`（74） | **B Talk** | 一括 dist 初回反映 |

---

## 4. 除外一覧（パターン誤検出・別領域）

| 分類 | 代表ファイル | 除外理由 |
|------|-------------|----------|
| **F AI秘書** | `admin-ai-*`, `admin-operations-dashboard.*`, `admin-ai-daily-inbox.js` | AI 運営秘書 · Talk ではない |
| **ANPI** | `anpi-*.html`, `anpi-rls.js` + dist 鏡像 | 別プロダクト |
| **TLV** | `deploy/.../live/**`, `live-notifications-page.js` D | TLV v1.0 FROZEN |
| **G Platform 誤検出** | `anpi-notifications.html`（notify パターン）, `live/channel-content.html`, `live/notifications.html` | パターン一致のみ |
| **G Builder 誤検出** | `reports/tlv-business-simulator/stripe-connect-payout-plan.md` | connect パターン |
| **E Gateway** | `ai-model-gateway.js`（dist M） | Gemini Gateway · 別タスク |
| **E Voice API** | `voice-settings.*`（dist ??） | TASFUL AI 読み上げ設定 |
| **E supabase-ops-*** | 10ファイル ?? | Ops 読み書きアダプタ · インフラ |
| **E Platform OPS** | `platform-ops-*`（4件 ??） | Platform 運営ブリッジ（Platform コミット済み範囲外） |
| **E site chrome** | `style.css`, `top.js`, `iwasho-site-chrome.css` 等 | 横断 CSS · Talk 単独コミットに含めない |
| **reports** | `gemini-edge-diagnose.*`, `platform-*-triage.*` 等 | 調査ログ · 別タスク |

---

## 5. 共通基盤一覧（Talk コミットから分離推奨）

| ファイル | Talk との関係 | 推奨 |
|----------|--------------|------|
| `chat-service.js` | Talk/Platform 取引チャット共有 | **dist 同期は Talk コミットに同梱可**（source は既に正本反映済み） |
| `chat-detail.html` | チャット詳細 UI | 同上 |
| `chat-supabase-config.js` | Supabase 接続設定 | **別コミット（インフラ）** または Talk+infra バンドルは No-Go |
| `supabase-ops-*.js` | データソース切替 | **分離必須** |
| `ai-model-gateway.js` | LLM Gateway | **分離必須**（Gateway タスク） |
| `platform-actor-resolver.js` | Platform actor | **Platform dist 済（`88fbcca`）** · Talk source が参照開始 |
| `voice-settings.*` | Voice API | **分離**（Voice タスク） |
| `tasful-notification-settings.*` | サイト横断通知設定 | Platform/横断 · Talk 単独から除外 |

---

## 6. Go / No-Go 判定

| 質問 | 判定 |
|------|------|
| **Talk だけでコミット可能か** | **条件付き Go** — source 2件 + dist `talk-*` 74件 + chat 2件に **限定すれば可** |
| **source だけ先に切るべきか** | **Yes（推奨）** — `talk-home.html` + `talk-runtime.js` を先にコミットし、`platform-actor-resolver` 依存を明確化 |
| **dist だけか** | **No** — source 2件が未コミットのまま dist だけ先出しすると不整合 |
| **scripts を含めるべきか** | **No** — `test-talk-*` はクリーン · 新規 `test-ai-voice-core-browser.mjs` は Voice |
| **共通基盤は分離すべきか** | **一部 Yes** — `supabase-ops-*`, `ai-model-gateway`, `voice-settings` は Talk から除外 · `chat-service` dist は Talk 同梱可 |

**総合 Go/No-Go:** **Go（2段階コミット · 選別 stage 厳守）**  
**No-Go:** `git add -A`、ANPI/TLV/秘書/Gateway を Talk コミットに混ぜること

---

## 7. 推奨コミット単位

### Commit 1 — Talk source（2ファイル）

```
feat(talk): wire platform actor resolver in talk home runtime
```

- `talk-home.html`
- `talk-runtime.js`

### Commit 2 — Talk dist（build 後 · 選別 stage）

```
build(talk): sync Pages dist for talk modules and chat gate
```

**含める（~77件）:**

- `deploy/cloudflare/dist/talk-*`（74件）
- `deploy/cloudflare/dist/chat-service.js`
- `deploy/cloudflare/dist/chat-detail.html`
- `deploy/cloudflare/dist/ops-talk.html`

**含めない:**

- `supabase-ops-*`, `ai-model-gateway.js`, `voice-settings.*`
- `admin-ai-*`, `anpi-*`, `live/**`
- `platform-ops-*`（Platform OPS 別途）
- site-wide CSS/JS

### Commit 3 以降（別タスク）

- ANPI source + dist
- TLV `live/**` dist
- AI秘書 `admin-ai-*`
- Gateway `ai-model-gateway.js`
- Voice `voice-settings.*` + `scripts/test-ai-voice-core-browser.mjs`
- `supabase-ops-*` インフラバンドル

---

## 8. 推奨テスト（Talk コミット前後）

**Commit 1（source）後 · dev server 上:**

```bash
node scripts/test-talk-home-browser.mjs
node scripts/test-talk-runtime-ops-admin.mjs   # あれば ops/admin 判定
node scripts/test-talk-phase20-routes-browser.mjs
```

**Commit 2（dist）後 · 最終回帰:**

```bash
node scripts/test-talk-all-browser.mjs
node scripts/test-talk-notify-unified.mjs
node scripts/test-talk-supabase-sync-browser.mjs
node scripts/test-talk-platform-notify-browser.mjs
node scripts/test-talk-chat-hub-browser.mjs
```

**Platform 回帰（混ぜ込み防止確認）:**

```bash
node scripts/test-platform-content-gate.mjs
node scripts/smoke-platform-nb1m-content-gate-browser.mjs
```

---

## 9. サマリー（報告用）

| # | 項目 | 値 |
|---|------|-----|
| ① | **Talk source 件数** | **2**（`talk-home.html`, `talk-runtime.js`） |
| ② | **Talk dist 件数** | **74**（`talk-*` 未追跡）+ **3** 隣接（`chat-service.js`, `chat-detail.html`, `ops-talk.html`）= **77 候補** |
| ③ | **共通基盤件数** | **~18**（`chat-service`×2, `chat-supabase-config`, `supabase-ops-*`×10, `ai-model-gateway`, `voice-settings`×3, `platform-ops-*`×4 — Talk コミットから分離） |
| ④ | **コミット可能範囲** | source 2 → dist talk 74 + chat 2 + ops-talk 1 |
| ⑤ | **次に実行するテスト** | `test-talk-home-browser.mjs` → `test-talk-all-browser.mjs`（dist 後） |
| ⑥ | **推奨コミット順** | ① `feat(talk): wire platform actor...` → ② `npm run build:pages` → ③ `build(talk): sync Pages dist...` |

---

## 10. ポリシー再確認

- `git add -A` 禁止 · Talk パス指定のみ
- Builder / Platform コミット済み領域に触れない
- TLV **FEATURE FROZEN** · `live/**` は Talk コミットに含めない
- `talk-builder-notify-*` は **Talk 通知モジュール**として dist に含めてよい（Builder ソース変更ではない）
