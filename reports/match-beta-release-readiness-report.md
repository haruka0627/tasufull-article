# TASFUL MATCH — βリリース判定レポート

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-22** |
| 調査方法 | コードベース・migration・Edge Functions・`reports/match-*`・検証スクリプトの横断調査（**新規実装なし**） |
| 対象 ref | `ddojquacsyqesrjhcvmn`（linked Supabase · 検証レポート記載） |
| 総合判定 | **BETA_READY（条件付き・クローズドβのみ）** |

---

## エグゼクティブサマリ

MATCH の **バックエンド（DB / RLS / Edge live 経路）はコア E2E が linked ref 上で検証済み**であり、限定招待ユーザー向けのクローズドβは技術的に可能な水準にある。一方、**本番フロントのデフォルトは `client_stub`** であり、エンドユーザーが静的サイトだけを開いた場合は **デモデータ動作**になる。加えて **JWT 署名検証未実装**・**eKYC/電話認証未実装**・**本番ドメイン（tasful.jp）到達未確認**・**マーケ文言と実装の乖離（AI監視等）** があり、**オープンβ・一般公開は不可**と判断する。

| 判定軸 | 結論 |
|--------|------|
| 現在の成熟度 | **ALPHA 後期 〜 条件付き BETA_READY**（バックエンド先行・フロント本番接続遅れ） |
| β公開可否（クローズド） | **可（条件付き）** — 招待制・allowlist・`edge_stub` 起動・運営審査体制必須 |
| β公開可否（オープン） | **不可** |
| 一般公開可否 | **不可** |

---

## 1. 実装済み一覧（カテゴリ別）

凡例:

| 記号 | 意味 |
|------|------|
| **LIVE** | linked ref + 実 JWT + Edge で検証スクリプト PASS、または DB/RLS が本番相当 |
| **PARTIAL** | 一部 live・一部 stub・または UI/本番配線が未完了 |
| **STUB** | 意図的スタブ・固定応答・常に false 等 |
| **NOT_IMPLEMENTED** | スキーマ/関数/UI いずれも未整備 |

### 1.1 機能カテゴリ

| カテゴリ | 判定 | 根拠（実在ファイル・レポート） |
|----------|------|--------------------------------|
| **プロフィール** | **PARTIAL** | Edge `match-upsert-profile` live（`match-profile.ts`）· `verify-match-profile-live.mjs` **19/19 PASS**。UI は `match-profile-wiring.js` が **edge_stub 時のみ** live。デフォルト `client_stub`（`match-api.js` L9） |
| **写真** | **PARTIAL** | Edge `match-upload-photo` live · migration `20260624100000_match_profile_storage.sql`（private bucket）。上記と同じく edge 接続時のみ |
| **候補フィード** | **PARTIAL** | Edge `match-search-profiles` live · `verify-match-feed-live.mjs` **41/41 PASS**。`match-feed-wiring.js` は edge_stub のみ。フィルタ TODO（online_only 等）はレポート記載 |
| **スワイプ** | **PARTIAL** | `like`/`skip` live（`match-record-swipe` · `verify-match-linked-ref-e2e.mjs`）。`super_like` は Edge **422 `phase_not_enabled`**（`match-record-swipe/index.ts` L38-39） |
| **マッチ** | **PARTIAL** | 相互 like → `match_pairs` live（`match-core.ts`）· E2E **51/51 PASS**。解除後再マッチは **不可**（設計・`match-unmatch-live-integration-report.md`） |
| **TALK連携** | **PARTIAL** | `match-ensure-talk-room` live · `transaction_rooms` 再利用/作成 · `match-talk-room-integration-report.md`。linked ref スキーマ差分はフォールバック実装済。MATCH 内チャットは **意図的に無し** |
| **ブロック** | **PARTIAL** | `match-block-user` live · `verify-match-safety-live.mjs` **29/29**（レポート表記 24/24 系も PASS）。**ブロック解除 API なし**（`match-unblock-user` 未実装） |
| **通報** | **PARTIAL** | `match-submit-report` live · `match_reports` 保存のみ（**自動停止なし** · safety レポート明記） |
| **マッチ解除** | **PARTIAL** | `match-unmatch-pair` live · `verify-match-unmatch-live.mjs` **25/25** |
| **本人確認** | **PARTIAL** | `match-submit-verification` live（identity → pending）· **eKYC 未連携** · **書類画像保存なし** · 手動審査（`match-verification-live-integration-report.md`） |
| **年齢確認** | **PARTIAL** | 同上（type=`age`）· `match_profiles.age_verified`（migration `20260626100000`）· 管理者 approve で反映 |
| **管理画面** | **PARTIAL** | `match-admin-review` live · `match/match-admin.html` + `match-admin-wiring.js` · `verify-match-admin-live.mjs` **31/31 PASS**。**edge_stub + 管理者 JWT のみ** · 本番ホスト組込みなし |
| **RLS** | **LIVE** | `20260621170000_match_rls_d2.sql` 等 · 8 テーブル enable · `match_is_admin()` · `match_profiles_public` view · `verify-auth-hook-l11-rls-d2.mjs` 系 |
| **JWT / Auth Hook** | **PARTIAL** | Custom Access Token Hook migration あり（`20260621180000`）· T1–T5 allowlist 検証済。**Edge は JWT payload decode のみ・署名検証なし**（`match-auth.ts` L90-91 TODO）· **Functions deploy は `--no-verify-jwt`** |
| **Storage** | **LIVE** | `match-profile-photos` private · signed URL（feed 1h）· path 制限（profile live レポート） |
| **Admin（運営権限）** | **PARTIAL** | `match_is_admin()` + `tasu_admin`/`match_admin`/`is_ops` · 通報/本人/年齢/停止 MVP。**管理者通知・SLA・アラートなし** |

### 1.2 P15 拡張（参考）

| カテゴリ | 判定 | 根拠 |
|----------|------|------|
| お気に入り | **PARTIAL** | Edge `match-favorite` 等 live（`match-p15.ts`）· UI `match-p15-wiring.js` · edge 時のみ |
| 足あと | **PARTIAL** | `match-record-profile-view` / `match-list-profile-views` live · footprint は service_role 経路 |
| 検索・保存検索 | **PARTIAL** | `match-save-search` 等 live · swipe 画面とのフィルタ統合は PARTIAL（feed レポート TODO） |
| 相性スコア | **PARTIAL** | RPC `match_compatibility_score` · `match-get-compatibility` live · ルールベース（AI ではない） |
| プロフィール完成度 | **PARTIAL** | `match-get-profile-completeness` live |

### 1.3 明示的 STUB / 未実装

| カテゴリ | 判定 | 根拠 |
|----------|------|------|
| **電話番号認証（SMS）** | **STUB** | UI はステップ表示のみ · `verification_type=phone` API 型はあるが MVP live は identity/age のみ |
| **モデレーションログ API** | **STUB** | `match-moderation-log/index.ts` → `mode: "stub"` 固定 |
| **AI監視（MATCH 専用）** | **NOT_IMPLEMENTED** | `match-safety.html` 等の文言のみ · TALK 既存基盤への誘導コピー |
| **自動モデレーション** | **NOT_IMPLEMENTED** | `match_moderation_logs` は admin 手動 + 将来 rules/ai 想定 |
| **eKYC ベンダー** | **NOT_IMPLEMENTED** | `provider=manual` のみ |
| **制裁テーブル（ban）** | **STUB** | `match_has_active_match_ban()` は **常に false**（`20260622190000` L231-232） |
| **スーパーいいね** | **NOT_IMPLEMENTED** | API/UI 入口あり · Edge 拒否 |
| **ブロック解除** | **NOT_IMPLEMENTED** | safety レポート TODO |
| **通報→自動停止** | **NOT_IMPLEMENTED** | 通報は DB 保存 + 管理審査のみ |
| **管理者プッシュ通知** | **NOT_IMPLEMENTED** | レポート・コードに該当なし |
| **本番運用監視（MATCH 専用）** | **NOT_IMPLEMENTED** | 汎用 smoke のみ |

### 1.4 Edge Functions 一覧（23 本）

| Function | 判定 | 備考 |
|----------|------|------|
| `match-upsert-profile` | LIVE | |
| `match-upload-photo` | LIVE | |
| `match-search-profiles` | LIVE | |
| `match-record-swipe` | PARTIAL | super_like 不可 |
| `match-list-pairs` | LIVE | |
| `match-ensure-talk-room` | LIVE | |
| `match-block-user` | LIVE | |
| `match-submit-report` | LIVE | |
| `match-unmatch-pair` | LIVE | |
| `match-submit-verification` | LIVE | phone/eKYC は対象外 |
| `match-admin-review` | LIVE | MVP |
| `match-favorite` / `unfavorite` / `list-favorites` | LIVE | P15 |
| `match-record-profile-view` / `list-profile-views` | LIVE | P15 |
| `match-save-search` / `list` / `delete` | LIVE | P15 |
| `match-get-compatibility` | LIVE | |
| `match-get-profile-completeness` | LIVE | |
| `match-update-activity` | LIVE | |
| `match-moderation-log` | **STUB** | |

---

## 2. E2E 確認（成立している導線）

検証スクリプト・レポート上 **linked ref + edge_stub + 実 JWT（T1–T5 allowlist）** で成立が確認されている導線。

### 2.1 コア導線（検証済み）

```
[Tasuful ログイン · talk_user_id 付き JWT]
        ↓
プロフィール作成（match-profile-create.html · edge）
        ↓ match-upsert-profile + match-upload-photo
候補表示（match-swipe.html · match-search-profiles）
        ↓
like / skip（match-record-swipe）
        ↓ 相互 like
match_pairs 生成（service_role · match-core.ts）
        ↓
マッチ一覧（match-list.html · match-list-pairs）
        ↓
TALK ルーム作成（match-ensure-talk-room）
        ↓
chat-detail.html?room={uuid}（TASFUL TALK 既存経路）
        ↓
メッセージ送受信（TALK 側 · MATCH 外）
```

**根拠:** `reports/match-linked-ref-e2e-verification-report.md` **51/51 PASS**

### 2.2 安全・モデレーション導線（検証済み）

```
通報（match-submit-report）→ match_reports（open）
        ↓ 管理（match-admin-review · REPORT_REVIEW）
resolved / dismissed

ブロック（match-block-user）→ フィード/一覧/TALK 新規 から除外
解除（match-unmatch-pair）→ 一覧除外 · TALK 新規 409 · 再マッチ不可

本人/年齢申請（match-submit-verification）→ pending
        ↓ 管理（VERIFICATION_REVIEW）
verified / rejected · age_verified

プロフィール停止（PROFILE_ACTION suspend）→ フィード非表示 · swipe/TALK 制限
```

**根拠:** safety **29/29** · unmatch **25/25** · verification **25/25** · admin **31/31**

### 2.3 未成立・条件付きの導線

| 導線 | 状態 |
|------|------|
| 静的サイトのみ（`client_stub` デフォルト） | **スタブデータ動作** — 実 DB に接続しない |
| `__MATCH_FUNCTIONS_BASE__` 未注入の本番 HTML | edge_stub 自動起動 **しない**（`match-p15-wiring.js` L100-103） |
| `getAuthHeaders()` が `stub-match-token` のまま | edge_stub 起動 **しない**（L98） |
| 電話番号認証完了 → 本人確認済みバッジ | **未成立**（SMS なし） |
| 通報のみで自動アカウント停止 | **未成立** |
| 解除後に同一ペアで再マッチ | **意図的に未成立** |
| super_like → マッチ | **未成立** |
| MATCH 画面内チャット | **意図的に無し**（TALK のみ） |

---

## 3. 未実装・残課題一覧

### 3.1 プロダクト / 機能

- eKYC ベンダー連携（書類提出・自動判定）
- SMS 電話番号認証
- 本人確認書類の安全な Storage 取り扱い（現状 MVP は画像非保存）
- AI 監視（MATCH 専用 · プロフィール/写真の自動判定）
- `match-moderation-log` live 化（ユーザー/システムからのログ ingest）
- 通報の自動エスカレーション・自動停止
- `match_sanctions` / 本物の `match_has_active_match_ban`
- ブロック解除 API（`match-unblock-user`）
- スーパーいいね
- unmatch 後の再マッチ政策（現状は不可）
- 管理者へのリアルタイム通知（メール/Slack 等）
- オンライン中フィルタ・相性順ソート（feed レポート TODO）
- 趣味タグ AND 検索

### 3.2 技術 / 本番化

- Edge JWT **署名検証**（現状 decode のみ · `match-auth.ts`）
- Supabase Functions の JWT 検証を gateway 側で有効化するかの方針確定
- 本番 HTML への **`__MATCH_FUNCTIONS_BASE__` + 実セッション JWT** 組込み
- `TasfulMatchAuth.getAuthHeaders()` の **Supabase access_token 委譲**（現状 `stub-match-token` 固定 · `match-auth.js` L108-113）
- `client_stub` デフォルトから **本番 `edge_stub` への切替**戦略
- tasful.jp 本番到達・config 配信の確認（`tasful-match-ui-prod-url-review.md` は **BLOCKED_WITH_REASON**）
- 本番専用 E2E（本番ドメイン + 本番 Auth）
- MATCH 専用 SLO / 監視ダッシュボード / オンコール
- Edge Function コールドスタート・レート制限設計

### 3.3 法務・運用

- 利用規約・プライバシーポリシーへの MATCH 固有条項の法務レビュー
- マッチングアプリ向け表示義務（年齢確認・本人確認の表示）の実装と文言整合
- マーケコピーと実装の整合（「AI監視標準装備」等 — 現状は TALK 誘導・文言先行）
- 個人情報保護（書類画像・ログ保持期間）
- 管理者不在時の SLA / 手動審査キュー運用設計
- インシデント対応手順

---

## 4. β判定

### 4.1 判定結果

| スケール | 該当 | 理由 |
|----------|------|------|
| NOT_READY | ✗ | コア API/UI live 経路は linked ref で検証済みのため該当しない |
| ALPHA | △ | フロント本番接続・Auth 統合が未完了なら ALPHA 相当の体験になる |
| **BETA_READY** | **◎（条件付き）** | **招待制クローズドβ**ならコア E2E + 安全機能 + 手動審査 MVP が揃う |
| RELEASE_CANDIDATE | ✗ | 本番ドメイン未確認 · JWT セキュリティ · client_stub デフォルト |
| PRODUCTION_READY | ✗ | eKYC/電話認証/自動監視/法務/運用監視が未整備 |

### 4.2 総合ラベル

**`BETA_READY（クローズドβ限定 · 条件付き）`**

**理由（甘め評価を避けた必須条件）:**

1. **バックエンド:** プロフィール〜TALK までのコアチェーンが `verify-match-linked-ref-e2e.mjs` で **51/51 PASS**
2. **安全系:** block/report/unmatch/verification/admin が個別 live レポートで PASS
3. **ブロッカー:** 本番静的配信だけでは **実データに繋がらない**（`client_stub`）
4. **ブロッカー:** 本人確認は **手動審査 MVP**（eKYC なし）— 恋愛・婚活サービスとしてのコンプライアンスリスク残存
5. **ブロッカー:** JWT 検証が本番水準でない — トークン偽造リスク（Edge 内 decode のみ）
6. **ブロッカー:** `tasful-match-ui-prod-url-review.md` — **本番 URL 到達未確認**

---

## 5. 本番前必須項目

### 5.1 β公開前

| 優先 | 区分 | 項目 |
|------|------|------|
| 必須 | 配線 | 本番ページに `__MATCH_FUNCTIONS_BASE__` 注入 + 実 Supabase JWT を `TasfulMatchAPI` に渡す |
| 必須 | 配線 | `client_stub` を招待ユーザー環境では `edge_stub` に切替（全コア画面） |
| 必須 | Auth | Custom Access Token Hook 本番有効化 · 全 MATCH ユーザーに `talk_user_id` 保証 |
| 必須 | 運用 | 管理者ロール付与手順（`match_admin` / `is_ops`）· `match-admin.html` への導線 |
| 必須 | 運用 | 本人確認・年齢確認の **手動審査 SLA** と担当者 |
| 必須 | 法務 | β向け利用規約・免責（手動審査・限定招待である旨） |
| 必須 | 検証 | 招待ユーザーでの通しテスト（プロフィール→マッチ→TALK） |
| 推奨 | セキュリティ | Edge JWT 署名検証の実装 |
| 推奨 | UX | マーケ文言の実装一致（AI監視等の過大表示修正） |
| 推奨 | 監視 | 通報/審査 pending 件数の定期確認（SQL or 管理画面） |
| 推奨 | データ | linked ref 全 migration 適用状態の本番同等確認 |

### 5.2 一般公開前

| 優先 | 区分 | 項目 |
|------|------|------|
| 必須 | 本人確認 | eKYC または同等の身分証検証（画像の安全保管含む） |
| 必須 | 年齢 | 年齢確認の法的要件を満たすフロー（実装+法務） |
| 必須 | セキュリティ | JWT 本番検証 · RLS ペネトレーション · service_role 最小権限監査 |
| 必須 | モデレーション | 通報エスカレーション · 自動/半自動停止ルール |
| 必須 | 制裁 | `match_sanctions` 実装 · `match_has_active_match_ban` の実データ化 |
| 必須 | 運用 | 24h 対応体制（または表示と実態の一致） |
| 必須 | 法務 | 特商法・マッチングアプリ関連の表示・個人情報保護 |
| 必須 | 本番 | tasful.jp（または本番 CDN）での E2E · config ref 一致 |
| 推奨 | 機能 | ブロック解除 · 電話認証 · 再マッチ政策の製品判断 |
| 推奨 | 機能 | super_like または UI から削除 |
| 推奨 | AI | TALK 連携を超えたプロフィール/写真の AI 監視 |
| 推奨 | SRE | ダッシュボード・アラート · Edge エラーレート監視 |

---

## 6. リスク評価

| リスク | レベル | 説明 |
|--------|--------|------|
| 本番が `client_stub` のまま公開される | **高** | ユーザーは実マッチングできず、デモと誤認される |
| Edge JWT 署名未検証 + `--no-verify-jwt` | **高** | トークン偽造で API 悪用の理論的可能性 |
| 本人確認が手動のみ（eKYC なし） | **高** | なりすまし・年齢不実の残存 · 法務・信用リスク |
| 管理者不在・審査遅延 | **高** | pending キューが溜まり、verified バッジが機能しない |
| マーケ「AI監視」と実装の乖離 | **高** | 表示義務・景表法・ユーザー信頼のリスク |
| 通報のみでは停止しない | **中** | 被害拡大まで管理者操作が必要 |
| `match_has_active_match_ban` が常に false | **中** | 制裁設計が未接続 |
| unmatch 後の再マッチ不可 | **中** | 誤操作時の UX・サポート負荷 |
| 手動審査での人的ミス | **中** | approve/reject のオペミス |
| linked ref と本番 DB の migration ドリフト | **中** | 本番デプロイ時の障害 |
| super_like UI があるが 422 | **低** | 混乱程度（メッセージは出る） |
| P15 機能の edge 未接続 | **低** | コアβには必須でない |
| TALK 既存ルームのブロック後挙動 | **低** | 設計上 TALK 側管轄 · 文書化済み |

---

## 7. 検証結果表（主要スクリプト）

| スクリプト / レポート | Verdict | 件数 | 備考 |
|------------------------|---------|------|------|
| `verify-match-linked-ref-e2e.mjs` | PASS | 51/51 | コア E2E |
| `verify-match-profile-live.mjs` | PASS | 19/19 | プロフィール+写真 |
| `verify-match-feed-live.mjs` | PASS | 41/41 | 候補フィード |
| `verify-match-safety-live.mjs` | PASS | 29/29 | block/report |
| `verify-match-unmatch-live.mjs` | PASS | 25/25 | 解除 |
| `verify-match-verification-live.mjs` | PASS | 25/25 | 申請 pending |
| `verify-match-admin-live.mjs` | PASS | 31/31 | 管理 MVP |
| `smoke-match-p15-l5-dist-sync.mjs` | PASS | 8 checks | dist 40 files |
| `tasful-match-ui-prod-url-review.md` | **BLOCKED** | — | tasful.jp 到達不可 |

**注意:** 上記は **linked ref · テストユーザー（T1–T5）限定**。本番一般ユーザーでの再現は未確認。

---

## 8. 最終結論

### 8.1 現在の成熟度

**ALPHA 後期 〜 条件付き BETA_READY**

- **サーバー側:** コアドメイン（プロフィール・探索・マッチ・TALK 橋渡し・安全・審査 MVP）は migration + Edge + RLS で **実装・検証済み**
- **クライアント側:** UI は充実しているが、**本番デフォルトはスタブ**であり、TASFUL Auth からの実 JWT 配線が **未完成**
- **運用・法務:** 手動オペ前提の MVP。一般向けサービスとしては **未成熟**

### 8.2 残工数（概算・人日は未計測）

| ブロック | 規模感 |
|----------|--------|
| 本番フロント接続（edge_stub 化・Auth 統合） | **小〜中**（1 スプリント） |
| JWT 本番化 | **中** |
| クローズドβ運用準備（法務・手順・管理） | **小** |
| eKYC + 電話認証 + 自動監視 | **大**（一般公開の主残） |
| 本番 SRE / 法務完備 | **大** |

### 8.3 次にやるべき順位 TOP10

1. **本番 HTML に `__MATCH_FUNCTIONS_BASE__` + 実 JWT 配線**（`TasfulMatchAuth` / `TasuAuthCurrentUser` 委譲）
2. **招待βユーザー向け `edge_stub` 強制**（`client_stub` を本番ホストで無効化）
3. **Edge JWT 署名検証**（`match-auth.ts` TODO 解消）
4. **tasful.jp 到達確認 + `verify-match-ui-prod-url-review.mjs` 再実行**
5. **管理者運用手順書**（通報・本人・年齢・停止の日次審査）
6. **マーケ/安心ページの文言監査**（AI監視・24h 等の実装一致）
7. **全 migration の本番適用チェックリスト**
8. **通報 pending の監視クエリ or ダッシュボード**
9. **eKYC ベンダー選定と設計**（一般公開の前提）
10. **`match_sanctions` + 自動停止ルール設計**

### 8.4 β公開可否

| 対象 | 可否 | 一言 |
|------|------|------|
| **限定クローズドβ**（招待 · allowlist · 運営体制あり） | **可（条件付き）** | コア E2E は検証済み。配線 #1–#2 と運用 #5 を満たせば開始可能 |
| **オープンβ** | **不可** | Auth/本番接続・審査体制・法務が不足 |
| **一般公開** | **不可** | eKYC・本番セキュリティ・モデレーション・法務が未達 |

---

## 付録 A — 調査対象の主要パス

| 領域 | パス |
|------|------|
| フロント | `match/`（HTML/JS/CSS 40+ ファイル · `deploy/cloudflare/dist/match/` 同期） |
| Edge | `supabase/functions/match-*`（23 functions）· `supabase/functions/_shared/match-*.ts` |
| DB | `supabase/migrations/20260621120000` 〜 `20260626100000`（MATCH 関連 13 本） |
| レポート | `reports/match-*`（26 本）· 本レポート |
| 検証 | `scripts/verify-match-*.mjs` · `scripts/smoke-match-*.mjs` |

## 付録 B — DB テーブル（調査対象）

| テーブル / View | 状態 |
|-----------------|------|
| `match_profiles` | LIVE · RLS · `profile_status` / `verification_status` / `age_verified` |
| `match_profiles_public` | LIVE · 探索用 view |
| `match_pairs` | LIVE · status: active/unmatched/blocked 等 |
| `match_swipes` | LIVE |
| `match_blocks` | LIVE |
| `match_reports` | LIVE |
| `match_verifications` | LIVE · manual MVP |
| `match_moderation_logs` | LIVE schema · admin 書込 · API stub |
| `transaction_rooms` | LIVE · TALK 橋渡し（`listing_type=match`） |

---

*本レポートは 2026-06-22 時点のリポジトリ・検証レポートに基づく。デプロイ状態は環境により変動するため、β開始前に該当 `verify-match-*.mjs` の再実行を推奨する。*
