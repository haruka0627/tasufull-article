# TLV v1.0 — 運用ルール（確定）

**基準バージョン:** `v1.0` Production Ready  
**確定日:** 2026-06-25  
**状態:** Feature Frozen · 本ドキュメントが TLV 運用の正式ルール

`reports/` 配下の監査資料を TLV の **正式監査資料** として扱う。  
コード変更なしで運用ルールのみ確定する。

---

## 1. 変更禁止（TLV スコープ）

以下は **一切禁止**。

| カテゴリ | 内容 |
|---------|------|
| 新機能追加 | 画面・API・通知種別の追加など |
| UI 変更 | 文言・色・コンポーネント・導線の変更 |
| レイアウト変更 | グリッド・余白・構造の変更 |
| CSS 調整 | `live.css` および TLV 関連スタイルの調整 |
| リファクタリング | 挙動不変の整理・rename・構造変更も含む |

### スコープ

- `live/**`
- `deploy/cloudflare/dist/live/**`
- `supabase/functions/live-*` および TLV 通知 Edge
- TLV 向け `scripts/test-tlv-*` / `scripts/audit-tlv-*`（回帰・監査の更新は許可）

---

## 2. 許可される修正

**以下のみ**修正可能。

| 種別 | 例 |
|------|-----|
| **Critical Bug** | 本番再現のクラッシュ、データ破損、通知未達、白画面 |
| **Security** | 認証バイパス、dev 漏れ、JWT/RLS/Edge 不備 |
| **Production 障害** | 配信不能、Edge 5xx、Pages 404、本番データ不整合 |

上記に該当しない変更は **コミット禁止**。

---

## 3. バージョン管理

| ルール | 内容 |
|--------|------|
| **基準** | `v1.0` = Production Ready 時点のスナップショット |
| **Patch** | Critical / Security / Production 修正 → `v1.0.1`, `v1.0.2`, … |
| **Minor** | 機能追加・UI/レイアウト/CSS 変更 → **`v1.1` 以降のみ** |

Patch では **挙動修正のみ**。見た目・構造・新機能は Patch に含めない。

詳細: [VERSION.md](VERSION.md) · 履歴: [CHANGELOG.md](CHANGELOG.md)

---

## 4. CI / QA ゲート

**TLV 関連ファイルを変更した場合のみ**、コミット前に以下を **すべて PASS** 必須。

詳細手順: [QA.md](QA.md)

| 必須 | 内容 |
|------|------|
| Playwright | `scripts/test-tlv-*.mjs` 最終スイート |
| QA | `scripts/audit-tlv-pre-release.mjs` および channel-content 回帰 |
| Production Ready 監査 | `scripts/audit-tlv-production-ready.mjs` |

**いずれか FAIL → コミット禁止。**

TLV 非関連の変更のみのコミットでは本ゲートは不要。

---

## 5. 変更時のドキュメント更新（必須）

TLV を変更して Patch を切る場合、**同一 PR / コミット**で以下を更新する。

| ドキュメント | パス | 更新内容 |
|-------------|------|---------|
| CHANGELOG | [CHANGELOG.md](CHANGELOG.md) | バージョン・変更理由・分類（Critical/Security/Production） |
| VERSION | [VERSION.md](VERSION.md) | 現在バージョン・日付 |
| QA | [QA.md](QA.md) | 実行日・結果サマリー（該当セクション） |
| Playwright | [03-playwright-results.md](03-playwright-results.md) | 全 PASS 記録（変更時） |

必要に応じて `reports/tlv-release-status.md` のサマリーを更新。

---

## 6. 正式監査資料一覧

| 資料 | パス |
|------|------|
| 運用ルール（本書） | [OPERATIONS.md](OPERATIONS.md) |
| リリース確定 | [../tlv-release-status.md](../tlv-release-status.md) |
| Production Ready | [01-production-ready.md](01-production-ready.md) |
| QA / RC | [02-qa-release-candidate.md](02-qa-release-candidate.md) |
| Playwright | [03-playwright-results.md](03-playwright-results.md) |
| Security | [04-security.md](04-security.md) |
| CI/QA ゲート | [QA.md](QA.md) |
| CHANGELOG | [CHANGELOG.md](CHANGELOG.md) |
| VERSION | [VERSION.md](VERSION.md) |
| Artifacts | [artifacts/](artifacts/) |

---

## 7. エスカレーション

| 状況 | 対応 |
|------|------|
| Patch で直せない UI/機能要望 | v1.1 バックログへ。v1.0 では実装しない |
| QA FAIL が localhost 既知 issue | [02-qa-release-candidate.md](02-qa-release-candidate.md) の non-blocker を参照。新規 FAIL はブロック |
| 本番のみ再現 | Production 障害として Patch。監査 JSON を artifacts に追記 |
