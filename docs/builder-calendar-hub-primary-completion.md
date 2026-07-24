# Builder Calendar — Hub Primary 完了レポート（CAL-MAIN-19）

**日付:** 2026-07-04  
**判定:** **Hub Primary 完了（Go）**  
**性質:** 最終監査 · 整理 · 完了判定（大規模実装なし）

---

## 1. 結論

Builder Calendar の **assignment 領域**について、Hub を Write / Read / Hydrate の正本とするフェーズ（CAL-MAIN-10〜18）は完了した。

| 層 | 正本 | 備考 |
| --- | --- | --- |
| **Write** | Hub local `assignment` → DB `assignment` jsonb（成功時） | MVP `assignment_status` は DB 失敗時のみ（CAL-MAIN-17） |
| **Read（本線表示）** | Hub `assignment.status` | MVP は fallback（CAL-MAIN-18） |
| **Hydrate** | DB assignment 優先 · 無ければ local 維持 | CAL-MAIN-13 |
| **Realtime** | 変更時 `hydrateFromSupabase` → 上記 merge | CAL-MAIN-04 |

MVP / localStorage の **削除はしない**（意図的に fallback · demo · admin · 互換として残置）。

---

## 2. Hub assignment 利用状況（最終監査）

| 観点 | 状態 | 根拠 |
| --- | --- | --- |
| **Read 最優先** | ✅ | `readHubAssignmentStatus` → `resolveCalendarAssignmentStatus`（Hub → live MVP → 埋め込み） |
| **Write 正本** | ✅ | `writeAssignmentDecision`: `patchProjectLocal` 常時 + `writeAssignment` await |
| **Hydrate** | ✅ | `hydrateFromSupabase`: DB assignment あり → remote、無し → local assignment 維持 |
| **Realtime 後も Hub 正本** | ✅ | Realtime → `hydrateFromSupabase` のみ（MVP を正本にしない） |

### 主要モジュール

| モジュール | 役割 |
| --- | --- |
| `builder-partner-assignment-hub-adapter.js` | Read アダプタ · Write decision · status resolve |
| `builder-project-write-adapter.js` | DB `writeAssignment` |
| `builder-project-store.js` | local Hub · hydrate merge |
| `builder-project-calendar-realtime.js` | hydrate トリガ |
| `builder-admin-calendar-hub-write.js` | 運営作成 Hub-primary + pending assignment |
| `builder.js` | 本線 UI · accept/decline · `resolveCalendarAssignmentStatus` |

---

## 3. MVP `assignment_status` 残存用途

本線表示の **直接参照は `resolveCalendarAssignmentStatus` 経由のみ**（Hub 優先）。

| 用途 | 箇所 | 分類 |
| --- | --- | --- |
| **fallback Read** | `resolveCalendarAssignmentStatus` live MVP 段 | B |
| **fallback Write** | `acceptCalendarAssignment` / `declineCalendarAssignment`（DB 失敗時） | B |
| **demo seed** | `ensureAdminCalendarPartnerDemoData` 系 | C |
| **admin 作成ミラー** | 運営カレンダー作成 · 割当時 `pending` | C |
| **test / 回帰** | `scripts/test-builder-calendar-cal-main-*.mjs` 等 | C |
| **thread 復旧（非本線）** | `builder-talk-bridge.js`（thread 無かつ accepted のとき） | D · 削除しない |

**本線表示で MVP を単独正本として読む経路は無い**（CAL-MAIN-18）。

詳細棚卸し: [assignment-status-read-inventory.md](./builder-calendar-assignment-status-read-inventory.md)

---

## 4. local assignment の役割

`tasu_builder_project_hub_v1` → `project.assignment`

| 役割 | 確認 |
| --- | --- |
| オフライン保持 | ✅ hydrate 失敗時 `demo_fallback` で local を返す |
| 即時 UI 更新 | ✅ `patchProjectLocal` が accept/decline / 運営作成で先に走る |
| Hub 同期前キャッシュ | ✅ DB write 前・失敗時も local が残る。hydrate は DB 無ければ local 維持 |

**それ以外の「第二の正本」としては使っていない**（表示は Hub Read リゾルバ、DB 成功時は hydrate で DB 優先）。

---

## 5. Hub Primary 完了条件チェックリスト

| # | 項目 | 判定 | 根拠 |
| --- | --- | --- | --- |
| 1 | Hub assignment Write | **OK** | `writeAssignmentDecision` · admin pending write |
| 2 | Hub assignment Read | **OK** | `readHubAssignmentStatus` · partner-assignment Hub path |
| 3 | Hub assignment Hydrate | **OK** | CAL-MAIN-13 merge · CAL-MAIN-16 Go |
| 4 | Realtime | **OK** | CAL-MAIN-04 · hydrate 経由で assignment 正本維持 |
| 5 | Talk | **OK** | CAL-MAIN-01/03/15 · 通知は Talk 優先 |
| 6 | ID Map | **OK** | CAL-MAIN-06 · legacy↔hub |
| 7 | Local assignment | **OK** | キャッシュ / 即時 UI / オフラインのみ |
| 8 | DB fallback | **OK** | 列無し · RLS · 未接続 → local+MVP |
| 9 | MVP fallback | **OK** | Read/Write とも条件付き維持 |
| 10 | projects mirror | **OK** | Hub-primary 作成時互換ミラー（削除しない） |
| 11 | notification | **OK** | CAL-MAIN-15 Talk 成功時 MVP ベル no-op |
| 12 | thread | **OK** | accept 時 thread 維持（assignment_status と分離） |

**総合: Hub Primary 完了（Go）**

---

## 6. 残存分岐・重複（削除しない · 一覧のみ）

| 項目 | 内容 | 扱い |
| --- | --- | --- |
| Dual-write 形 | Hub 常時 + MVP 条件付き | CAL-MAIN-17 設計どおり |
| partner-assignment Hub / MVP path | Hub 解決失敗時のみ MVP | CAL-MAIN-07 |
| `resolveAssignmentStatus`（adapter）vs `resolveCalendarAssignmentStatus`（builder） | builder 側が live MVP を追加 | 本線は builder 関数 |
| admin `calendarAssignments` vs Hub `assignment` | 割当権限・デモ文言 vs 手配状態 | 役割分離 |
| `mapHubStatusToAssignment` | Hub assignment 無し時の案件 status 由来 | 埋め込み fallback |
| talk-bridge `assignment_status` | thread 復旧のみ | D |
| Feature flag | `TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK` | 安全弁として維持 |
| TODO（実装残） | Production Migration · partner RPC 本番適用 · MVP キー段階廃止 | ロードマップ後続 |

---

## 7. 検証コマンドと結果（2026-07-04）

```bash
node scripts/test-builder-calendar-cal-main-19-hub-primary-close.mjs
node scripts/test-builder-calendar-cal-main-10-assignment-dual-write.mjs
node scripts/test-builder-calendar-cal-main-13-assignment-adapter.mjs
node scripts/test-builder-calendar-cal-main-15-mvp-bell-shrink.mjs
node scripts/verify-builder-assignment-db-roundtrip.mjs   # CAL-MAIN-16
node scripts/test-builder-calendar-cal-main-17-mvp-assignment-status-stop.mjs
node scripts/test-builder-calendar-cal-main-18-hub-read-primary.mjs
# 付帯（Talk / Realtime / ID Map）
node scripts/test-builder-calendar-cal-main-04-realtime.mjs
node scripts/test-builder-calendar-cal-main-06-id-map.mjs
```

結果は `reports/builder-calendar-cal-main-19/result.json` および各 CAL-MAIN レポートを参照。

---

## 8. 残タスク（Hub Primary 外）

Hub Primary **完了後も残る**もの（本フェーズのブロッカーではない）:

| 優先 | 内容 |
| --- | --- |
| P2 | Production への `assignment` jsonb / RLS **手動**適用 |
| P2 | partner RPC（`builder_set_assignment_status`）本番適用 · partner Auth マッピング |
| P2 | MVP キー段階廃止（assignment_status 完全削除は別フェーズ） |
| P2 | 完了下書きの扱い確定 |
| — | Realtime publication の Production 確認 |

---

## 9. 参照

| ドキュメント |
| --- |
| [mainline-plan](./builder-calendar-mainline-plan.md) |
| [assignment-status-read-inventory](./builder-calendar-assignment-status-read-inventory.md) |
| [assignment-jsonb-design](./builder-calendar-assignment-jsonb-design.md) |
| [staging-runbook](./builder-calendar-assignment-staging-runbook.md) |
| [mvp-write-stop-design](./builder-calendar-mvp-write-stop-design.md) |
