# TASFUL Materials（無料ダウンロードサービス）— Implementation Readiness

**日付:** 2026-06-28  
**Priority:** **P5 Phase 0 のみ**（Business Directory P4 待機 · Live API P3 が先行）  
**種別:** 現状分析のみ — **コード変更なし**  
**正本:** [free-download-service-backlog.md](../docs/free-download-service-backlog.md) · [free-download-service-plan.md](./free-download-service-plan.md)

---

## Executive summary

| 項目 | 判定 |
| --- | --- |
| **現状** | **設計のみ** — 実装 **未着手** |
| **P4 着手（Phase 0/1 準備）** | **Phase 0 Go · Phase 1 禁止** |
| **MVP 本番公開** | **No-Go**（着手条件未達） |
| **最初の Step** | **Phase 0 — 着手ゲート確定 + 法務/命名** |

`materials/` ディレクトリ · DB migration · Edge · テストスイートは **存在しない**。Platform の「資料 PDF リンク」（`detail-business.js` 等）とは **別サービス**。

---

## 1. 現在の実装状況

### 1.1 コードベース

| 領域 | 状態 |
| --- | --- |
| `materials/` UI | **なし** |
| `download/` surface | **なし** |
| Supabase `materials_*` テーブル | **なし**（migration 未作成） |
| Edge `materials-*` | **なし** |
| Storage バケット `materials-assets` | **なし** |
| npm テストスクリプト | **なし** |
| `index-top.html` 導線 | **なし** |

### 1.2 ドキュメント（完了）

| ファイル | 内容 |
| --- | --- |
| [docs/free-download-service-backlog.md](../docs/free-download-service-backlog.md) | Backlog · MVP カテゴリ · 将来拡張 · 着手条件 |
| [reports/free-download-service-plan.md](./free-download-service-plan.md) | 詳細設計 · P0–P3 機能 · インフラ · ロードマップ |
| [docs/README.md](../docs/README.md) | 「📋 設計のみ」索引 |
| [docs/ROADMAP.md](../docs/ROADMAP.md) | P4 待機後 |

### 1.3 関連既存資産（再利用候補 · 未接続）

| 既存 | Materials との関係 |
| --- | --- |
| Cloudflare Pages `build:pages` | UI 配信パターン流用可 |
| Supabase Auth / Storage / Edge | `listing-images` 等のパターン流用可 |
| `business-directory/` 独立 surface | **参考アーキテクチャ**（別 DB · 別 Edge） |
| AI 秘書 `materials` domain stub | 運営監視 **将来** · MVP 非接続 |
| Platform `materials_url`（掲載者 PDF） | **無関係** — 取引掲載の資料リンク |

### 1.4 テスト · 8788

| 項目 | 状態 |
| --- | --- |
| 専用 unit/E2E | **なし** |
| 8788 regression | **対象ページなし**（実装後に新規スイート作成） |

---

## 2. MVP 範囲

設計正本 [free-download-service-plan.md](./free-download-service-plan.md) §0 · §2 · Phase 1 より。

### 2.1 MVP コア（Phase 1 目標）

| 項目 | 内容 |
| --- | --- |
| **Surface** | `materials/` 独立（Platform / TLV / Builder と **混在しない** · AD-001） |
| **収益** | **無料 + 広告のみ**（Premium/クリエイターは Phase 2+） |
| **カテゴリ（推奨 3）** | **アイコン · 壁紙 · AIプロンプト**（AI 大量生成向き · 法務リスク相対低） |
| **P0 機能** | 検索 · カテゴリ · タグ · 一覧 · 詳細 · プレビュー · DL · ライセンス表示 · 新着 |
| **認証** | 非ログイン DL 可 · お気に入り/履歴は任意ログイン |
| **インフラ** | Cloudflare Pages + Supabase（DB · Auth · Storage） |
| **SNS** | **作らない**（お気に入り/コレクションは素材発見のみ） |

### 2.2 MVP 外（明示）

| 項目 | フェーズ |
| --- | --- |
| 全 8 カテゴリ（BGM · SE · イラスト · テンプレ等） | Phase 2 |
| AI バッチ生成パイプライン | Phase 3 |
| Premium · クリエイター販売 · サブスク | Phase 4+ |
| ブラウザゲーム surface | Backlog · 別 surface |
| テンプレ拡張（名刺 · Office · PDF） | 需要ゲート後 |
| TASFUL AI Workspace 統合 | **別判断**（AD-002/005） |
| Builder 統合編集 | Phase 後 |

---

## 3. 未実装

### 3.1 実装フェーズ（plan §10）

| Phase | 内容 | 状態 |
| --- | --- | --- |
| **0** | 設計 · Backlog · 法務チェックリスト | ✅ 設計 doc 完了 · 法務 checklist **未作成** |
| **1** | MVP UI + 3 カテゴリ + Supabase + 500 点投入 | ❌ 未着手 |
| **2** | 8 カテゴリ + 広告 + お気に入り/履歴 | ❌ |
| **3** | AI 生成パイプライン + 重複/品質 | ❌ |
| **4** | Premium + クリエイター β | ❌ |
| **5** | R2 移行 · 4K/大容量 | ❌ 需要トリガー |

### 3.2 P0 機能（すべて未実装）

検索 · カテゴリ · タグ · 素材詳細 · プレビュー · ダウンロード · ライセンス表示 · 新着 · 任意認証

### 3.3 着手条件（backlog §着手条件 — 未達）

- [ ] P0 working tree 整理 · 既存製品本番タスクがブロックしない
- [ ] サービス名 · ドメイン · 法務（素材ライセンス表示）の確定
- [ ] MVP カテゴリ 2〜3 種で PoC 方針確定
- [ ] 広告 SDK 方針（AdSense / 自社枠）の決定

---

## 4. 本番 blocker

MVP **ローンチ前** blocker（技術 + 運用 + 判断）。

| # | Blocker | 種別 | 備考 |
| --- | --- | --- | --- |
| B1 | **実装未着手**（UI/DB/Edge/Storage ゼロ） | Code | Phase 1 前提 |
| B2 | **サービス名 · URL パス未確定** | Human Decision | `materials/` vs `download/` |
| B3 | **法務** — ライセンス表示 · 利用規約 · AI生成明示 · 商用可否 | Legal | plan §11 |
| B4 | **広告 SDK 方針未決** | Human Decision | AdSense 等 · COPPA/UX（AD-012） |
| B5 | **初期コンテンツ** — 500 点投入計画 | Ops | 手動/CSV/バッチ |
| B6 | **着手条件** — working tree / 優先リソース | Process | backlog §着手条件 |
| B7 | **ストレージ/egress 監視設計** | Ops | MVP は Supabase · 上限監視 |
| B8 | **既存製品スコープ分離** | Architecture | Platform 取引 DB 混在禁止 |

**BD 型 OB とは独立** — Materials は新規 surface のため Commercial Launch ゲートは **別途** 定義（Phase 1 完了後）。

---

## 5. 実装順序（推奨）

```text
Phase 0  着手ゲート（人間 + Docs · コード最小）
  0a. サービス名 · パス `materials/` 確定
  0b. 法務チェックリスト · ライセンス表テンプレ
  0c. 広告 SDK 方針 · MVP カテゴリ 3 種確定
  0d. データモデル migration 設計レビュー（plan §9）

Phase 1  MVP Core（初回実装）
  1a. DB migration `materials` + RLS + seed カテゴリ
  1b. Storage バケット + アップロード/公開ポリシー
  1c. Edge: list · detail · download count · search（最小）
  1d. UI: 検索 · 一覧 · 詳細 · プレビュー · DL · ライセンス
  1e. 手動/CSV 初期素材 500 点投入
  1f. テスト: schema · API · UI mock · 8788 smoke

Phase 2  体験 + 収益基盤
  2a. フィルター · ソート · お気に入り · 履歴 · 人気
  2b. 広告枠（一覧/詳細/DL前）
  2c. 残り MVP カテゴリ（BGM · SE · テンプレ等）

Phase 3  AI パイプライン（Gateway surface 分離 · AD-005）
Phase 4+ Premium / クリエイター / R2 移行（需要トリガー）
```

**BD / Live Platform / TLV には依存しない。** Builder/Platform 統合は **導線のみ** · Phase 2 以降。

---

## 6. Go / No-Go

| 判断 | 結果 | 根拠 |
| --- | --- | --- |
| **P4 現状分析 · Phase 0 着手** | **Go** | 設計完備 · リソース移行承認 · 新規 surface で既存凍結領域非接触 |
| **Phase 1 実装開始** | **No-Go** | Phase 0 のみ維持 · 人間 Go 前 |
| **MVP 本番公開** | **No-Go** | B1–B8 未解消 · 実装ゼロ |
| **Business Directory 再開** | **No-Go** | 待機 · OB1–OB8 + 明示 Launch Go まで |

---

## 7. 最初に着手すべき Step

### **Phase 0a — 着手ゲート確定**（コード変更前 · 人間判断中心）

| # | タスク | 担当 | Cursor |
| --- | --- | --- | --- |
| 1 | サービス名 **TASFUL Materials** / パス `materials/` の Go | PO | 比較表草案可 |
| 2 | MVP カテゴリ 3 種（アイコン/壁紙/AIプロンプト）確定 | PO | — |
| 3 | 法務チェックリスト初版（ライセンス · AI生成 · 商用） | 法務+PO | **可**（差分表） |
| 4 | 広告 SDK 方針（AdSense 等） | PO+Ops | チェックリスト可 |

### **Phase 0b — 設計凍結**（Cursor 可 · 実装前）

| # | タスク | 成果物 |
| --- | --- | --- |
| 5 | データモデル migration **設計 doc**（plan §9 展開） | `docs/materials-data-model-design.md`（承認後） |
| 6 | Phase 1 ファイル構成 · load order 案 | readiness 付録 or plan 追記 |
| 7 | Phase 1 テスト計画（schema · API · 8788） | `scripts/test-materials-phase1-*.mjs` 雛形 |

### **Phase 1 最初のコード**（0a–0b Go 後）

1. `supabase/migrations/*_materials_phase1_schema.sql`
2. `materials/` — `index.html` · `list.html` · `detail.html` · `materials-public.js`
3. `supabase/functions/materials/` — list · detail · download
4. `scripts/test-materials-phase1-schema.mjs`

---

## 付録: Business Directory との優先関係

| サービス | 状態 | Cursor 継続可能 |
| --- | --- | --- |
| **Business Directory** | MVP-1/3 Complete · Launch Gate Prep Complete · **待機** | Docs · 8788 regression · bugfix のみ |
| **TASFUL Materials（P4）** | 設計のみ | Phase 0 → Phase 1 新規実装 |

---

## 参照

- [free-download-service-backlog.md](../docs/free-download-service-backlog.md)
- [free-download-service-plan.md](./free-download-service-plan.md)
- [business-directory-launch-gate-prep.md](./business-directory-launch-gate-prep.md)
- [docs/DECISIONS.md](../docs/DECISIONS.md) AD-011 · AD-012
- [docs/ROADMAP.md](../docs/ROADMAP.md)
