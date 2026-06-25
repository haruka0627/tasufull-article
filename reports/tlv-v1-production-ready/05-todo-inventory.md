# TLV v1.0 — TODO / FIXME / HACK / XXX 棚卸し

**実施日:** 2026-06-25  
**対象:** `live/`, `supabase/functions/`（TLV 関連）, `scripts/`（TLV 関連）

---

## サマリー

| 領域 | 件数 | Critical |
|------|------|----------|
| `live/` | **0** | 0 |
| `supabase/functions/`（TLV） | **1** | 0 |
| `scripts/`（TLV テスト） | **0** | 0 |

**Critical 以外は v1.0 Feature Freeze 下でそのまま維持。**

---

## live/

該当なし（`TODO` / `FIXME` / `HACK` / `XXX` コメント 0 件）

---

## supabase/functions/（TLV 関連）

| ファイル | 行 | マーカー | 内容 | 分類 |
|---------|-----|---------|------|------|
| `live-video-admin/index.ts` | 10 | TODO | `live_moderation_logs content_type` が `live_short \| live_broadcast_chat \| live_profile` に限定。動画種別拡張時に要更新 | **Low** |

### TLV 以外（参考・スコープ外）

| ファイル | 行 | 内容 |
|---------|-----|------|
| `_shared/match-auth.ts` | 99 | JWT verify 本番強化 TODO |
| `builder-create-signed-url/index.ts` | 20, 100 | identity claims 確認 TODO |
| `neural4d-vrm-proxy/index.ts` | 43 | REST エンドポイント TODO |

---

## scripts/（TLV 関連 `test-tlv-*` / `audit-tlv-*`）

該当なし（0 件）

### scripts/ 全体（TLV 非関連・参考）

| ファイル | 内容 | 分類 |
|---------|------|------|
| `migrate-builder-export-to-supabase.mjs` | `--execute` 未実装 TODO | スコープ外 |
| `verify-match-verification-live.mjs` | Admin API TODO（markdown 出力内） | スコープ外 |
| `verify-match-safety-live.mjs` | moderation TODO（markdown 出力内） | スコープ外 |

※ `HACKED` 文字列は RLS テスト用ペイロードであり、TODO マーカーではない。

---

## 所見

TLV アプリケーションコード（`live/`）に未解決 TODO は **0 件**。  
Edge の `live-video-admin` に 1 件の拡張メモのみ（v1.0 ブロッカーではない）。
