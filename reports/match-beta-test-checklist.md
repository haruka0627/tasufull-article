# TASFUL MATCH — クローズドβ テストチェックリスト

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-22** |
| 前提 | **MATCH_BETA0_5_SECURITY_UX_READY** · linked ref `ddojquacsyqesrjhcvmn` |
| 実行モード | Edge live 推奨（`?edge_stub=1` または本番 edge 接続）· 管理系は管理者 JWT 必須 |
| 参照検証 | `verify-match-beta-allowlist.mjs` · `verify-match-admin-live.mjs` · `verify-match-safety-live.mjs` 等 |

**記入欄:** PASS / FAIL / SKIP（理由）

---

## 0. テスト環境セットアップ

| 項目 | 内容 |
|------|------|
| テストユーザー | T1–T5（E2E シード）または手動作成 |
| 管理者 | `tasu_admin` / `match_admin` / `is_ops` いずれかの JWT |
| allowlist | migration シード: t1,t2,t4,t5=active · **t3=未登録** |
| 記録 | 実行者・日時・環境（edge_stub / 本番ホスト） |

---

## TC-01 未ログイン

| 項目 | 内容 |
|------|------|
| **目的** | 保護ページでログイン導線が表示され、API エラーと混同しないこと |
| **前提条件** | JWT なし · `client_stub` オフまたは実環境 |
| **操作手順** | 1. ログアウト状態で `match-swipe.html` を開く 2. 表示パネルを確認 3. 「ログインする」CTA を確認 |
| **期待結果** | 「TASFUL MATCH を利用するにはログインが必要です」パネル · beta gate とは別表示 · CTA → `dashboard.html` |
| **失敗時の確認箇所** | `match-login-gate.js` · `match-bootstrap.js` · `data-match-requires-login` 属性 |
| **PASS/FAIL** | |

---

## TC-02 allowlist なし

| 項目 | 内容 |
|------|------|
| **目的** | allowlist 未登録ユーザーが β ゲートで拒否されること |
| **前提条件** | ログイン済み · `talk_user_id` が allowlist に**ない**（例: t3） |
| **操作手順** | 1. t3 でログイン 2. `match-swipe.html` または API 呼び出し 3. 表示を確認 |
| **期待結果** | 403 `match_beta_not_allowed` · 「招待制β」パネル（`match-beta-gate.js`） |
| **失敗時の確認箇所** | `match_beta_allowlist` 行 · `match-beta.ts` · Edge env `MATCH_BETA_GATE_DISABLED` |
| **PASS/FAIL** | |

---

## TC-03 allowlist active

| 項目 | 内容 |
|------|------|
| **目的** | active ユーザーが MATCH API を利用できること |
| **前提条件** | allowlist `status=active`（例: t1）· ログイン済み |
| **操作手順** | 1. t1 でログイン 2. `match-mypage.html` を開く 3. プロフィール読み込みを確認 |
| **期待結果** | β ゲート非表示 · API 200 · 通常 UI |
| **失敗時の確認箇所** | `match_beta_allowlist.status` · JWT `talk_user_id` 一致 |
| **PASS/FAIL** | |

---

## TC-04 allowlist revoked

| 項目 | 内容 |
|------|------|
| **目的** | 停止された β 参加者が拒否されること |
| **前提条件** | 対象ユーザーを `revoked` に更新済み |
| **操作手順** | 1. SQL で `status='revoked'` 2. 当該ユーザーで MATCH ページ再読込 3. API 応答確認 |
| **期待結果** | 403 · 招待制βパネル |
| **失敗時の確認箇所** | allowlist 更新 · キャッシュ · `MATCH_BETA_GATE_DISABLED` |
| **PASS/FAIL** | |

---

## TC-05 プロフィール作成

| 項目 | 内容 |
|------|------|
| **目的** | 新規プロフィールが Edge 経由で作成できること |
| **前提条件** | allowlist active · プロフィール未作成ユーザー |
| **操作手順** | 1. `match-profile-create.html` を開く 2. 必須項目入力 3. 保存 |
| **期待結果** | 成功トースト/遷移 · `match_profiles` に行作成 |
| **失敗時の確認箇所** | `match-upsert-profile` · RLS · `match-profile-wiring.js` |
| **PASS/FAIL** | |

---

## TC-06 プロフィール編集

| 項目 | 内容 |
|------|------|
| **目的** | 既存プロフィールの更新が反映されること |
| **前提条件** | プロフィール作成済み · allowlist active |
| **操作手順** | 1. `match-mypage.html` 2. ニックネーム等を変更 3. 保存 |
| **期待結果** | 変更が API/UI に反映 |
| **失敗時の確認箇所** | `match-upsert-profile` · 所有者 RLS |
| **PASS/FAIL** | |

---

## TC-07 写真アップロード

| 項目 | 内容 |
|------|------|
| **目的** | プロフィール写真が private storage に保存されること |
| **前提条件** | プロフィール作成済み |
| **操作手順** | 1. マイページから写真追加 2. 画像ファイルを選択 3. 保存後フィード表示を確認 |
| **期待結果** | アップロード成功 · signed URL で表示 |
| **失敗時の確認箇所** | `match-upload-photo` · `match-profile-photos` bucket · storage policy |
| **PASS/FAIL** | |

---

## TC-08 候補フィード

| 項目 | 内容 |
|------|------|
| **目的** | スワイプ画面に他ユーザープロフィールが表示されること |
| **前提条件** | 複数 active プロフィール · 相互ブロックなし |
| **操作手順** | 1. `match-swipe.html` を開く 2. カード表示を確認 |
| **期待結果** | 候補が1件以上表示（または適切な空状態） |
| **失敗時の確認箇所** | `match-search-profiles` · `match_profiles_public` · suspend 状態 |
| **PASS/FAIL** | |

---

## TC-09 like

| 項目 | 内容 |
|------|------|
| **目的** | 片方向 like が記録されること |
| **前提条件** | フィードに候補表示 · 未マッチ |
| **操作手順** | 1. スワイプで like 2. 再表示で同一候補の扱いを確認 |
| **期待結果** | `match_swipes` に like 行 · エラーなし |
| **失敗時の確認箇所** | `match-record-swipe` · 409/422 応答 |
| **PASS/FAIL** | |

---

## TC-10 相互 like

| 項目 | 内容 |
|------|------|
| **目的** | 双方 like でマッチが成立すること |
| **前提条件** | ユーザー A が B を like 済み |
| **操作手順** | 1. ユーザー B で A を like 2. マッチ成立を確認 |
| **期待結果** | `match_pairs.status=active` · マッチ一覧に表示 |
| **失敗時の確認箇所** | `match-core.ts` mutual like ロジック |
| **PASS/FAIL** | |

---

## TC-11 マッチ一覧

| 項目 | 内容 |
|------|------|
| **目的** | 成立したマッチが一覧に表示されること |
| **前提条件** | TC-10 完了 |
| **操作手順** | 1. `match-list.html` を開く 2. 相手が表示されるか確認 |
| **期待結果** | 相互マッチのみ表示 · ブロック/unmatch 相手は非表示 |
| **失敗時の確認箇所** | `match-list-pairs` · `match-list-wiring.js` |
| **PASS/FAIL** | |

---

## TC-12 TALK ルーム作成

| 項目 | 内容 |
|------|------|
| **目的** | マッチ後に TALK ルームが作成されること |
| **前提条件** | active マッチペア |
| **操作手順** | 1. マッチ一覧から TALK へ 2. `match-ensure-talk-room` 経由でルーム作成 |
| **期待結果** | `transaction_rooms` に行 · チャット画面へ遷移可能 |
| **失敗時の確認箇所** | `match-ensure-talk-room` · `match-talk-bridge.html` |
| **PASS/FAIL** | |

---

## TC-13 TALK ルーム再利用

| 項目 | 内容 |
|------|------|
| **目的** | 同一ペアで再呼び出し時に既存ルームが再利用されること |
| **前提条件** | TC-12 でルーム作成済み |
| **操作手順** | 1. 再度 TALK 導線を実行 2. ルーム ID を確認 |
| **期待結果** | 新規作成ではなく同一 `transaction_rooms` 行を再利用 |
| **失敗時の確認箇所** | `match-ensure-talk-room` idempotency |
| **PASS/FAIL** | |

---

## TC-14 ブロック

| 項目 | 内容 |
|------|------|
| **目的** | ブロック後に相互が候補・マッチ一覧から消えること |
| **前提条件** | マッチまたは候補関係の2ユーザー |
| **操作手順** | 1. A が B をブロック（`match-block.html` 等） 2. フィード・一覧を確認 |
| **期待結果** | `match_blocks` 行 · 相互フィード除外 · TALK 新規 409 |
| **失敗時の確認箇所** | `match-block-user` · `match-safety-live` 検証ログ |
| **PASS/FAIL** | |

---

## TC-15 通報

| 項目 | 内容 |
|------|------|
| **目的** | 通報が DB に open で保存され、自動ブロックされないこと |
| **前提条件** | 2ユーザー · ブロックしていない |
| **操作手順** | 1. `match-report.html` から通報 2. 理由選択・送信 3. 被通報者がフィードに残るか確認 |
| **期待結果** | `match_reports.status=open` · **ブロックは発生しない** |
| **失敗時の確認箇所** | `match-submit-report` · safety レポート方針 |
| **PASS/FAIL** | |

---

## TC-16 マッチ解除

| 項目 | 内容 |
|------|------|
| **目的** | unmatch 後に一覧から消え、TALK が cancelled になること |
| **前提条件** | active マッチ + TALK ルームあり |
| **操作手順** | 1. 一方が unmatch 実行 2. 一覧確認 3. ルーム status 確認 |
| **期待結果** | `match_pairs.status=unmatched` · `transaction_rooms.status=cancelled` · 再マッチ不可 |
| **失敗時の確認箇所** | `match-unmatch-pair` · `verify-match-unmatch-live.mjs` |
| **PASS/FAIL** | |

---

## TC-17 本人確認申請

| 項目 | 内容 |
|------|------|
| **目的** | identity 申請が pending になること |
| **前提条件** | ログイン · allowlist active |
| **操作手順** | 1. `match-verify.html` 2. 「本人確認を申請する」 |
| **期待結果** | `match_verifications` pending · `verification_status=pending` |
| **失敗時の確認箇所** | `match-submit-verification` · `match-verification-wiring.js` |
| **PASS/FAIL** | |

---

## TC-18 年齢確認申請

| 項目 | 内容 |
|------|------|
| **目的** | age 申請が pending になること |
| **前提条件** | ログイン · allowlist active |
| **操作手順** | 1. `match-verify.html` 2. 「年齢確認を申請する」 |
| **期待結果** | type=age · status=pending |
| **失敗時の確認箇所** | `match-submit-verification` · migration age_type |
| **PASS/FAIL** | |

---

## TC-19 管理画面 — 通報審査

| 項目 | 内容 |
|------|------|
| **目的** | 管理者が通報を resolve / dismiss できること |
| **前提条件** | 管理者 JWT · edge モード · open 通報あり |
| **操作手順** | 1. `match-admin.html` → 通報 2. 解決 or 却下 |
| **期待結果** | status が `resolved` または `dismissed` · 監査ログ記録 |
| **失敗時の確認箇所** | `match-admin-review` · `match_is_admin()` · `match-admin-wiring.js` |
| **PASS/FAIL** | |

---

## TC-20 管理画面 — 本人確認審査

| 項目 | 内容 |
|------|------|
| **目的** | 本人確認の approve / reject がプロフィールに反映されること |
| **前提条件** | pending identity 申請 · 管理者 JWT |
| **操作手順** | 1. 本人確認タブ 2. 承認 3. プロフィール `verification_status` 確認 |
| **期待結果** | approve → `verified` · reject → `rejected` |
| **失敗時の確認箇所** | `match-admin-review` VERIFICATION_REVIEW · `match_edge_admin_set_verification_status` |
| **PASS/FAIL** | |

---

## TC-21 管理画面 — 年齢確認審査

| 項目 | 内容 |
|------|------|
| **目的** | 年齢確認 approve で `age_verified=true` になること |
| **前提条件** | pending age 申請 · 管理者 JWT |
| **操作手順** | 1. 年齢確認タブ 2. 承認 3. プロフィール確認 |
| **期待結果** | `age_verified=true`（reject 時は false） |
| **失敗時の確認箇所** | `match_edge_admin_set_age_verified` |
| **PASS/FAIL** | |

---

## TC-22 管理画面 — プロフィール停止

| 項目 | 内容 |
|------|------|
| **目的** | suspend でフィード・スワイプ・TALK が制限されること |
| **前提条件** | 対象プロフィール active · 管理者 JWT |
| **操作手順** | 1. プロフィールタブ 2. 停止 3. 当該ユーザーで swipe/feed 試行 4. 停止解除 |
| **期待結果** | suspend → 除外/403 · unsuspend → 復帰 |
| **失敗時の確認箇所** | `match_edge_admin_set_profile_status` · admin live レポート |
| **PASS/FAIL** | |

---

## 付録 A — 自動検証コマンド対応表

| チェックリスト | 自動スクリプト（参考） |
|----------------|------------------------|
| TC-02〜04 | `verify-match-beta-allowlist.mjs` |
| TC-05〜08 | `verify-match-profile-live.mjs` · `verify-match-feed-live.mjs` |
| TC-09〜11 | `verify-match-linked-ref-e2e.mjs` |
| TC-12〜13 | `verify-match-talk-room` 系 |
| TC-14〜15 | `verify-match-safety-live.mjs` |
| TC-16 | `verify-match-unmatch-live.mjs` |
| TC-17〜18 | `verify-match-verification-live.mjs` |
| TC-19〜22 | `verify-match-admin-live.mjs` |

---

## 付録 B — サマリ記入

| 区分 | PASS | FAIL | SKIP |
|------|------|------|------|
| ゲート (TC-01〜04) | | | |
| コア機能 (TC-05〜16) | | | |
| 確認申請 (TC-17〜18) | | | |
| 管理画面 (TC-19〜22) | | | |
| **合計** | /22 | | |

**総合判定:** PASS 必須件数 ___ / 22 · 実行者 ___ · 実施日 ___
