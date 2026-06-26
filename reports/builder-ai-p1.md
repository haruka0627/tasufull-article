# Builder AI P1 — 実装レポート

実施日: 2026-06-26  
フェーズ: **P1（最小実装）** — ドラフト生成・相談回答のみ  
設計参照: `reports/builder-ai-architecture.md`

---

## 1. 実装内容

Builder 専用 AI を **TASFUL AI とは独立** したモジュール群として追加しました。

| コンポーネント | 役割 |
| --- | --- |
| `builder-ai-core.js` | Gateway ラッパー、`surface: "builder_ai"`、`skipSearch: true`、下書きラップ |
| `builder-ai-actions.js` | 8 業務アクション定義・プロンプト |
| `builder-ai-context.js` | MVP 案件コンテキスト要約・actor 別アクセス制御 |
| `builder-ai-tools.js` | 建設ツール → アクション マップ |
| `builder-ai-tool-router.js` | ツール計算結果から Core 実行 |
| `builder-ai-adapter.js` | 深リンク生成・コメントパネルへ「詳細下書き」リンク |
| `builder-ai-page.js` | 独立 UI ロジック |
| `builder-ai.html` | Builder AI 独立ページ |

**実行系は未実装:** 採用・契約・請求・完了承認・支払指示はコード上ブロック（禁止 intent 検出 + system prompt）。

---

## 2. 変更ファイル

### 新規

| ファイル |
| --- |
| `builder/builder-ai-core.js` |
| `builder/builder-ai-actions.js` |
| `builder/builder-ai-context.js` |
| `builder/builder-ai-tools.js` |
| `builder/builder-ai-tool-router.js` |
| `builder/builder-ai-adapter.js` |
| `builder/builder-ai-page.js` |
| `builder/builder-ai.html` |
| `scripts/test-builder-ai-p1.mjs` |
| `reports/builder-ai-p1.md` |

### 更新（入口・スタイル・リンク）

| ファイル | 内容 |
| --- | --- |
| `builder/index.html` | Builder AI クイックカード追加 |
| `builder/construction-tools.html` | `builder-ai.html` へのリンク |
| `builder/builder.css` | Builder AI ページ・深リンク用スタイル |

### 変更なし（契約維持）

| ファイル |
| --- |
| `ai-model-gateway.js` |
| `ai-workspace-chat.js` |
| `admin-ai-secretary-phase2.js` |
| `ai-workspace-tlv-source.js` |
| `builder/builder-ai-engine.js`（ルールベース `analyze()` は維持） |

---

## 3. 対応 action（8 種）

| action | 用途 | 案件必須 |
| --- | --- | --- |
| `estimate_draft` | 見積たたき台 | ✅ |
| `schedule_draft` | 工程たたき台 | ✅ |
| `proposal_draft` | 提案文 | ✅ |
| `contract_note` | 契約前確認メモ | ✅ |
| `faq_answer` | Builder FAQ | ❌ |
| `field_checklist` | 現場チェックリスト | ✅ |
| `delay_response` | 工程遅延文案 | ✅ |
| `daily_report` | 作業日報たたき台 | ✅ |

すべての応答は `【下書き・確認用】` プレフィックス + 免責フッター付き。

---

## 4. 権限制御

| actor_type | できること | 制限 |
| --- | --- | --- |
| **guest** | `faq_answer` のみ | 案件コンテキスト不可 |
| **owner** (Client) | 自 `owner_id` 案件のアクション | 他社案件・Partner 内部不可 |
| **partner** | 応募/採用/割当案件 | 無関係案件・依頼元機密不可 |
| **admin** | 全案件参照 + 下書き | 確定操作不可（禁止 intent） |

ロール解決: `?role=` / `localStorage.tasful:builder:mvp:role` / sessionStorage。

---

## 5. Gateway 接続方針

```javascript
await TasuAiModelGateway.completeTurn({
  userText: messageForAi,
  modeId: "builder_ai",
  systemPrompt: /* Builder 専用 */,
  skipSearch: true,
  surface: "builder_ai",
  modelId: "gemini-flash",
  mockFallback: () => wrapDraft(/* モック */),
});
```

- **新 Gateway なし** — 既存 Edge（gemini-chat 等）を利用
- Gateway 本体は変更なし（`surface` はログ識別のみ）
- TASFUL AI Workspace / AI秘書とは別 surface

---

## 6. UI

| 項目 | 実装 |
| --- | --- |
| 入口 | `builder/builder-ai.html`、ダッシュボード・建設ツールからリンク |
| チャット | テキスト入力 + 履歴（sessionStorage） |
| テンプレート | actor 別アクションチップ |
| 案件 | セレクト + `project_id` 手入力 |
| コピー | 直近 assistant 回答 |
| 注意書き | ページ上部に下書き免責 |

建設ツール: 既存 `data-builder-ai-comment` パネルは維持。`builder-ai-adapter.js` が「Builder AI で詳細下書き」リンクを追加（ルール診断は従来どおり）。

---

## 7. テスト結果

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |
| `node scripts/test-builder-ai-p1.mjs` | **51/51 PASS** |

### P1 テスト内訳

| 区分 | 内容 | 結果 |
| --- | --- | --- |
| 静的隔離 | TASFUL AI / 秘書 / TLV ファイル未変更 | PASS |
| Actions | 8 action 定義 | PASS |
| 権限 | guest / owner / partner / admin | PASS |
| Gateway mock | `surface`, `skipSearch`, `modeId` | PASS |
| 禁止 intent | 採用確定文言 | PASS |
| Draft | 全 action 下書きラップ | PASS |

### 回帰

| コマンド | 結果 | 備考 |
| --- | --- | --- |
| `node scripts/test-builder-construction-tools-ai-engine-browser.mjs` | **PARTIAL FAIL** | `builder-config.js` 等 B3 スタブ未コミットによる `ERR_FILE_NOT_FOUND`（P1 以前から HTML 参照のみ）。**BuilderAIEngine 診断・計算自体は PASS** |

---

## 8. 既存サービスへの影響

| サービス | 影響 |
| --- | --- |
| TASFUL AI Workspace | **なし** |
| Platform / TLV / Talk | **なし** |
| AI秘書 | **なし** |
| Gateway / AI Core 契約 | **なし**（呼び出し側のみ追加） |
| Builder 建設ツール診断 | **なし**（`analyze()` 不変、深リンク追加のみ） |

---

## 9. 未対応事項（P1 スコープ外）

- Supabase RLS / サーバー側 usage カウンタ
- `builder_ai_drafts` 永続テーブル
- スレッドへの自動 POST
- 建設ツールパネル内のインライン LLM 応答（深リンクのみ）
- B3 レイヤー stub ファイル群（`builder-config.js` 等）の整備
- Voice / 添付 PDF 解析
- Builder 専用課金

---

## 10. P2 でやること

1. **ドラフト永続化** — `builder_ai_drafts` + 保存 UI
2. **案件コンテキスト強化** — thread 要約・ツール payload 自動注入
3. **B3 リポジトリ接続** — Supabase 移行後の正本参照
4. **インライン強化** — ツールパネルからワンクリック `enhanceFromCalculation`
5. **RLS / JWT** — 本番 actor 正本
6. **E2E** — dist サーバー上の `builder-ai.html` Playwright smoke
7. **B3 stub 整理** — 404 解消と construction-tools ブラウザテスト完全 PASS

---

## 11. 利用方法（開発）

```text
builder/builder-ai.html?role=owner
builder/builder-ai.html?role=partner&partnerId=demo-partner-001
builder/builder-ai.html?action=estimate_draft&project_id=demo-project-001
```

MVP データは `localStorage.tasful:builder:mvp:v1` にシード済みの環境で案件選択が有効です。
