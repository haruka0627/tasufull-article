# TLV v1.0 — Playwright 最終結果

**実施日:** 2026-06-25  
**環境:** `http://127.0.0.1:8788/live`（wrangler pages dev）  
**判定:** 全 PASS

---

## 最終スイート（9/9 exit 0）

| # | スクリプト | 用途 | Exit |
|---|-----------|------|------|
| 1 | `scripts/test-tlv-prod-guest-check.mjs` | 本番ゲスト・dev 漏れシミュレーション | ✅ 0 |
| 2 | `scripts/test-tlv-dev-auth-security.mjs` | dev auth 境界・hostname ガード | ✅ 0 |
| 3 | `scripts/test-tlv-follow-dev-fallback.mjs` | フォロー永続化・ゲスト | ✅ 0 |
| 4 | `scripts/test-tlv-follow-notify-dev.mjs` | `follow_created` 通知 | ✅ 0 |
| 5 | `scripts/test-tlv-comment-notify-dev.mjs` | `comment_created` 通知 | ✅ 0 |
| 6 | `scripts/test-tlv-live-started-notify-dev.mjs` | `live_started` 通知 | ✅ 0 |
| 7 | `scripts/test-tlv-video-published-notify-dev.mjs` | `video_published` 通知 | ✅ 0 |
| 8 | `scripts/test-tlv-system-notify-dev.mjs` | `system` 通知（ops gate） | ✅ 0 |
| 9 | `scripts/test-tlv-channel-audit.mjs` | チャンネル導線・プロフィール | ✅ 0 |

---

## 追加回帰（P2 時点）

| スクリプト | 結果 |
|-----------|------|
| `scripts/test-tlv-channel-content-regression.mjs` | **62/62 PASS** |
| `scripts/audit-tlv-pre-release.mjs` | exit 1（localhost 既知 false positive） |

---

## Console

| スイート | 有害 console |
|---------|-------------|
| 通知 5 種 + follow + channel audit | **0** |
| channel-content regression | **0**（benign localhost は分類除外） |

---

## 再実行コマンド

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

---

## Artifacts

- `artifacts/channel-content-regression-report.json`
- `artifacts/pre-release-audit-report.json`
