# Builder AI P1 — Review レポート

実施日: 2026-06-26  
種別: **コード変更なし**（Review のみ）  
参照: `reports/builder-ai-p1.md`, `reports/builder-ai-architecture.md`

---

## Review 判定: **Conditional Go**

P2 実装に進んでよい条件:

1. P2 着手時に **禁止 intent のクライアント拡張**（法的・安全・構造系）を優先タスクに含める
2. 本番 Edge 接続後、**8 action の live 出力品質**を人手または E2E で再確認する
3. MVP ロール解決（localStorage 残留）を本番では JWT / RLS に置き換える計画を維持する

ブロッカーではないが、P1 の設計意図（安全・分離・下書きのみ）は **テストで確認済み**。

---

## 1. UI 確認結果

| 項目 | 結果 | 備考 |
| --- | --- | --- |
| owner / partner / admin / guest 表示 | **PASS** | Playwright 390px · dist サーバー |
| ロールラベル | **PASS** | 依頼元 / 協力会社 / 運営 / ゲスト |
| テンプレート chip 数 | **PASS** | guest=1（FAQ のみ）、他=8 |
| 免責（下書き・最終判断） | **PASS** | `.builder-ai-disclaimer` に明示 |
| コピーボタン | **PASS** | `[data-builder-ai-copy]` 表示 · `navigator.clipboard` |
| URL `?action=` | **PASS** | hidden field + active chip |
| URL `?project_id=` | **PASS** | manual input に反映 |
| TASFUL AI 非混在 | **PASS** | サブタイトル「TASFUL AI とは独立」 |

### 軽微な所見（P2 改善候補）

| 所見 | 影響 |
| --- | --- |
| `project_id` 手入力は guest でも UI 上可能 | 送信時は action / ACL で拒否されるため **安全** |
| URL `project_id` が select 未登録案件でも manual に設定可 | ACL で拒否 · UX 改善余地あり |
| `file://` では clipboard が失敗しうる | 本番 HTTPS では問題なし |
| 履歴は sessionStorage のみ | P2「draft 履歴」と整合 |

### construction-tools 連携

| 項目 | 結果 |
| --- | --- |
| `construction-tools.html` → `builder-ai.html` リンク | **PASS** |
| `builder-ai-adapter.js` 深リンク | **PASS**（コメントパネルに「Builder AI で詳細下書き」） |
| 既存ルール診断 `BuilderAIEngine.analyze()` | **PASS**（変更なし） |

---

## 2. 権限制御確認結果

### Guest

| チェック | 結果 |
| --- | --- |
| FAQ 以外 action 不可 | **PASS**（`isActionAllowed`） |
| 案件コンテキスト不可 | **PASS**（`guest_no_project`） |
| 案件一覧 0 件 | **PASS** |

### Owner（Client）

| チェック | 結果 |
| --- | --- |
| 自 `owner_id` 案件のみ | **PASS** |
| 他社案件拒否 | **PASS**（`owner_scope`） |
| 運営メモ `builder_summary` 非表示 | **PASS** |
| Partner プロフィール秘密非表示 | **PASS** |
| 応募は件数集計のみ（他社詳細なし） | **PASS** |

### Partner

| チェック | 結果 |
| --- | --- |
| 関係案件のみ | **PASS**（applications / selected / calendar） |
| 無関係案件拒否 | **PASS** |
| 自応募状態のみ（他 Partner ID 非露出） | **PASS** |

### Admin

| チェック | 結果 |
| --- | --- |
| 全案件参照可 | **PASS** |
| 運営メモ `builder_summary` 表示 | **PASS**（意図どおり） |
| 確定操作 | **不可**（UI/API なし · 禁止 intent で拒否） |

### ロール解決

- 優先順: URL `?role=` → sessionStorage → localStorage `tasful:builder:mvp:role`
- **リスク:**  stale localStorage で意図しないロール · P2 で JWT 正本化が必要

---

## 3. 禁止 intent 確認結果

### クライアント側ブロック（`detectProhibitedIntent`）— **PASS**

| フレーズ | 結果 |
| --- | --- |
| 採用確定 | **ブロック** |
| 契約成立 | **ブロック** |
| 請求確定 | **ブロック** |
| 支払い指示 | **ブロック** |
| 完了承認 | **ブロック** |

ブロック時: `wrapDraft(PROHIBITED_REPLY)` · Gateway **未呼び出し**

### system prompt のみ（クライアント未ブロック）— **要 P2 強化**

| フレーズ | クライアント | system prompt |
| --- | --- | --- |
| 建築基準法適合の断定 | 未検出 | 禁止明記 ✅ |
| 構造・安全の断定 | 未検出 | 禁止明記 ✅ |
| 法的判断の断定 | 未検出 | 禁止明記 ✅ |

**評価:** LLM 逸脱リスクに対し、P1 は prompt 防御のみ。**P2 最初に regex 拡張を推奨**（最小修正案は §8）。

---

## 4. action 別出力確認

テスト: `scripts/test-builder-ai-p1.mjs` + `scripts/test-builder-ai-p1-review.mjs`（Gateway モック）

| action | 下書きラップ | 出力指示 | Builder 文脈 | 混在なし |
| --- | --- | --- | --- | --- |
| estimate_draft | ✅ | ✅ | ✅ | ✅ |
| schedule_draft | ✅ | ✅ | ✅ | ✅ |
| proposal_draft | ✅ | ✅ | ✅ | ✅ |
| contract_note | ✅ | ✅ | ✅ | ✅ |
| faq_answer | ✅ | ✅ | ✅ | ✅ |
| field_checklist | ✅ | ✅ | ✅ | ✅ |
| delay_response | ✅ | ✅ | ✅ | ✅ |
| daily_report | ✅ | ✅ | ✅ | ✅ |

**共通フォーマット:**

- プレフィックス: `【下書き・確認用】`
- フッター: `※本回答は AI 下書きです。最終判断は運営または当事者が行ってください。`

**live LLM 品質:** 本 Review では **未検証**（モック / fallback 中心）。本番 Edge 接続後の再確認を P2 冒頭に推奨。

**TASFUL AI / TLV / Platform 表現:** action instruction / system prompt に Workspace・TLV 導線なし ✅

---

## 5. 既存サービスへの影響

| サービス | 影響 | 確認方法 |
| --- | --- | --- |
| TASFUL AI Workspace | **なし** | `ai-workspace-chat.js` に `builder_ai` 参照なし |
| AI秘書 | **なし** | `admin-ai-secretary-phase2.js` 未変更 |
| TLV | **なし** | `ai-workspace-tlv-source.js` 未変更 |
| Platform | **なし** | 関連ファイル未変更 |
| TASFUL Talk | **なし** | 関連ファイル未変更 |
| Voice | **なし** | Builder AI は Voice 未使用 |
| Gateway 契約 | **なし** | `ai-model-gateway.js` 未変更 · `completeTurn` シグネチャ維持 |
| AI Core | **なし** | Builder は Caller として Gateway のみ利用 |

Gateway 呼び出し: `surface: "builder_ai"`, `skipSearch: true`, `modeId: "builder_ai"` — 既存 surface との衝突なし ✅

---

## 6. テスト結果

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |
| `node scripts/test-builder-ai-p1.mjs` | **52/52 PASS** |
| `node scripts/test-builder-ai-p1-review.mjs` | **76/76 PASS**（警告 3 件は prompt-only 所見を PASS+note で記録） |

Review スクリプト新規: `scripts/test-builder-ai-p1-review.mjs`

---

## 7. P2 推奨スコープ（優先順）

### P2-A（安全・本番化 — 最優先）

| # | 項目 |
| --- | --- |
| 1 | **禁止 intent regex 拡張**（法規・安全・構造・資格） |
| 2 | **RLS / actor policy** — Supabase + JWT 正本 |
| 3 | **draft 永続化** — `builder_ai_drafts` テーブル + 保存 UI |
| 4 | **live 出力 QA** — 8 action × 主要ロール |

### P2-B（UX・運用）

| # | 項目 |
| --- | --- |
| 5 | draft 履歴（案件単位 / ユーザー単位） |
| 6 | thread への「貼り付け用コピー」導線（自動 POST なし） |
| 7 | project 単位 AI 履歴 |
| 8 | construction-tools **インライン LLM**（深リンクに加え optional） |
| 9 | 管理者監査ログ（action / actor / project / blocked） |

### P2-C（基盤）

| # | 項目 |
| --- | --- |
| 10 | Supabase DDL 接続（`builder_projects` 等） |
| 11 | B3 stub 404 解消（`builder-config.js` 等） |
| 12 | dist E2E smoke 定常化 |

---

## 8. 修正が必要な場合の最小修正案（P2 向け · 今回未実施）

### 8.1 禁止 intent 拡張（`builder-ai-core.js`）

`detectProhibitedIntent` に以下パターンを追加（例）:

```javascript
/法的(?:に)?(?:完全)?(?:適法|違法)|建築基準法|構造(?:上)?(?:安全|不安全)|(?:事故|安全).*(?:断定|保証)|有資格|施工(?:可否|可能)/i
```

命中時は既存 `PROHIBITED_REPLY` または「専門家・有資格者・運営確認が必要」専用文を `wrapDraft` で返す。

### 8.2 ロール正本化

- URL / localStorage デモロールを **読み取り専用フォールバック** に降格
- `auth-current-user.js` / Supabase JWT から actor_type を解決

### 8.3 Guest UI

- guest 時は `project_id` 入力を `readonly` または非表示（多層防御）

---

## 9. 結論

| 観点 | 評価 |
| --- | --- |
| 安全性（確定操作不可） | **良好**（主要 intent ブロック済み） |
| 権限スコープ | **良好**（MVP localStorage 前提） |
| UI / 下書き UX | **良好** |
| 既存サービス分離 | **良好** |
| live 出力 / 法規 intent | **要 P2 強化** |

**P2 開始: 可（Conditional Go）** — §7 P2-A をスプリント先頭に配置すること。
