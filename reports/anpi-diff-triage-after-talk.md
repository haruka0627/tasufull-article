# ANPI 差分棚卸し（Talk 完了後）

**実施日:** 2026-06-26  
**HEAD:** `b655014` — `build(talk): sync Pages dist for talk modules and chat gate`  
**作業種別:** 調査・分類のみ（コード変更 / stage / commit なし）

---

## 1. git status 概要

| 区分 | 件数 | 備考 |
|------|------|------|
| 全体 `M`（tracked 変更） | **67** | ANPI 直結は **10**（source 5 + dist 5） |
| 全体 `??`（未追跡） | **~120+** | AI秘書 dist・TLV live・supabase-ops・reports・scripts 混在 |
| **ANPI source `M`** | **5** | `anpi-*.html` ×4 + `anpi-rls.js` |
| **ANPI dist `M`** | **5** | `deploy/cloudflare/dist/anpi-*` 同名 |
| **ANPI test/scripts `M`** | **0** | 変更なし（既存スイートはコミット済み） |
| **ANPI reports/docs `M`** | **0** | 変更なし |

`git diff --stat` 全体: **67 files, +4844 / -591**（TLV live・AI秘書 admin-ops・reports が大半）

### 直近コミット（Talk 完了済み）

```
b655014 build(talk): sync Pages dist for talk modules and chat gate
321cd5d test(talk): fix home browser summary error scope
a3ced0c feat(talk): wire platform actor resolver in talk home runtime
```

---

## 2. ANPI 候補一覧（パターン抽出結果）

PowerShell パターン: `anpi|safety|checkin|check-in|emergency|disaster|evacuation|location|family|alert`

### 2-1. `git diff --name-status` ヒット（10件 · すべて ANPI）

| 状態 | パス |
|------|------|
| M | `anpi-dashboard.html` |
| M | `anpi-line-admin.html` |
| M | `anpi-notifications.html` |
| M | `anpi-register.html` |
| M | `anpi-rls.js` |
| M | `deploy/cloudflare/dist/anpi-dashboard.html` |
| M | `deploy/cloudflare/dist/anpi-line-admin.html` |
| M | `deploy/cloudflare/dist/anpi-notifications.html` |
| M | `deploy/cloudflare/dist/anpi-register.html` |
| M | `deploy/cloudflare/dist/anpi-rls.js` |

**パターン誤検出:** なし（`live/notifications.html` 等はヒットせず）

### 2-2. 差分の中身（テーマ）

**NB-1.5 Platform Actor / JWT ops 連携** — Talk `a3ced0c`・Platform 認証基盤と同系統。

| ファイル | 変更概要 |
|----------|----------|
| `anpi-dashboard.html` | `auth-current-user.js` + `platform-actor-resolver.js` 読込追加（各 +2行） |
| `anpi-notifications.html` | 同上 |
| `anpi-register.html` | 同上 |
| `anpi-line-admin.html` | `platform-actor-resolver.js` 読込追加（+1行）。`auth-current-user.js` は既存 |
| `anpi-rls.js` | `isAnpiAdminFromAuth()` / `isAnpiAdminFromLegacyMemberRole()` 追加。`isAnpiAdmin()` を JWT `is_ops` / Platform resolver 優先に変更（+31/-4 行） |

**依存（差分なし · 既コミット済み）:**

- `auth-current-user.js` — root/dist ともクリーン（Platform 系で既反映）
- `platform-actor-resolver.js` — 同上
- `chat-supabase-config.js` — root 追跡済み・クリーン。全 ANPI HTML が参照。dist のみ `??`（後述）

### 2-3. ANPI dist 既存資産（変更なし）

`deploy/cloudflare/dist/anpi-*` は **29 ファイル追跡済み**。今回の未コミット差分は上記 **5 ファイルのみ**。残り 24 ファイルは Talk/Platform ビルド時点で dist と同期済み。

---

## 3. 分類表

### A. ANPI source（5件）

```
anpi-dashboard.html
anpi-line-admin.html
anpi-notifications.html
anpi-register.html
anpi-rls.js
```

### B. ANPI dist（5件）

```
deploy/cloudflare/dist/anpi-dashboard.html
deploy/cloudflare/dist/anpi-line-admin.html
deploy/cloudflare/dist/anpi-notifications.html
deploy/cloudflare/dist/anpi-register.html
deploy/cloudflare/dist/anpi-rls.js
```

### C. ANPI test/scripts（0件 · 変更なし）

既存 ANPI テストは working tree クリーン。代表スイート（コミット対象外 · 検証用）:

- `scripts/test-anpi-all.mjs`（一括 17 スイート）
- `scripts/test-anpi-rls-production-browser.mjs`
- `scripts/test-anpi-line-admin-browser.mjs`
- `scripts/test-anpi-dashboard-browser.mjs`
- `scripts/lib/anpi-rls-browser-tests.mjs`

### D. ANPI reports/docs（0件 · 変更なし）

`reports/anpi-*.md` · `docs/anpi-*.md` は追跡済みだが **今回の diff に含まれない**。

### E. Talk 共有（今回 diff に残存なし）

| 項目 | 判定 |
|------|------|
| `talk-anpi-notify-master-v1.js` | **Talk dist 済**（`b655014` で `deploy/cloudflare/dist/` に同梱） |
| ANPI HTML → `talk-notifications-store.js` 等 | dist 既存 · Talk dist コミット済み |
| ANPI ページからの notify 導線 | source 変更なし |

**結論:** Talk dist に入れるべきだったものが ANPI 差分に残っている事象は **なし**。

### F. AI秘書共有（ANPI コミットに混ぜない）

| ファイル | 差分 | 理由 |
|----------|------|------|
| `ai-ops-case-store.js` | +3行 | `TasuAdminAiDailyInbox.completeInboxItem` — AI運営秘書インボックス連携 |
| `deploy/cloudflare/dist/ai-ops-case-store.js` | 同上 | dist ミラー |
| `deploy/cloudflare/dist/admin-ai-daily-inbox.js` | +81 | AI秘書 |
| `deploy/cloudflare/dist/admin-ai-morning-summary.js` | +4 | AI秘書 |
| `deploy/cloudflare/dist/admin-operations-dashboard.*` | 大規模 | AI秘書 OPS ダッシュボード（`anpi` 文字列なし） |

### G. Platform 誤検出

パターン抽出では **0 件**。ただし ANPI 実行時依存として Platform 認証モジュールを参照（差分は ANPI 側 HTML/RLS のみ）。

### H. TLV 誤検出

`deploy/cloudflare/dist/live/**` **38+ 件 `M`** — TLV 専用トラック。ANPI コミット対象外。

### I. 共通基盤・判断不能（ANPI 単独コミット時に注意）

| ファイル | 状態 | 判断 |
|----------|------|------|
| `deploy/cloudflare/dist/chat-supabase-config.js` | `??` | ANPI 全 HTML が参照。root は追跡済み・クリーン。dist 未同梱のため **ANPI dist デプロイ時に 404 リスク**。ANPI 専用変更ではないが、dist 同期時に同梱要否を要判断（Platform/supabase トラック候補） |
| `auth-current-user.js` / `platform-actor-resolver.js` | dist 既存・クリーン | 依存のみ。別コミット不要 |
| `ai-model-gateway.js` | dist `M` | Gateway トラック |
| `supabase-ops-*` / `platform-ops-*` | dist `??` | supabase-ops トラック |
| `voice-settings.*` | dist `??` | Voice トラック |
| `reports/*` 変更 8 件 | `M` | builder/tlv/gemini 系。ANPI 無関係 |

---

## 4. 必須確認ファイルの結果

| 確認対象 | 結果 |
|----------|------|
| `anpi*` source（5 `M`） | NB-1.5 auth wiring · 上記 |
| `deploy/cloudflare/dist/anpi*`（5 `M` / 24 クリーン） | source と 1:1 同期 |
| `talk-anpi-notify-master-v1.js` | Talk dist コミット済 · root クリーン |
| emergency / disaster / checkin / safety 系ファイル名 | **diff に該当なし**（既存資産のみ） |
| notification / notify 系の ANPI 単独差分 | **なし**（`anpi-notifications.html` は script タグ追加のみ） |
| admin / ops 側 ANPI 管理導線 | `anpi-line-admin.html` のみ（ANPI トラック）。`admin-operations-dashboard` は AI秘書（ANPI 文字列なし） |

---

## 5. Go / No-Go 判定

| 質問 | 判定 | 根拠 |
|------|------|------|
| ANPI source だけ先に切れるか | **Go** | 5 ファイル · 単一テーマ（NB-1.5 RLS admin + script 読込） |
| dist は source 後に別コミットすべきか | **Go（推奨）** | Builder/Platform/Talk と同パターン。`npm run build:pages` → `anpi-*` のみ stage |
| Talk 共有で Talk dist 漏れがないか | **問題なし** | `talk-anpi-notify-master-v1.js` 等は `b655014` 済み |
| AI秘書 / Gateway / Voice と分離できるか | **Go** | `ai-ops-case-store.js` 等は別トラック。混入リスクは stage 選別で回避可 |
| ANPI 単独コミットとして安全か | **Go（条件付き）** | source 5 件は安全。dist は `anpi-*` のみ + `chat-supabase-config.js` 要否を別判断 |

**No-Go 条件（回避策）:**

- `ai-ops-case-store.js` を ANPI コミットに含めない
- `git add deploy/cloudflare/dist/anpi-*` 以外（live/admin-ai/gateway）を stage しない
- dist 同期後 `chat-supabase-config.js` がビルド出力に含まれるか確認。含まれない場合は Platform/supabase トラックで先に同梱するか、ANPI dist コミット範囲を明示的に拡張するか判断

---

## 6. 推奨コミット単位

### Commit 1 — source

```
feat(anpi): wire platform actor resolver for anpi admin rls
```

**Stage 候補（5）:**

```
anpi-dashboard.html
anpi-line-admin.html
anpi-notifications.html
anpi-register.html
anpi-rls.js
```

### Commit 2 — dist（source コミット + `npm run build:pages` 後）

```
build(anpi): sync Pages dist for anpi auth wiring
```

**Stage 候補（基本 5）:**

```
git add deploy/cloudflare/dist/anpi-*
```

**Stage 前確認:**

- `git diff --cached --name-status` が `deploy/cloudflare/dist/anpi-*` のみであること
- `chat-supabase-config.js` が dist に存在し ANPI ページから参照できること（別トラックなら先に解消）

### 含めないもの

- `ai-ops-case-store.js` / `admin-ai-*` / `admin-operations-dashboard.*`
- `deploy/cloudflare/dist/live/**`
- `ai-model-gateway.js` / `voice-settings.*` / `supabase-ops-*` / `platform-ops-*`
- Builder / Platform / Talk の残差分
- reports / scripts（本棚卸しでは変更なし）

---

## 7. 推奨テスト

**source コミット前後:**

```bash
BASE_URL=http://127.0.0.1:8788 node scripts/test-anpi-rls-production-browser.mjs
BASE_URL=http://127.0.0.1:8788 node scripts/test-anpi-line-admin-browser.mjs
BASE_URL=http://127.0.0.1:8788 node scripts/test-anpi-dashboard-browser.mjs
BASE_URL=http://127.0.0.1:8788 node scripts/test-auth-ops-guard.mjs
```

**dist コミット前後（一括）:**

```bash
BASE_URL=http://127.0.0.1:8788 node scripts/test-anpi-all.mjs
```

**Talk 連携（回帰 · 任意）:**

```bash
BASE_URL=http://127.0.0.1:8788 node scripts/verify-anpi-talk-delivery.mjs
BASE_URL=http://127.0.0.1:8788 node scripts/test-talk-anpi-notify.mjs
```

---

## 8. 注意点

1. **RELEASE FROZEN:** `reports/anpi-release-status.md` 上 ANPI は凍結済み。今回差分は **Critical / Security（NB-1.5 JWT ops 優先）** に該当する認証強化と解釈可能。
2. **テーマの一貫性:** Talk `talk-runtime.js` / Platform 認証と同じ `TasuPlatformActorResolver` + `TasuAuthCurrentUser.isOpsUser` パターン。ANPI 単独でも説明可能。
3. **`anpi-rls.js` が核心:** HTML の script 追加は依存読込。ロジック変更は RLS admin 判定のみ。
4. **`chat-supabase-config.js` dist 欠落:** ANPI 名ではないが、4 つの ANPI HTML が必須参照。dist デプロイ前に要確認。
5. **誤 stage リスク:** ワークツリーに AI秘書・TLV の大量 `M`/`??` が残存。`git add deploy/cloudflare/dist/anpi-*` のみ厳守（AD-007）。

---

## 9. 件数サマリ（報告用）

| # | 区分 | 件数 |
|---|------|------|
| ① | ANPI source | **5** |
| ② | ANPI dist | **5** |
| ③ | test/scripts（変更） | **0** |
| ④ | reports/docs（変更） | **0** |
| ⑤ | 共通基盤・判断不能 | **1 要注意**（`chat-supabase-config.js` dist `??`）+ 他トラック大量（AI秘書/TLV/Gateway 等 · ANPI コミット外） |
