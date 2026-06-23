# TASFUL MATCH — クローズドβ 運用マニュアル

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-22** |
| 前提判定 | **MATCH_BETA0_5_SECURITY_UX_READY** |
| 対象環境 | Supabase ref `ddojquacsyqesrjhcvmn`（linked）· Edge live 経路 |
| 免責 | 本書は運用手順の整理であり、法務判断は `match-legal-publication-gate.md` を参照 |

---

## 1. 役割と連絡体制

| 役割 | 担当 | 連絡先（要記入） |
|------|------|------------------|
| β 運用リード | — | — |
| モデレーション当番 | — | — |
| 法務エスカレーション | — | — |
| 技術緊急（Edge/DB） | — | — |

**原則:** クローズドβは **手動審査前提**。自動停止・AI 監視は未実装のため、人的当番が必須。

---

## 2. 毎日見る項目

| # | 項目 | 確認方法 | 異常時 |
|---|------|----------|--------|
| 1 | **通報キュー（open）** | `match-admin.html` → 通報タブ、または SQL（下記） | モデレーションポリシーに従い対応 |
| 2 | **本人確認 pending** | 管理画面 → 本人確認タブ | 24h 以内に一次審査（目安） |
| 3 | **年齢確認 pending** | 管理画面 → 年齢確認タブ | 同上 |
| 4 | **新規 β 参加者** | `match_beta_allowlist` 一覧 | status が意図通りか |
| 5 | **停止中プロフィール** | 管理画面 → プロフィールタブ（suspended） | 解除予定・再審査の有無 |
| 6 | **Edge / Auth 異常** | 検証スクリプト or ユーザー問合せ | 技術担当へエスカレーション |
| 7 | **監査ログ（前日分）** | `match_moderation_logs`（engine=admin） | 不審な管理操作の有無 |

### 2.1 通報 open 件数（SQL）

```sql
select count(*) as open_reports
from public.match_reports
where status = 'open';
```

### 2.2 審査 pending 件数（SQL）

```sql
select verification_type, count(*) as pending_count
from public.match_verifications
where status = 'pending'
group by verification_type;
```

### 2.3 allowlist 一覧（SQL）

```sql
select talk_user_id, email, status, invited_at, accepted_at, updated_at
from public.match_beta_allowlist
order by updated_at desc;
```

---

## 3. β 参加者の追加

**目的:** 招待制βゲートを通過できるユーザーを登録する。

**手順:**

1. 対象ユーザーの `talk_user_id`（JWT `app_metadata.talk_user_id`）とメールを確認
2. `reports/match-beta-allowlist-ops.md` の SQL で `insert ... on conflict`（status=`invited` または `active`）
3. ユーザーに β 開始案内（利用規約・プライバシー・通報導線）を送付
4. 初回ログイン後、MATCH API が 403 でないことを確認

**status 意味:**

| status | Edge ゲート | 運用 |
|--------|-------------|------|
| `invited` | **許可** | 招待直後 |
| `active` | **許可** | 参加確定・利用中 |
| `revoked` | **拒否 (403)** | 停止 |

**注意:** 行削除より `revoked` を推奨（監査しやすい）。

---

## 4. β 参加者の停止

**目的:** β 参加資格を剥奪し、MATCH API を 403 にする。

**手順:**

1. `match_beta_allowlist` で `status = 'revoked'` に更新（`match-beta-allowlist-ops.md` 参照）
2. 必要に応じて **プロフィール停止**（`profile_status = suspended`）を併用
3. 停止理由・日時を運用記録（監査ログは allowlist 更新自体は別途 — 手動メモ推奨）
4. ユーザーへ通知（メール等 · テンプレート要整備）

**allowlist revoked と profile suspended の使い分け:**

| 操作 | 効果 |
|------|------|
| allowlist `revoked` | MATCH 全体 API 403（β ゲート） |
| profile `suspended` | フィード非表示・スワイプ/TALK 制限（allowlist は active のまま可能） |

危険ユーザーは **両方** を検討。

---

## 5. allowlist active / revoked 運用

| シナリオ | 操作 |
|----------|------|
| 招待 → 参加開始 | `invited` → `active`（`accepted_at` 設定） |
| 一時停止 | `revoked` |
| 再開 | `revoked` → `active` |
| 誤招待 | `revoked` + 必要ならプロフィール停止 |

**確認:** Edge は `match_is_beta_allowed()` で `invited` / `active` のみ許可。詳細は `reports/match-beta-allowlist-ops.md`。

---

## 6. 本人確認 pending / approved / rejected

| 状態 | 意味 | 運用 |
|------|------|------|
| `pending` | ユーザー申請済み・未審査 | 管理画面で確認 |
| `approved` | 審査承認 | `verification_status=verified` に同期 |
| `rejected` | 審査却下 | `verification_status=rejected` |

**本人確認申請が来た時の対応:**

1. 管理画面 `match-admin.html` → **本人確認**タブを開く（edge モード + 管理者 JWT 必須）
2. 対象ユーザーの表示名・user_id・書類種別（`id_document_type`）を確認
3. **現状:** 書類画像は DB 未保存のため、β では **別チャネルで本人確認**（メール・面談等）が必要な場合あり — **要確認**
4. 問題なければ **承認** → `verification_status=verified`
5. 不備があれば **却下** → ユーザーに再申請案内
6. 疑わしい場合は **プロフィール停止** + 通報キュー確認
7. 操作は `match_moderation_logs`（admin_verification）に記録される

---

## 7. 年齢確認 pending / approved / rejected

| 状態 | 意味 | 運用 |
|------|------|------|
| `pending` | 年齢確認申請済み | 管理画面で審査 |
| `approved` | 承認 | `match_profiles.age_verified = true` |
| `rejected` | 却下 | `age_verified = false` のまま |

**年齢確認申請が来た時の対応:**

1. 管理画面 → **年齢確認**タブ
2. プロフィールの `birth_date` / 申告年齢と整合するか確認
3. 18歳未満の疑いがある場合 → **即却下** + **プロフィール停止** + 法務エスカレーション
4. 問題なければ **承認**
5. 承認前に `age_verified` バッジを出さない運用ルールを徹底

---

## 8. 通報 open / resolved / dismissed

| 状態 | 意味 |
|------|------|
| `open` | 未処理（ユーザー提出直後） |
| `resolved` | 対応完了（制裁・警告等を実施した場合） |
| `dismissed` | 却下（通報内容が不十分・軽微・根拠なし） |

**通報が来た時の対応:**

1. 管理画面 → **通報**タブで open 件を確認
2. 通報者・被通報者・理由（`inappropriate_message` / `impersonation` / `harassment` / `other`）・詳細を読む
3. `reports/match-moderation-policy.md` で対応レベルを決定
4. 必要なら **プロフィール停止**（suspend）
5. 必要なら **allowlist revoked**
6. 通報のみでは **自動ブロックされない** — ブロックが必要ならユーザー操作または将来の運用判断
7. **解決** → `resolved` / 根拠不十分 → **却下** → `dismissed`
8. 重大案件（児童・脅迫・詐欺疑い）は法務・当局相談を検討

**注意:** 通報理由は UI 上 4 種。モデレーションポリシーの細分類は運用判断でマッピング。

---

## 9. プロフィール suspend / unsuspend

| 状態 | 効果 |
|------|------|
| `active` | 通常利用 |
| `suspended` | フィード非表示・スワイプ 403/404・TALK 作成 403 |

**手順（管理画面）:**

1. プロフィールタブ → 対象を選択
2. **停止** / **停止解除**
3. 停止理由を運用記録に残す

**検証済み挙動**（`match-admin-live-integration-report.md`）:

- suspend 後は feed / swipe / ensure-talk-room が拒否
- unsuspend 後は public view に再表示

---

## 10. マッチ解除

**ユーザー操作:** マッチ一覧等から unmatch（`match-unmatch-pair`）

**運用側の理解:**

| 項目 | 挙動 |
|------|------|
| `match_pairs.status` | `unmatched` |
| TALK ルーム | **削除しない** · `transaction_rooms.status = cancelled` |
| 再マッチ | **不可**（同一ペア） |
| ブロック済みペア | unmatch は **409** |

運営が介入する場合は通常不要。トラブル時は通報・停止フローを優先。

---

## 11. TALK ルーム cancelled

| トリガー | ルーム状態 |
|----------|------------|
| ブロック | `cancelled`（行は保持） |
| マッチ解除 | `cancelled`（行は保持） |
| 新規作成（ブロック済み） | **409** |

**運用:** ルーム URL 直アクセスの挙動は TALK 側管轄。MATCH 運用では「cancelled になった」ことをユーザーに説明するFAQを準備推奨。

---

## 12. 監査ログ確認

**テーブル:** `public.match_moderation_logs`

**記録対象（admin）:**

- 通報審査（`content_type=admin_report`）
- 本人/年齢審査（`admin_verification`）
- プロフィール停止（`admin_profile`）

**確認 SQL 例:**

```sql
select created_at, user_id, content_type, action, metadata
from public.match_moderation_logs
where engine = 'admin'
order by created_at desc
limit 50;
```

**頻度:** 日次（毎日見る項目 #7）。不審な操作は技術・法務へエスカレーション。

---

## 13. 危険ユーザーの停止判断

**即時停止を検討する目安**（詳細はモデレーションポリシー）:

- 18歳未満の疑い
- 児童に関する不適切コンテンツ
- 脅迫・ストーカー行為
- 詐欺・金銭要求の明確な証拠
- なりすまし（本人確認矛盾）
- 反社・違法行為の疑い

**推奨操作（併用可）:**

1. `profile_status = suspended`
2. `match_beta_allowlist.status = revoked`
3. 通報を `resolved` にし対応内容を記録
4. 必要に応じて TALK 側も確認

---

## 14. 誤停止時の解除

| 誤操作 | 復旧手順 |
|--------|----------|
| プロフィール誤 suspend | 管理画面 → **停止解除**（unsuspend） |
| allowlist 誤 revoked | SQL で `status = active` に戻す |
| 通報誤 resolved | **再オープン API なし** — 新規通報または DB 手動（service_role · 要記録） |
| 本人/年齢誤 reject | ユーザー再申請を案内、または DB/管理操作で pending 再作成（要技術確認） |
| ブロック誤操作 | **ブロック解除 API 未実装** — β では技術対応 or ユーザーに説明 |

**原則:** 復旧操作も監査ログ・運用メモに残す。

---

## 15. 問い合わせが来た時の一次対応

| 種別 | 一次対応 |
|------|----------|
| β に参加できない（403） | allowlist に `talk_user_id` があるか · status が revoked でないか確認 |
| ログインできない | TASFUL 全体 auth · MATCH 未ログイン UX（`match-login-gate.js`）を案内 |
| 通報したが反応がない | 受付確認 · 管理画面で open 状態か · SLA 目安を伝える |
| なりすまし・ハラスメント | 通報誘導 · ブロック方法案内 · 緊急なら停止判断 |
| マッチが消えた | unmatch / block / suspend のどれかを DB 確認 |
| TALK が使えない | ブロック・unmatch による cancelled か確認 |
| 退会・データ削除 | **自主退会フロー要確認** — 一次は問合せ受付 + 法務エスカレーション |
| 本人確認が通らない | 却下理由の説明 · 再申請手順 |

**エスカレーション:** 法務・個人情報・刑事事件疑い → 運用リード + 法務担当。

---

## 16. 緊急停止手順

### 16.1 単一ユーザーの緊急停止

1. 管理画面で **プロフィール停止**
2. allowlist を **`revoked`**
3. 関連通報を確認し `resolved` 記録
4. 当番リードに報告

### 16.2 MATCH 全体の緊急停止（技術）

**本番では原則使用禁止。** 障害・重大インシデント時のみ技術担当が実施。

```text
Edge env: MATCH_BETA_GATE_DISABLED=1
```

→ 全ユーザーが allowlist ゲートを通過できなくなるのではなく、**ゲート無効化**のため、意図は「β ゲートの挙動変更」であり、**サービス全体停止手段ではない**。

**実質的な全体停止の選択肢（要技術判断）:**

- Cloudflare / ホストで `/match/` パスをメンテナンスページへ
- Edge Functions の一括無効化（影響大）
- 全 allowlist を `revoked`（極端・非推奨）

**クローズドβでは:** 参加者少数のため **個別 revoked + suspend** が第一選択。

---

## 17. 管理画面のアクセス要件

| 要件 | 内容 |
|------|------|
| URL | `match/match-admin.html` |
| モード | **edge モード**（`client_stub` ではない） |
| 権限 | JWT に `match_is_admin()`（`tasu_admin` / `match_admin` / `is_ops`） |
| 本番 JWT | `MATCH_VERIFY_JWT=1` 設定後の署名検証 |

---

## 18. 定期検証コマンド（回帰）

```bash
node scripts/verify-match-beta-allowlist.mjs --skip-deploy
node scripts/verify-match-admin-live.mjs --skip-deploy
node scripts/verify-match-safety-live.mjs --skip-deploy
```

---

## 関連ドキュメント

| ファイル | 用途 |
|----------|------|
| `reports/match-beta-allowlist-ops.md` | allowlist SQL |
| `reports/match-moderation-policy.md` | 違反・制裁基準 |
| `reports/match-beta-test-checklist.md` | 受入テスト |
| `reports/match-legal-publication-gate.md` | 法務ゲート |
