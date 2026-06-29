# TASFUL プロジェクトステータス

**最終更新:** 2026-06-29  
**Git HEAD:** `f4cf7d8`（参照時点）  
**開発優先:** **P3 Live API（ZEGO Provider）** · Business Directory **待機** · Materials **Phase 0** · TLV = **Pause**

---

## 直近コミット（status 同期対象）

| SHA | 内容 | dist 同期 |
| --- | --- | --- |
| `2ba6d6c` | TLV T1/T2/T4 — watch URL · creator-dashboard non-fatal · main-flow smoke | ソースのみ（TLV `live/`） |
| `ee2efea` | Design Audit A/D/C polish — 公開面 UI · TLV console 整理 | **未同期**（`build:pages` 別バンドル） |
| `0857c22` | Builder 条件検索 P0/P1 — repository · UI adapter | ソースのみ |
| `b80d868` | Builder 条件検索 dist ミラー | **同期済**（`deploy/cloudflare/dist/builder/*`） |
| `f4cf7d8` | TASFUL AI P1 — Media Edge · Voice Guard · Monitoring | **同期済**（media 3 ファイル dist） |

---

## 製品別サマリー

| 領域 | ステータス | 備考 |
| --- | --- | --- |
| **Builder** | **Production Ready** | v1.0 · RELEASE FROZEN（`reports/builder-release-status.md`） |
| **Builder 条件検索** | **P0/P1 Complete** | `0857c22` · `b80d868` · P2 LLM = Future |
| **Builder AI** | **実装済み** | コミット `5ed9672`。TASFUL AI と**統合しない** |
| **Platform** | **Production Ready** | NB-1M 系スモーク PASS 記録あり。FE 本番昇格・一部 AI 仕上げは残タスク |
| **Platform Live Phase 5** | **Complete** | P5-1〜P5-9 · `798d4a5`〜`9006ead` |
| **Platform AI** | **入口接続済** | 専用 AI エンジンなし · TASFUL AI 利用 |
| **TLV** | **v1.0 FROZEN · Payment Phase 1 運用ゲート待ち** | T1/T2/T4 Done `2ba6d6c` · TLV 固有 Phase 2 禁止 |
| **TLV AI** | **導線のみ** | TLV 専用 AI なし · `live/tlv-tasful-ai-entry.js` → Workspace |
| **AI 秘書** | **Production Ready** | RELEASE FROZEN（`reports/ai-ops-secretary-release-status.md`） |
| **TASFUL AI** | **P1 Complete** | `f4cf7d8` · Media · Monitoring · Voice P2 · [p1 report](../reports/tasful-ai-p1-implementation.md) |
| **Live Platform（共通）** | **P2 Core Complete** | Phase A–F · [summary](../reports/platform-live-platform-summary.md) |
| **Live API（ZEGO）** | **Phase 1 Go** | Adapter 実装 · [phase1](../reports/live-platform-zego-adapter-phase1.md) · 77 tests PASS |
| **Business Directory** | **待機** · Launch Gate Prep Complete | Commercial Launch **No-Go** |
| **TASFUL Materials（P5）** | **Phase 0** | 設計のみ · 実装未着手 |
| **Design Audit Polish** | **Done**（ソース） | `ee2efea` · dist は別バンドル |

---

## Working tree（`f4cf7d8` 以降）

| 区分 | 件数（概算） |
| --- | --- |
| **合計** | **~300** |
| 主な残件 | dist 未同期（Design Audit 等）· reports/scratch JSON · Live/Zego 別バンドル · Builder 6-H 未コミット |

**分類:** Future / 別バンドル / reports / scratch — 詳細 [TODO.md](./TODO.md) · [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)

**dist 同期済（HEAD まで）:** TASFUL AI media 3 ファイル（`f4cf7d8`）· Builder 条件検索（`b80d868`）· Platform Live 一部（`9006ead` の `live-broadcasts` 等）

**dist 未同期（代表）:** Design Audit polish（`ee2efea`）· 広範な `deploy/cloudflare/dist/` 変更 · wrangler build 後の全体ミラー

---

## テスト基準（代表）

```bash
npm run build:pages
node scripts/test-tasful-ai-final-phase.mjs            # 31/31
node scripts/verify-tasful-ai-monitoring.mjs           # Media flake 時 6/7（KI-014）
node scripts/verify-tlv-finish-main-flow-smoke.mjs     # TLV T1/T2/T4
node scripts/verify-design-audit-polish-smoke.mjs      # Design Audit
node scripts/test-builder-conditional-search-p0.mjs
node scripts/test-builder-conditional-search-p1.mjs
```

---

## 関連ドキュメント

- 次タスク → [TODO.md](./TODO.md)
- 方針 → [DECISIONS.md](./DECISIONS.md)
- 未解決 → [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
