# TLV（live）差分棚卸し（ANPI 完了後）

**実施日:** 2026-06-26  
**HEAD:** `f91b202` — `build(anpi): sync Pages dist for anpi auth wiring`  
**作業種別:** 調査・分類のみ（コード変更 / stage / commit なし）

---

## 1. git status 概要

| 区分 | 件数 | 備考 |
|------|------|------|
| 全体 `M`（tracked 変更） | **57** | TLV 直結は **41**（dist/live `M` 40 + `D` 1） |
| 全体 `??`（未追跡） | **~100+** | AI秘書 dist・supabase-ops・site CSS・reports 混在 |
| **TLV source `live/` `M`** | **0** | root `live/**` は **HEAD と一致（クリーン）** |
| **TLV dist `M`** | **40** | `deploy/cloudflare/dist/live/**` |
| **TLV dist `D`** | **1** | `live-notifications-page.js`（source にも存在せず） |
| **TLV dist `??`** | **5 エントリ** | 新規 4 ファイル + `live/data/`（JSON 6件） |
| **TLV test/scripts `M`** | **0** | `scripts/test-tlv-*` · `scripts/tlv-*` クリーン |
| **TLV reports `M`** | **3** | `reports/tlv-business-simulator/*` |

`git diff --stat` 全体: **57 files, +4768 / -583**（TLV dist が **+926 / -52** 相当、残りは AI秘書 admin-ops 等）

### 直近コミット（ANPI 完了済み）

```
f91b202 build(anpi): sync Pages dist for anpi auth wiring
2412c6d feat(anpi): wire platform actor resolver for anpi admin rls
b655014 build(talk): sync Pages dist for talk modules and chat gate
```

TLV **source** の機能コミットは既に存在（例: `6e86ff5` tasful ai entry、`f3d0038` payout status、`6231eee` payout pipeline）。**未コミットは dist 同期遅れのみ。**

---

## 2. TLV 候補一覧

### 2-1. パターン抽出ヒット（`git diff --name-status`）

**dist/live（41件）:**

| 状態 | 件数 | パス |
|------|------|------|
| M | 40 | `deploy/cloudflare/dist/live/*`（下記フルリスト） |
| D | 1 | `deploy/cloudflare/dist/live/live-notifications-page.js` |

**reports（3件 · TLV 関連）:**

| 状態 | パス |
|------|------|
| M | `reports/tlv-business-simulator/README.md` |
| M | `reports/tlv-business-simulator/payout-engine-v2-implementation-phase.md` |
| M | `reports/tlv-business-simulator/stripe-connect-payout-plan.md` |

**パターン誤検出:** `reports/builder-release-status.md` 等はヒットせず。

### 2-2. dist/live `M`（40件）

```
admin-videos.html          analytics.html           channel-content.html
create.html                creator-dashboard.html   gifts.html
history.html               index.html               liked-videos.html
live-channel-content.js    live-creator-dashboard.js live.css
my-videos.html             notifications.html       offline.html
playlists.html             profile.html             settings.html
short-upload.html          shorts.html              shorts/watch.html
studio-analytics.html      studio-audio-library.html studio-community.html
studio-copyright.html      studio-customization.html studio-dashboard.html
studio-monetization.html   studio-subtitles.html    studio.html
system-notify-dev.html     tips.html                tlv-feature-flags.js  ← 要除外検討
tlv-videos-sidebar.js      video-upload.html        videos.html
watch-later.html           watch-live.html          watch-video.html
watch.html
```

### 2-3. dist/live `??`（初回 dist 同梱候補 · 5エントリ / 10ファイル）

| パス | source 対応 | 内容 |
|------|-------------|------|
| `live/admin-payouts.html` | `live/admin-payouts.html` ✓追跡済み | 管理 payout 画面 |
| `live/live-admin-payouts.js` | 同上 | 管理 JS |
| `live/payout-policy.html` | 同上 | payout ポリシー |
| `live/tlv-creator-payout-display.js` | 同上 | クリエイター payout パネル |
| `live/data/*.json`（6件） | `live/data/` ✓追跡済み | payout / rank / stripe マップ等 |

```
condition-lines.json
creator-rank-explanation.json
monthly-payout-decision.json
payment-history.json
tlv-payout-creator-map.json
tlv-stripe-connect-accounts.json
```

### 2-4. 差分テーマ（dist のみ · source は既コミット済み）

| テーマ | 代表ファイル | 概要 |
|--------|--------------|------|
| **クリエイター payout パネル** | `live.css` (+615), `live-creator-dashboard.js`, `tlv-creator-payout-display.js` (??) | `TasuTlvCreatorPayoutDisplay` 統合 · SSOT payout 表示 |
| **チャンネルコンテンツ** | `live-channel-content.js` (+25) | チャンネル監査/コンテンツ回帰系 |
| **Payout 管理・データ** | `admin-payouts.html`, `live/data/*` (??) | Phase 4–5 admin payouts |
| **サイドバー** | `tlv-videos-sidebar.js` (+1) | 軽微更新 |
| **HTML 一括** | 多数 `.html` (+1〜+24) | 大半は `robots` meta 正規化・ビルド時 CRLF/エンコーディング差分。`index.html` はハブ文言含む |
| **削除** | `live-notifications-page.js` (D) | 廃止ページ · source にファイルなし |
| **feature flags** | `tlv-feature-flags.js` (M) | **ビルド生成物への置換のみ**（値は同じ · 下記 E 参照） |

### 2-5. 必須確認ファイル

| 確認対象 | 結果 |
|----------|------|
| `live/**` source | **差分 0** · 91 ファイル追跡済み |
| `watch-video*` | dist `watch-video.html` `M` · source クリーン |
| `creator-dashboard*` | dist `creator-dashboard.html` + `live-creator-dashboard.js` `M` |
| `creator-studio*` | `studio-*.html` 多数 `M`（主にメタ/エンコーディング） |
| `creator-payout*` | `tlv-creator-payout-display.js` dist `??` · CSS/JS 更新 |
| `follow*` | `live/live-follow.js` 等は source 追跡済み・**diff なし** |
| `subscription*` / `live-chat*` / `video-player*` / `recommendation*` | ファイル名一致なし · 既存資産のみ |
| `live/data/*` | dist `??` · source 6 JSON 追跡済み |
| `ai-model-gateway.js` | dist `M` · **Gateway トラック（TLV 外）** |
| `voice-settings.*` | dist `??` · **Voice トラック** |
| `supabase-ops-*` | dist `??` · **supabase-ops トラック** |
| `chat-service.js` | **クリーン**（Talk dist コミット済 `b655014`） |

---

## 3. 分類表

### A. TLV source（0件 · 変更なし）

`git diff HEAD -- live/` → **空**。機能は `6e86ff5` 等で既コミット。

### B. TLV dist（51ファイル相当）

- **M:** 40
- **D:** 1
- **A（??）:** 4 + `data/` 内 6 = **10**

**推奨 stage 範囲:** `deploy/cloudflare/dist/live/**`  
**推奨除外:** `deploy/cloudflare/dist/live/tlv-feature-flags.js`（ビルド生成 · 下記 E）

### C. TLV test/scripts（0件 · 変更なし）

既存スイート（コミット対象外 · 検証用）:

- `scripts/test-tlv-channel-content-regression.mjs`
- `scripts/test-tlv-channel-audit.mjs`
- `scripts/test-tlv-dev-auth-security.mjs`
- `scripts/test-tlv-tasful-ai-entry.mjs`
- `scripts/test-tlv-prod-guest-check.mjs`
- `scripts/verify-live-youtube-p15-production-deploy-checklist.mjs`
- `scripts/lib/tlv-dist-manifest.mjs`
- `scripts/tlv-payout-engine.mjs` 等

### D. TLV reports/docs（3件）

```
reports/tlv-business-simulator/README.md
reports/tlv-business-simulator/payout-engine-v2-implementation-phase.md
reports/tlv-business-simulator/stripe-connect-payout-plan.md
```

シミュレータ/設計ドキュメント。**dist コミットとは独立**で任意コミット。

### E. 共通基盤（TLV コミットに混ぜない）

| ファイル | 状態 | 分類 |
|----------|------|------|
| `deploy/cloudflare/dist/live/tlv-feature-flags.js` | M | **ビルド生成**（`stage-cloudflare-pages.mjs` · 「Do not commit dist copy」）。フラグ値は source と同一。ANPI `chat-supabase-config` と同方針で **dist コミットから除外推奨** |
| `deploy/cloudflare/dist/chat-supabase-config.js` | ?? | デプロイ生成 · Platform/supabase |
| `deploy/cloudflare/dist/ai-model-gateway.js` | M | **Gateway** |
| `deploy/cloudflare/dist/voice-settings.*` | ?? | **Voice** |
| `deploy/cloudflare/dist/supabase-ops-*` | ?? | **supabase-ops** |
| `deploy/cloudflare/dist/stripe-connect-*.js` | ?? | root は追跡済み・クリーン。TLV payout 隣接だが **`live/` 外** → 別トラック（payout/Connect） |
| `deploy/cloudflare/dist/stripe-connect-trouble.css` | ?? | 同上 |
| `chat-service.js` | クリーン | Talk 済 · TLV 外 |

### F. AI秘書共有

| ファイル | 差分 |
|----------|------|
| `ai-ops-case-store.js` | +3（`TasuAdminAiDailyInbox`） |
| `deploy/cloudflare/dist/admin-ai-*` | 大規模 |
| `deploy/cloudflare/dist/admin-operations-dashboard.*` | 大規模 |
| `deploy/cloudflare/dist/ai-ops-case-store.js` | +3 |

### G. Platform 誤検出

パターン `channel` で `live/channel-content.html` のみ — **TLV 正検出**。

### H. Talk 誤検出

**0 件**（`live-notifications-page.js` 削除は TLV 内整理 · Talk 無関係）。

### I. 判断不能

| 項目 | 判断 |
|------|------|
| HTML 40件中の軽微 diff | 機能変更というより **build:pages 正規化ノイズ** が混在。`live.css` / JS 数件が実質変更 |
| `stripe-connect-*` dist | payout データと論理関連あるが path が `live/` 外。TLV dist 単独コミットには **含めない** |

---

## 4. Go / No-Go 判定

| 質問 | 判定 | 根拠 |
|------|------|------|
| TLV source だけ先に切れるか | **N/A（不要）** | `live/**` 差分 0。source コミット不要 |
| dist は別コミットにすべきか | **Go（推奨）** | Builder/Platform/Talk/ANPI と同パターン。`npm run build:pages` → `deploy/cloudflare/dist/live/**` のみ |
| test/scripts は独立か | **独立（変更不要）** | 変更なし。検証のみ利用 |
| 共通基盤を分離できるか | **Go** | `tlv-feature-flags.js` · Gateway · Voice · supabase-ops · AI秘書は stage 除外で分離可 |
| TLV 単独 dist コミットとして安全か | **Go（条件付き）** | `git add deploy/cloudflare/dist/live/` 選別 + `tlv-feature-flags.js` 除外。混入防止に `git diff --cached` 必須 |

**No-Go 条件:**

- `admin-operations-dashboard.*` / `ai-model-gateway.js` を TLV コミットに含める
- `tlv-feature-flags.js` をビルド生成版のままコミット（ポリシー抵触 · 実害は小さいが除外推奨）
- `git add -A` 使用

**FEATURE FROZEN 注記:** TLV v1.0 は AD-004 / Production Ready 凍結。今回は **dist 同期（デプロイ資産追従）** であり、新規製品機能追加ではないと解釈可能。

---

## 5. 推奨コミット単位

### Commit 1 — dist のみ（source 不要）

```
build(tlv): sync Pages dist for live modules and payout assets
```

**手順:**

```bash
npm run build:pages
git add deploy/cloudflare/dist/live/
# tlv-feature-flags.js が stage されたら unstage:
git reset deploy/cloudflare/dist/live/tlv-feature-flags.js
git diff --cached --name-status   # live/** のみ確認
```

**期待 stage 件数:** 約 **50**（40 M + 1 D + 9 A · `tlv-feature-flags.js` 除外）

**含めない:**

- `deploy/cloudflare/dist/live/tlv-feature-flags.js`（ビルド生成）
- `stripe-connect-*` dist root
- AI秘書 / Gateway / Voice / supabase-ops
- `reports/tlv-business-simulator/*`（任意 · 別コミット可）

### Commit 2（任意）— reports

```
docs(tlv): update business simulator payout reports
```

3 ファイルのみ。

---

## 6. 推奨テスト

**dist コミット前後:**

```bash
npm run build:pages
node scripts/verify-live-youtube-p15-production-deploy-checklist.mjs
node scripts/test-tlv-channel-content-regression.mjs
node scripts/test-tlv-channel-audit.mjs
node scripts/test-tlv-dev-auth-security.mjs
node scripts/test-tlv-tasful-ai-entry.mjs
node scripts/test-tlv-prod-guest-check.mjs
```

**payout 回帰（任意）:**

```bash
node scripts/tlv-creator-dashboard-display.mjs
node scripts/tlv-admin-payout-display.mjs
```

`BASE_URL=http://127.0.0.1:8788` で dist 配信サーバー上実行。

---

## 7. 注意点

1. **dist-only 作業:** source は既に HEAD にある。コミットメッセージは「sync dist」が正確。
2. **`tlv-feature-flags.js`:** ビルドが dist を上書きする。コミット済み dist 版（source コピー）のまま維持し、CI デプロイ時に再生成される設計。
3. **`live-notifications-page.js` 削除:** 意図的廃止。D として dist コミットに含める。
4. **誤 stage リスク:** ワークツリーに AI秘書 `admin-operations-dashboard` (+2842 CSS 行) が残存。**`deploy/cloudflare/dist/live/` のみ**厳守（AD-007）。
5. **TLV 凍結:** Critical / dist 同期 / Security 以外の製品変更は避ける。今回は Pages dist 遅れ解消。
6. **`stripe-connect-*`:** root 追跡済みだが dist 未同梱。TLV payout 表示は `live/data/*.json` 経由。Connect UI は別トラックで dist 同期を検討。

---

## 8. 件数サマリ（報告用）

| # | 区分 | 件数 |
|---|------|------|
| ① | TLV source | **0** |
| ② | TLV dist | **51**（M 40 + D 1 + ?? 10）· うち **1 除外推奨**（`tlv-feature-flags.js`）→ 実質 **50** |
| ③ | test/scripts（変更） | **0** |
| ④ | reports/docs | **3**（`reports/tlv-business-simulator/*`） |
| ⑤ | 共通基盤 | **Gateway 1** · **Voice 3** · **supabase-ops 10+** · **stripe-connect dist 4** · **chat-supabase-config 1** · **tlv-feature-flags 1** · AI秘書 6+ |
