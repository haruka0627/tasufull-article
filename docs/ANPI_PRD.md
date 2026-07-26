# ANPI Product Requirements — ボタン式安否確認（正本）

**版:** 1.0 BUTTON-CHECK  
**最終更新:** 2026-07-26  
**種別:** 設計正本（Phase 2 Data Foundation は **Implemented locally / not deployed**）
**状態:** Canonical Design · Phase 2 DB migration / RLS / tests はローカル実装済み・未適用 · 既存 v1 コードは **RELEASE FROZEN**（[`reports/anpi-release-status.md`](../reports/anpi-release-status.md)）
**監査根拠:** [`reports/anpi-button-check-audit-and-design.md`](../reports/anpi-button-check-audit-and-design.md)

> **本 PRD は「スケジュール通知 →『無事です』ボタン → 未確認時は本人再通知 → 猶予後に緊急連絡先」を正式仕様とする。**  
> 電話着信・自動音声・AI 音声応答を中心とした方式は **採用しない**（将来補助オプションとしても本正本のコアではない）。

---

## §0 運営方針

### 0.1 基本コンセプト

```text
設定時刻に本人へ通知
  ↓
本人が「無事です」ボタンを押す
  ↓
当日の安否確認完了
```

未確認時:

```text
一定時間経過 → 本人へ再通知
  ↓
猶予時間を過ぎても未確認
  ↓
登録済み・承認済みの緊急連絡先へ「未確認」通知
```

| する | しない |
| --- | --- |
| ボタン 1 回で当日確認を完了 | 着信型・IVR・AI 音声応答を本体にする |
| 未確認を **未確認** として扱う | 未押下を事故・異常と断定する |
| TALK を通知ハブにする | 安否専用チャット / DM の二重実装 |
| 低運営コスト・シンプル MVP | 医療・救急・警備サービス化 |

**目指す一文:** 本人は迷わず押せ、家族は「まだ押されていない」だけを知り、運営は障害と未確認を取り違えない。

### 0.2 サービス境界（必須明記）

- **医療サービスではない**
- **救急通報サービスではない**（119 / 警察 / 消防への自動通報なし）
- **警備・現地確認サービスではない**
- 端末・通信・通知障害があり得る
- ボタン未押下は **異常確定ではない**（「本日の安否確認がまだ完了していません」）
- 最終判断は家族・登録連絡先が行う
- 緊急時は利用者が公的緊急窓口を利用する

免責だけの威圧 UI にしない。平易な説明 + 公的窓口への案内リンクを併記する。

### 0.3 対象ユーザー

| 役割 | 説明 |
| --- | --- |
| **本人（利用者）** | 毎日（または指定曜日）ボタンで確認する人 |
| **緊急連絡先** | 招待承認後に未確認通知を受け取る人（家族・支援者） |
| **契約者** | 課金・設定管理の主体（既存実装の contract holder と整合し得る） |
| **運営** | 配信障害・不正・問い合わせの最小対応（10:00–18:00 · 一人運営想定） |

### 0.4 非目標

- YouTube / SNS 型の総合見守りプラットフォーム化
- 位置・マイク・カメラ・行動監視による隠れた安否判定
- AI による病気・生死・緊急度の医学的判定
- 本人の代わりに確認ボタンを押すこと
- 未承認の緊急連絡先への通知
- 安否専用チャットの新設

---

## §1 基本フロー（本人）

### 1.1 成功パス

1. Scheduler が当日インスタンスを冪等生成（`user_id + local_check_date`）
2. 初回通知（TALK カード中心 · 補助チャネル任意）
3. 本人が **「無事です」** を押す
4. `confirmed_at` を保存 · 状態 `confirmed`
5. 本人画面に完了表示

**ボタン第一候補:** `無事です`  
**補助文言:** `今日の安否確認を完了します`

**完了表示例:**

```text
本日の安否確認が完了しました
確認時刻: 08:12
```

### 1.2 未確認パス

1. 初回通知後、未押下
2. 設定された再通知間隔の後、本人へ再通知（MVP: 1〜2 回）
3. 最終猶予期限超過 → 承認済み緊急連絡先へ **未確認** 通知
4. 文言は「異常が発生しました」ではなく **「本日の安否確認がまだ完了していません」**

### 1.3 遅延確認パス

緊急連絡先へ未確認通知 **後** に本人が押した場合:

1. 状態を `confirmed_late` に更新
2. 緊急連絡先へ **確認完了** 通知（例: 「本人の安否確認が完了しました · 確認時刻: 10:43」）

### 1.4 一時停止

| ケース | 例 |
| --- | --- |
| 旅行 · 入院 · 外泊 · 長期不在 | 期間指定 pause |
| 端末変更 · 一時的に不要 | 手動 pause / resume |
| 家族が直接確認する期間 | pause + 任意で連絡先へ「停止中」通知 |

停止中は **当日インスタンスを生成しない / 通知しない**（誤通知禁止）。再開日または手動再開で復帰。

---

## §2 スケジュール仕様（MVP）

複雑すぎる秒・分単位の自由設定はしない。

| 項目 | MVP 推奨 |
| --- | --- |
| 確認頻度 | 毎日 **または** 曜日指定（複数曜日可） |
| タイムゾーン | `Asia/Tokyo`（初期固定 · 表示で明示） |
| 初回通知時刻 | 時刻ピッカー（例: 08:00）· 1 日 1 回 |
| 再通知 | 初回から **+2h / +4h** 等の固定選択肢 · **最大 2 回** |
| 緊急連絡先通知 | 最終再通知後の **猶予**（例: +2h）または「当日 20:00」締切の選択 |
| 日付境界 | ローカル日付 `YYYY-MM-DD`（JST）で `local_check_date` |
| 当日確認期限 | 設定した最終期限。超過後も本人は遅延確認可 |

---

## §3 状態遷移

### 3.1 チェックインスタンス状態（最小セット）

| 状態 | 表示名 | 意味 | 終端 |
| --- | --- | --- | --- |
| `scheduled` | 予定 | 当日分生成 · 未通知 | 否 |
| `notified` | 通知済 | 初回通知成功（または試行済） | 否 |
| `reminded` | 再通知済 | 本人再通知を送った | 否 |
| `overdue` | 期限超過 | 最終猶予超過 · 連絡先通知前 | 否 |
| `contact_notified` | 連絡先通知済 | 緊急連絡先へ未確認通知済 | 否 |
| `confirmed` | 確認済 | 期限内に「無事です」 | **是** |
| `confirmed_late` | 遅延確認 | 連絡先通知後に確認 | **是** |
| `paused` | 停止中 | 設定 pause により当日スキップ | 条件付終端 |
| `cancelled` | 取消 | 設定削除・退会等 | **是** |

`delivery_failed` は **インスタンス状態に混ぜない**。通知配信テーブル側の状態とする（§5）。

### 3.2 主要遷移

```text
(日次ジョブ) → scheduled
scheduled → notified          … 初回通知試行後
notified → reminded           … 再通知条件成立
reminded → overdue            … 最終猶予超過（再通知回数消化後）
overdue → contact_notified    … 承認済み連絡先へ未確認通知
* → confirmed                 … 本人 confirm（contact_notified 前）
contact_notified → confirmed_late … 本人遅延 confirm
* → cancelled                 … 退会・設定削除
pause 設定中 → 当日は scheduled を生成しない（または即 paused）
```

### 3.3 冪等性

| キー | 制約 |
| --- | --- |
| 当日インスタンス | `UNIQUE (subject_user_id, local_check_date)` |
| 確認 API | 同一 `check_id` への連打は **1 回だけ** `confirmed*` に遷移 · 2 回目は 200 + 既存結果 |
| 通知 | `(check_id, channel, kind)` で配信行を一意化 · 二重 Cron でも再送しない |

古い TALK カード / 古い URL からの押下: `check_id` + 本人認証で検証。別日・cancelled・paused は拒否（明確なエラー）。

---

## §4 TASFUL TALK 連携

### 4.1 TALK へ集約するもの

- 本人への初回通知 · 再通知
- 確認完了の本人向け表示導線
- 緊急連絡先への未確認通知 · 遅延確認完了通知
- 運営からの重要なお知らせ（既存 `official_anpi` と整合）
- 通知履歴への導線

### 4.2 通知カード（本人）

```text
今日の安否確認

設定された安否確認時刻になりました。
問題がなければ、下のボタンを押してください。

[ 無事です ]
```

ボタン押下は **安否機能側の正式 confirm API** を呼び、TALK は UI シェルに留める。

### 4.3 重複禁止

- 安否専用チャットを新設しない（既存 `official_anpi` / 通知カテゴリを利用）
- TALK と安否で DM・通知エンジンを二重実装しない
- Platform 統一 notify tidy（[`docs/platform-notify-unified.md`](./platform-notify-unified.md)）の対象外方針は維持しつつ、**安否→TALK の単方向ハブ**を正とする

---

## §5 通知設計

### 5.1 チャネル優先（MVP）

| 優先 | チャネル | 本人 | 緊急連絡先 | 備考 |
| --- | --- | --- | --- | --- |
| 1 | **TALK** | ✅ | ✅ | 正本ハブ · カード + ボタン |
| 2 | **LINE**（既存 Edge） | ✅ 任意 | △ | 既存 `anpi-line-send` 再利用候補 |
| 3 | Web Push / App Push | 将来 | 将来 | 共通基盤があれば接続 |
| 4 | メール | 将来補助 | 将来補助 | 到達性補完 |
| 5 | SMS | 将来有料オプション候補 | 将来 | 原価意識 |
| 6 | 電話着信 | **コア禁止** | 将来オプション候補として分離 | IVR/自動音声は非採用 |

### 5.2 配信状態（通知行）

| 状態 | 意味 |
| --- | --- |
| `queued` | 送信待ち |
| `sent` | プロバイダ受理 |
| `delivered` | 既読/到達が分かる場合のみ |
| `failed` | 失敗 · **安否異常ではない** |
| `skipped` | pause / 未承認連絡先 / 権限 OFF |

UI では **「本人未確認」** と **「通知配信失敗」** を必ず分離表示する。

### 5.3 失敗時

TALK / Push / メール / SMS 失敗、連絡先無効、アカウント停止、端末未登録、通知許可 OFF、Cron 遅延、外部 API 障害:

- チェック状態を勝手に `confirmed` にしない
- リトライは指数・上限付き
- 運営向けに `delivery_failed` を監査
- 二重送信は idempotency キーで防止

---

## §6 緊急連絡先

### 6.1 属性

氏名 · 続柄/関係 · TALK アカウント（推奨）· メール/電話（補助）· 通知優先順位 · 有効/無効 · 同意 · 確認済み状態

### 6.2 招待 → 承認（必須推奨）

```text
本人が招待
  ↓
緊急連絡先が承認
  ↓
status=active で有効化
  ↓
この後初めて未確認通知を送ってよい
```

承認前・拒否・削除済みへは **送らない**。

複数登録可。削除・変更は本人操作 + 監査。連絡先側からも解除可。

---

## §7 AI の役割（AD-006 整合）

| 許可 | 禁止 |
| --- | --- |
| 設定案内 · 通知文の説明 | 病気・事故・生死の判定 |
| 履歴要約 · 未確認状態の説明 | 緊急度の医学的判断 |
| 利用方法 · 問い合わせ分類 | 本人の代わりに confirm |
| 家族向け説明文の下書き | 警察・消防・救急への自動通報判断 |
| | 緊急連絡先の勝手な追加 · 通知停止の自動決定 |
| | 「事故の可能性」「危険な状態」などの断定 |

AI 表現は **「未確認です」** までに留める。専用 ANPI AI エンジンは作らない（TASFUL AI 入口 / 既存導線）。

---

## §8 セキュリティ · 誤操作

| 脅威 | 対策 |
| --- | --- |
| 連打 · 同日重複 | confirm 冪等 · unique 日付 |
| 古いカード | `check_id` + 日付検証 |
| 代理押下 · セッション盗用 | 認証済み本人のみ · RLS |
| URL 直接実行 · CSRF · Replay | セッション Cookie / JWT · CSRF token または same-site · nonce |
| Bot | Rate limit · Turnstile 検討（Staging 以降） |
| pause 中の押下 | 拒否または no-op + 明示メッセージ |
| 他人の check_id | 認可失敗 |

---

## §9 監査ログ · 利用者履歴

**監査（運営・保全）:** 設定作成/変更 · pause/resume · 各通知 · 失敗 · 期限超過 · 連絡先通知 · confirm · 遅延 confirm · 連絡先招待/承認/削除 · 運営操作  

**利用者履歴:** 当日結果 · 確認時刻 · 簡易タイムライン（PII 最小）

両者はテーブルまたは view で分離推奨。

---

## §10 プライバシー

| 方針 | 内容 |
| --- | --- |
| 中心データ | 押下の事実 · 時刻 · スケジュール設定 · 連絡先関係 |
| **位置情報** | 使用しない（初期） |
| **マイク · カメラ** | 使用しない |
| **行動監視** | 行わない |
| 生体 | 使用しない |
| AI へ渡す情報 | 要約に必要な最小（生の電話番号・トークンは渡さない） |
| retention | 運用ポリシーで確定（案: 確認履歴 13 ヶ月 · 監査 24 ヶ月） |
| 削除 · エクスポート | 退会時に本人データ削除フロー · 連絡先は関連解除 |

---

## §11 データモデル（Phase 2 ローカル実装済み · migration 未適用）

既存を再利用し、重複作成を避ける。

| 既存 / Phase 2 | 責務 |
| --- | --- |
| legacy `anpi_user_contexts` | 本人・契約者コンテキスト · LINE · 通知チャネル（FROZEN · 変更なし） |
| legacy `anpi_notification_logs` | 既存通知履歴 + LINE 配信状態（変更なし） |
| legacy `anpi_check_sessions` | 旧未応答フロー（旧 status / text ID のため自動移行しない） |
| legacy `anpi_no_response_audit_log` | 旧 CTA 監査（変更なし） |
| Phase 2 `anpi_settings` | 時刻 · 曜日 · 再通知 · 猶予 · timezone · pause |
| Phase 2 `anpi_check_instances` | canonical status · 当日確認 · unique local date |
| Phase 2 `anpi_contacts` / `anpi_contact_invitations` | 緊急連絡先 · hash-only 招待承認 |
| Phase 2 `anpi_notification_deliveries` | チャネル別配信状態（実送信なし） |
| Phase 2 `anpi_audit_logs` | PII / secret を除外した追記監査 |

### 推奨制約（概念）

- PK: UUID  
- `anpi_check_instances`（または改訂 `anpi_check_sessions`）: `UNIQUE (subject_user_id, local_check_date)`  
- RLS: 本人は自分の設定/当日/履歴 · 承認済み連絡先は必要最小の未確認通知のみ · 運営は監査ロール  
- soft delete: 連絡先は `revoked_at` · ハード削除は retention 後  
- PII: 氏名 · 連絡先 · LINE id（既存どおり暗号化列パターンを踏襲）  
- encryption: トークン類は既存 `*_enc` 方針

**注:** 現行 `anpi_check_sessions` の status 集合（`pending` / `sent_to_user` / …）は本 PRD 語彙と異なる。Phase 2 は非破壊の mapping view と新 `anpi_check_instances` を採用し、legacy 行を推測で UPDATE しない。

---

## §12 API 設計案（実装しない）

既存静的 Pages + Supabase client が主。将来 Edge / Functions を足す場合の論理 API:

| Method | Path | 認可 | 冪等 |
| --- | --- | --- | --- |
| GET/POST/PATCH | `/api/anpi/settings` | 本人 | PATCH は If-Match 任意 |
| POST | `/api/anpi/settings/pause` · `/resume` | 本人 | はい |
| GET | `/api/anpi/checks/today` | 本人 | — |
| POST | `/api/anpi/checks/:id/confirm` | **本人のみ** | **必須**（Idempotency-Key or natural） |
| GET | `/api/anpi/history` | 本人 | — |
| GET/POST/DELETE | `/api/anpi/contacts…` | 本人 | 招待作成冪等 |
| POST | `/api/anpi/contacts/:id/accept` | **被招待者** | はい |

共通: Auth（Supabase JWT）· RLS · CSRF（cookie セッション時）· Rate limit（confirm / invite）· 監査追記 · ユーザー向けエラーは断定表現なし。

Scheduler は **サーバー側のみ**（クライアント `processDueTimeouts` は補助に留め、正本は Edge cron / キュー）。

---

## §13 UI 設計案

### 本人（可能なら 1 画面ハブ）

今日の状態 · 「無事です」 · 完了時刻 · 次回予定 · 一時停止 · 設定（時刻/曜日/再通知）· 緊急連絡先 · 履歴 · 通知許可案内

### 緊急連絡先

招待 · 承認/拒否 · 登録状態 · 未確認通知 · 遅延確認通知 · 過去通知 · 解除

### 運営（最小）

配信失敗 · 不正操作 · 問い合わせ用最小情報 · 監査ログ · 本人確認手順（10:00–18:00）

---

## §14 課金

| 項目 | 監査結果 |
| --- | --- |
| 現行正本の「月額 800 / 初月 500」 | **リポジトリ内に ANPI 専用の当該価格は未検出** |
| Future 価格帯 | [`docs/future/tasful-safety.md`](./future/tasful-safety.md) 個人 ¥300–980 等（**未確定**） |
| 本 PRD | **料金変更しない** · 停止中課金・連絡先無料は実装前に別決裁 |
| SMS / 電話 | 将来 **有料オプション候補** として分離（コア課金と混ぜない） |

---

## §15 実装フェーズ（安全分割）

| Phase | 目的 | 完了条件 | STOP |
| --- | --- | --- | --- |
| **1 Canonical Design** | 本 PRD · 監査 · 非目標 | 正本マージ · FROZEN コード未変更 | 実装着手要求が Scope 外 |
| **2 Data Foundation** | settings/contacts/check · RLS · audit · unique 日付 | **Implemented locally / not deployed** · Static verification passed · DB-backed SQL and real JWT runtime verification remain pending · migration 未適用 | Production 直適用 |
| **3 Core Check-In** | 設定 · 今日 · 無事です · 履歴 | E2E 当日確認 PASS | FROZEN 無計画改変 |
| **4 Scheduler & Reminder** | 初回 · 再通知 · 期限 · 冪等 cron | 二重 Cron でも 1 インスタンス | 着信型再導入 |
| **5 Emergency Contact** | 招待承認 · 未確認/遅延通知 | 未承認へ送らない | 同意なし送信 |
| **6 TALK Integration** | カード · ボタン · 失敗分離 | 専用チャット新設なし | TALK コア破壊 |
| **7 Security & Failure** | §8·§5 テスト | 一覧 PASS | 秘密漏えい |
| **8 Staging** | 実通知 · 複数端末 · pause | Staging Go | Production 誤操作 |

**依存:** 1→2→3→4→5→6（6 は 3 と並行設計可）→7→8  

**commit 分割案:** Phase ごと 1 コミット（docs / sql / client / talk-wiring を混ぜない）。

**次に実装すべき Phase（1 つのみ）:** Phase 2 の DB-backed 検証・レビュー・選別コミット完了後に **Phase 3 — Core Check-In**。それまでは Phase 3 を開始しない。

---

## §16 テスト計画（コードは作らない）

単位: 状態遷移 · 冪等 confirm · 日付境界 · pause  
結合: scheduler · deliveries · contacts 承認ゲート  
E2E: 当日成功 · 連打 · 初回/再通知/緊急 · 遅延確認 · 曜日 · TZ · 古いカード · 他人 ID · 認証切れ  
障害: Cron 二重 · TALK 失敗 · Push 拒否 · 連絡先削除 · 本人/連絡先退会  
セキュリティ: RLS · CSRF · rate limit · 監査ログ

---

## §17 実装状態サマリ（監査時点）

| 領域 | 状態 |
| --- | --- |
| 登録 · ダッシュボード · 通知 UI | **実装済み**（FROZEN）· デモ/LS 依存箇所あり |
| 「無事です」ボタン UI | **実装済み**（デモ状態機械） |
| スケジュール正式 scheduler | **未実装**（cron Edge なし） |
| 本人再通知 → 連絡先 | 設計揺れあり · **本 PRD が正** |
| 緊急連絡先招待承認 | **未実装**（契約者 1:1 中心） |
| TALK 連携 | **stub/demo + official_anpi** |
| LINE | **実装済み**（Edge） |
| 着信型コア | **非採用** · UI に `tel:` legacy 残存 |

詳細: 監査レポート。

---

## §18 関連ドキュメント

| 文書 | 役割 |
| --- | --- |
| 本 PRD | **ボタン式安否の正本** |
| [`reports/anpi-button-check-audit-and-design.md`](../reports/anpi-button-check-audit-and-design.md) | 監査インベントリ |
| [`reports/anpi-release-status.md`](../reports/anpi-release-status.md) | 既存 v1 FROZEN 歴史正本（改変しない） |
| [`reports/anpi-no-response-phase2-design.md`](../reports/anpi-no-response-phase2-design.md) | Phase2 設計 · **本人再通知なしは本 PRD で置換** |
| [`docs/future/tasful-safety.md`](./future/tasful-safety.md) | 将来マルチボタン Safety 構想 · 実装禁止メモ |

---

## 変更履歴

| 日付 | 版 | 内容 |
| --- | --- | --- |
| 2026-07-26 | 1.0 BUTTON-CHECK | 初版 · ボタン式を正式仕様化 · 監査レポート連携 |
| 2026-07-26 | 1.1 DATA-FOUNDATION | Phase 2 migration / RLS / tests をローカル実装（未適用 · 未デプロイ）· static 50 PASS · DB-backed pending |
