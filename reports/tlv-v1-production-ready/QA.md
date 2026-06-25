# TLV v1.0 — CI / QA ゲート

**基準:** v1.0 Production Ready  
**ルール:** TLV 関連変更時のみ適用 · **全 PASS 必須 · FAIL 時コミット禁止**

運用ルール: [OPERATIONS.md](OPERATIONS.md)

---

## 適用条件

以下いずれかに該当する変更がある場合、本ゲートを実行する。

- `live/**`
- `deploy/cloudflare/dist/live/**`
- `supabase/functions/live-*` / TLV 通知 Edge
- `scripts/test-tlv-*` / `scripts/audit-tlv-*`

TLV 非関連のみの変更では不要。

---

## 必須実行（3 カテゴリ）

### A. Playwright（最終スイート）

```bash
node scripts/test-tlv-prod-guest-check.mjs
node scripts/test-tlv-dev-auth-security.mjs
node scripts/test-tlv-follow-dev-fallback.mjs
node scripts/test-tlv-follow-notify-dev.mjs
node scripts/test-tlv-comment-notify-dev.mjs
node scripts/test-tlv-live-started-notify-dev.mjs
node scripts/test-tlv-video-published-notify-dev.mjs
node scripts/test-tlv-system-notify-dev.mjs
node scripts/test-tlv-channel-audit.mjs
```

**合格:** すべて exit 0 · 有害 console 0

### B. QA（回帰）

```bash
node scripts/test-tlv-channel-content-regression.mjs
node scripts/audit-tlv-pre-release.mjs
```

**合格:**

- channel-content regression: layout チェック PASS · `console:no-harmful-errors` PASS
- pre-release: 有害 console 0（localhost layout/prodFails の既知 non-blocker は [02-qa-release-candidate.md](02-qa-release-candidate.md) 参照）

### C. Production Ready 監査

```bash
node scripts/audit-tlv-production-ready.mjs --base=https://tasufull-article.pages.dev
```

**合格:**

- 有害 console（TLV 起因）0
- dev 漏れチェック PASS（認証後手動確認を推奨）
- Critical 新規なし

**注:** 本番 URL は Cloudflare Access 保護のため、未認証自動監査は TLV 未到達の場合あり。コードレビュー + localhost prod シミュレーション（A）で補完。

---

## v1.0 基準時点の結果（2026-06-25）

| カテゴリ | 結果 |
|---------|------|
| Playwright 9 本 | ✅ 全 PASS |
| channel-content regression | ✅ 62/62 |
| audit-tlv-pre-release | ⚠️ localhost exit 1（既知 non-blocker） |
| audit-tlv-production-ready | CF Access 制約下で実施済み |
| 有害 console | 0 |

詳細: [03-playwright-results.md](03-playwright-results.md)

---

## 変更時の更新義務

Patch リリース時は以下を同一変更セットで更新する。

1. [CHANGELOG.md](CHANGELOG.md) — バージョン・修正内容
2. [VERSION.md](VERSION.md) — 現在バージョン
3. 本ファイル — 「最終実行結果」セクションを追記
4. [03-playwright-results.md](03-playwright-results.md) — 必要時

Artifacts は `artifacts/` に JSON を追記保管可。

---

## 最終実行結果（追記ログ）

| 日付 | バージョン | Playwright | QA | Prod Ready 監査 | 担当 |
|------|-----------|------------|-----|----------------|------|
| 2026-06-25 | v1.0 | 9/9 PASS | 62/62 + pre-release | 実施済み | 初回 Production Ready |
