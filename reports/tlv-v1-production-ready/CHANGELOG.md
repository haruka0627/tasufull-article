# TLV CHANGELOG

形式は [Keep a Changelog](https://keepachangelog.com/) に準拠。  
バージョン方針は [VERSION.md](VERSION.md) を参照。

---

## [v1.0] — 2026-06-25

### Production Ready · Feature Freeze

基準バージョン。以降の Patch は本リリースを基準とする。

#### Added（リリースまでの成果・v1.0 スコープ）

- 通知 5 種（follow_created, comment_created, live_started, video_published, system）
- P0/P1 品質修正（demo 本番漏れ対策、watch-live null 耐性、system ops/admin 制限）
- P2 品質仕上げ（title 文字化け修正、benign console 分類）
- Production Ready / Release Candidate 監査完了
- 正式監査資料 `reports/tlv-v1-production-ready/`

#### Security

- `live-notify` Edge: system 通知 ops/admin 制限（P1-2）
- `tlv-dev-auth.js`: localhost 限定 demo / fallback

#### QA

- Playwright 最終スイート 9/9 PASS
- channel-content regression 62/62 PASS
- 有害 console 0

---

## [Unreleased]

（v1.0.1 以降の Patch はここに追記し、リリース時にバージョン見出しへ移動）

### 記載テンプレート（Patch 時）

```markdown
## [v1.0.x] — YYYY-MM-DD

### Fixed
- （Critical Bug / Production 障害の説明）

### Security
- （該当時のみ）

### QA
- Playwright: PASS
- audit-tlv-pre-release: （結果）
- audit-tlv-production-ready: （結果）
```
