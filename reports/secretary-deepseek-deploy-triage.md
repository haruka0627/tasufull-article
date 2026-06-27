# AI 秘書 DeepSeek — Production Deploy 前 Triage

**実施日:** 2026-06-26  
**状態:** triage のみ · **deploy 未実施 · commit 未実施**  
**対象コミット:**

| 順序（古→新） | Hash | Message |
| --- | --- | --- |
| 1 | `840a574` | feat(secretary): inject ops context into deepseek chat |
| 2 | `6c70985` | feat(secretary): add deepseek adapter via pages function |

**HEAD:** `6c70985`（`cf-pages-deploy` · `origin/cf-pages-deploy` より **ahead 4**）

---

## 1. HEAD と commit 順序

```
6c70985 feat(secretary): add deepseek adapter via pages function   ← HEAD
840a574 feat(secretary): inject ops context into deepseek chat
84f457c docs(tasful-ai): mark workspace enforcement phase1 deployed
2a43fe5 feat(tasful-ai): enforce workspace usage phase1
3b030ab build(site): sync Pages dist for tasful notification settings
```

- `840a574` · `6c70985` はいずれも HEAD の祖先 ✓
- **コミット順:** Phase 2（OpsContext）→ Phase 1（Adapter）の順で積まれている（HTML は Phase 2 時点で adapter script タグ済み · JS 本体は Phase 1 で追加）
- **push 未反映:** 上記 4 commit が remote 未 push（secretary 2 + tasful-ai workspace 2）

---

## 2. Production 差分 — 2 コミットで足りるか

### 秘書 DeepSeek + OpsContext 機能として

| 領域 | 840a574 | 6c70985 | HEAD で完結 |
| --- | --- | --- | --- |
| OpsContextBuilder / PII / phase2 注入 | ✓ | — | ✓ |
| DeepSeek Adapter クライアント | script タグのみ | ✓ | ✓ |
| Pages Function `/api/secretary-deepseek-chat` | — | ✓ | ✓ |
| `dist/functions/**` 同期 | — | ✓ | ✓ |
| dev/build パイプライン | — | ✓ | ✓ |
| ブラウザテスト | ✓ | — | ✓ |
| Gateway / `ai-model-gateway.js` | 非変更 | 非変更 | ✓ |

**判定:** 秘書機能の **コード・dist 成果物は 2 コミット合わせて HEAD に完結**。追加の secretary コミットは不要。

### 注意 — ブランチスコープ

`cf-pages-deploy` の push 差分は **secretary 2 件のみではない**（tasful-ai workspace `2a43fe5` · `84f457c` を含む）。  
**secretary だけ**を Production に載せる場合は cherry-pick / 部分 deploy 方針の確認が必要。

### HEAD 外（runtime 非必須 · 任意）

- `docs/TODO.md` 等の正本更新 — 2 コミットに未含む（deploy ブロッカーではない）
- working tree **124 件**の未コミット変更 — **deploy 対象に含めない**（HEAD + clean build を正とする）

---

## 3. root ↔ dist 同期（2026-06-26 再 build 後）

`npm run build:pages` — **PASS**（dev/workerd 停止後）

| ファイル | root ↔ dist |
| --- | --- |
| `admin-ai-secretary-deepseek-adapter.js` | OK |
| `admin-ai-secretary-ops-context-sanitize.js` | OK |
| `admin-ai-secretary-ops-context.js` | OK |
| `admin-ai-secretary-phase2.js` | OK |
| `.env.example` | OK |
| `functions/api/secretary-deepseek-chat.js` | OK（source ↔ dist） |
| `functions/_shared/secretary-deepseek.mjs` | OK |
| `admin-operations-dashboard.html` | hash 差あり（**build が meta robots 等を注入 · 正常**） |
| `talk-ops-room.html` | 同上 |

- build 後、secretary 関連 **dist JS / functions** は **HEAD と diff なし** ✓
- dist HTML に script 3 本（sanitize · ops-context · deepseek-adapter）+ phase2 以降 **確認済** ✓

---

## 4. シークレット / API キー

| 確認 | 結果 |
| --- | --- |
| `.env` git 追跡 | **なし**（`.gitignore`） |
| `.dev.vars` git 追跡 | **なし** |
| working tree `sk-...` パターン | **なし** |
| `840a574` / `6c70985` 内 `sk-...` | **なし** |
| `6c70985:.env.example` | `DEEPSEEK_API_KEY=`（**空**） |

**判定:** コミット・working tree に **実 API キーは含まれない** ✓

---

## 5. Cloudflare Pages Production Secret

| Secret | 状態 |
| --- | --- |
| **`DEEPSEEK_API_KEY`** | **未登録（未確認）** — リポジトリ / ローカル triage から CF Dashboard 登録は確認できず。Phase 1 報告どおり **Production Secret 未設定想定** |

**deploy 前必須:** Cloudflare Pages **Production** 環境に `DEEPSEEK_API_KEY`（Encrypted）を登録すること。

---

## 6. DeepSeek 実 API 応答

| 項目 | 状態 |
| --- | --- |
| ローカル到達 | `configured:true` まで確認済 |
| HTTP **200** · `usedDeepSeek:true` · assistant text | **未確認** |
| 理由 | DeepSeek **残高不足**（502 `Insufficient Balance`） |
| 未設定時 fallback | 503 → モック · 画面クラッシュなし ✓ |

**判定:** Production cutover 前に **残高チャージ + 200 応答 smoke** が必要。

---

## 7. Go / No-Go 判定

### A. 成果物準備（コード · dist · セキュリティ）

| 項目 | 判定 |
| --- | --- |
| 2 コミットで secretary 機能完結 | **Go** |
| dist / functions 同期 | **Go** |
| キー非含有 | **Go** |
| Gateway 非変更 | **Go** |
| ブラウザ回帰（過去実行） | **Go**（12/12 · 8/8 · E2E 11/11） |

### B. Production Deploy（本番反映）

| 項目 | 判定 |
| --- | --- |
| `DEEPSEEK_API_KEY` Production Secret | **No-Go**（未登録想定） |
| DeepSeek 残高 · HTTP 200 | **No-Go**（未確認） |
| Production smoke | **No-Go**（未実施） |
| remote push / CI | **No-Go**（ahead 4 · 未 push） |
| ブランチ混在（tasful-ai 2 commit） | **要確認** — secretary のみならスコープ整理 |

### 総合

| | |
| --- | --- |
| **Production Deploy** | **No-Go** |
| **理由** | Secret 未登録 · 200 未確認 · smoke 未実施 · push/スコープ未整理 |
| **Artifact readiness** | **Go** — HEAD + `build:pages` で deploy 可能な状態 |

---

## Deploy 前チェックリスト（実施順）

1. [ ] `cf-pages-deploy` push（または secretary のみの deploy 方針確定）
2. [ ] Cloudflare Pages Production **`DEEPSEEK_API_KEY`** 登録
3. [ ] DeepSeek **残高チャージ**
4. [ ] Staging / Production で POST `/api/secretary-deepseek-chat` → **200** · `usedDeepSeek:true`
5. [ ] admin-operations-dashboard AI 秘書 1 往復 smoke（運営コンテキスト付き）
6. [ ] `npm run build:pages`（clean · dev 停止後）→ dist deploy

---

## 参照

- `reports/secretary-deepseek-adapter-phase1.md`
- `reports/secretary-ops-context-builder-phase2.md`
- `docs/AI/SECRETARY_AI.md`
- AD-009（静的配信 `deploy/cloudflare/dist`）· AD-010（秘書 DeepSeek 独立）
