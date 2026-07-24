# Help / AI 検索 — Archive 除外比較レポート

**方針:** 調査のみ · Archive / 削除は未実施
**生成日時:** 2026-06-30T02:59:25.326Z
**対象記事:** 4394 件
**代表キーワード:** 100 件

---

## 1. 比較シナリオ

| シナリオ | Archive 件数 | 残存 | 説明 |
|----------|-------------|------|------|
| **A: 自動候補フル** | 4207 | 187 | 削除スコア ≥7 をすべて除外 |
| **B: 変種のみ（推奨）** | 3407 | 987 | q変種・ペルソナ変種のみ除外（canonical / SEED / 保持候補は残す） |

## 2. サマリー比較

| 指標 | 含む（共通） | A 除外 | B 除外 |
|------|-------------|--------|--------|
| Help検索 平均ヒット | 279.5 | 12.5 | 67.1 |
| Help検索 合計ヒット | 27952 | 1247 | 6712 |
| 0件キーワード | 0* | 43 | 19 |
| AI top1 一致率 | — | 40.0% | 72.0% |
| 品質OK率 | — | 75.0% | 99.0% |
| 重要KW品質OK† | — | 100.0% | 100.0% |

*「含む」は全4394件が対象のため空クエリ以外はヒットあり
†重要KW = 会員登録・料金・AI・規約等24語（Featured/SEED系）

### 品質判定基準

- **Help検索:** `PlatformQaData.searchArticles` と同一スコアリング
- **AI検索:** `PlatformQaAiBridge.searchHits` と同一（top 1 件）
- **品質OK:** 除外後ヒット ≥1、かつ AI top1 が不変、または非 Archive 記事へ keep スコア同等以上で遷移

## 3. 判定

⚠️ **シナリオBでも要確認キーワードあり。** §5 を参照してください。

ℹ️ シナリオA（フル自動候補）は **一括 Archive には不向き** です。canonical まで除外されるため TLV/Talk 等が0件になります。段階的な変種整理（シナリオB）を推奨します。

- シナリオB 平均ヒット減: **212.4 件/クエリ**
- シナリオA 平均ヒット減: **267.0 件/クエリ**

## 4. シナリオB — 全キーワード比較

| # | キーワード | 含む | 除外 | Δ | AI top1一致 | 除外後top1 | 品質 |
|---|------------|------|------|---|-------------|------------|------|
| 1 | 会員登録 | 303 | 51 | 252 | ✓ | signup | OK |
| 2 | 退会 | 1 | 1 | 0 | ✓ | account-delete | OK |
| 3 | 料金 | 289 | 249 | 40 | ✗ | pricing | OK |
| 4 | プラン | 207 | 87 | 120 | ✓ | pro-plan | OK |
| 5 | パスワード | 83 | 83 | 0 | ✓ | password-reset | OK |
| 6 | ログイン | 136 | 83 | 53 | ✓ | oauth-login | OK |
| 7 | 検索 | 500 | 17 | 483 | ✓ | ai-web-search | OK |
| 8 | 掲載 | 576 | 103 | 473 | ✓ | featured-listing | OK |
| 9 | 応募 | 124 | 5 | 119 | ✓ | apply | OK |
| 10 | 支払い | 260 | 247 | 13 | ✓ | payment-method | OK |
| 11 | 請求 | 129 | 129 | 0 | ✓ | billing-history | OK |
| 12 | 解約 | 1 | 1 | 0 | ✓ | account-delete | OK |
| 13 | AI | 4343 | 936 | 3407 | ✓ | ai-workspace-start | OK |
| 14 | TASFUL AI | 1589 | 79 | 1510 | ✓ | ai-workspace-start | OK |
| 15 | 画像生成 | 0 | 0 | 0 | ✓ | — | OK |
| 16 | 音声入力 | 41 | 1 | 40 | ✓ | ai-voice | OK |
| 17 | モデル | 89 | 2 | 87 | ✓ | ai-model-select | OK |
| 18 | TLV | 600 | 15 | 585 | ✓ | tlv-start | OK |
| 19 | 配信 | 576 | 34 | 542 | ✗ | tlv-cohost | OK |
| 20 | ライブ | 242 | 6 | 236 | ✗ | tlv-chat | OK |
| 21 | 視聴 | 267 | 26 | 241 | ✗ | cookie-policy-viewer | OK |
| 22 | Talk | 488 | 12 | 476 | ✓ | talk-start | OK |
| 23 | 通話 | 122 | 3 | 119 | ✓ | talk-call | OK |
| 24 | Material | 398 | 9 | 389 | ✓ | material-start | OK |
| 25 | 素材 | 365 | 48 | 317 | ✗ | material-report | OK |
| 26 | 規約 | 321 | 282 | 39 | ✓ | terms-of-service | OK |
| 27 | プライバシー | 321 | 282 | 39 | ✗ | privacy-policy | OK |
| 28 | セキュリティ | 203 | 203 | 0 | ✓ | two-factor-q18 | OK |
| 29 | 二要素認証 | 7 | 7 | 0 | ✓ | two-factor-q32 | OK |
| 30 | トラブル | 122 | 122 | 0 | ✓ | trouble-support | OK |
| 31 | 問い合わせ | 41 | 41 | 0 | ✓ | contact-support | OK |
| 32 | サポート | 122 | 122 | 0 | ✓ | contact-support-q11 | OK |
| 33 | 直接取引 | 1 | 1 | 0 | ✓ | direct-trading | OK |
| 34 | スカウト | 0 | 0 | 0 | ✓ | — | OK |
| 35 | エラー | 47 | 1 | 46 | ✗ | ai-error | OK |
| 36 | 動かない | 40 | 1 | 39 | ✗ | ai-error | OK |
| 37 | 表示されない | 0 | 0 | 0 | ✓ | — | OK |
| 38 | 初心者 | 630 | 125 | 505 | ✗ | cookie-policy-q25 | OK |
| 39 | FAQ | 1 | 1 | 0 | ✓ | faq | OK |
| 40 | アカウント削除 | 1 | 1 | 0 | ✓ | account-delete | OK |
| 41 | パスワード再設定 | 1 | 1 | 0 | ✓ | password-reset | OK |
| 42 | クレジットカード | 41 | 41 | 0 | ✓ | payment-method-q11 | OK |
| 43 | 領収書 | 41 | 41 | 0 | ✓ | billing-history-q32 | OK |
| 44 | 返金 | 41 | 41 | 0 | ✓ | refund-policy | OK |
| 45 | 無料 | 44 | 4 | 40 | ✓ | ai-free-plan | OK |
| 46 | Pro | 179 | 45 | 134 | ✓ | ai-pro-plan | OK |
| 47 | アーカイブ | 40 | 1 | 39 | ✓ | tlv-archive | OK |
| 48 | 録画 | 41 | 2 | 39 | ✗ | tlv-archive | OK |
| 49 | ギフト | 80 | 2 | 78 | ✓ | tlv-gift | OK |
| 50 | 通報 | 155 | 83 | 72 | ✓ | material-report | OK |
| 51 | ブロック | 81 | 41 | 40 | ✓ | talk-block | OK |
| 52 | 通知 | 163 | 4 | 159 | ✓ | talk-notification | OK |
| 53 | 下書き | 0 | 0 | 0 | ✓ | — | OK |
| 54 | エクスポート | 82 | 42 | 40 | ✗ | data-export-q11 | OK |
| 55 | インポート | 0 | 0 | 0 | ✓ | — | OK |
| 56 | API | 41 | 1 | 40 | ✓ | platform-api | OK |
| 57 | OAuth | 54 | 1 | 53 | ✗ | oauth-login | OK |
| 58 | MFA | 41 | 41 | 0 | ✓ | two-factor | OK |
| 59 | 迷惑メール | 0 | 0 | 0 | ✓ | — | OK |
| 60 | 二重課金 | 0 | 0 | 0 | ✓ | — | OK |
| 61 | ログアウト | 0 | 0 | 0 | ✓ | — | OK |
| 62 | プロフィール | 83 | 4 | 79 | ✗ | profile-edit | OK |
| 63 | 掲載依頼 | 1 | 1 | 0 | ✓ | listing-request | OK |
| 64 | 業者 | 89 | 11 | 78 | ✗ | contact-vendor | OK |
| 65 | マッチング | 48 | 1 | 47 | ✗ | ai-search-mode | OK |
| 66 | お気に入り | 54 | 1 | 53 | ✓ | favorites | OK |
| 67 | 履歴 | 83 | 43 | 40 | ✓ | ai-chat-history | OK |
| 68 | フィルター | 41 | 1 | 40 | ✗ | search-filter | OK |
| 69 | 並び替え | 0 | 0 | 0 | ✓ | — | OK |
| 70 | スマホ | 40 | 1 | 39 | ✓ | mobile-app | OK |
| 71 | アプリ | 87 | 9 | 78 | ✗ | two-factor-q25 | OK |
| 72 | English | 541 | 110 | 431 | ✗ | cookie-policy-q28 | OK |
| 73 | 法人 | 744 | 166 | 578 | ✓ | commercial-use-q18 | OK |
| 74 | ビジネス | 40 | 1 | 39 | ✓ | business-directory | OK |
| 75 | クリエイター | 180 | 22 | 158 | ✗ | cookie-policy-creator | OK |
| 76 | 配信者 | 220 | 25 | 195 | ✗ | cookie-policy-streamer | OK |
| 77 | 視聴者 | 107 | 22 | 85 | ✗ | cookie-policy-viewer | OK |
| 78 | 案件 | 44 | 44 | 0 | ✓ | apply | OK |
| 79 | 見積もり | 0 | 0 | 0 | ✓ | — | OK |
| 80 | チャット | 170 | 4 | 166 | ✓ | tlv-chat | OK |
| 81 | 相談 | 4343 | 936 | 3407 | ✗ | ai-search | OK |
| 82 | ヘルプ | 4344 | 937 | 3407 | ✗ | faq | OK |
| 83 | 使い方 | 160 | 12 | 148 | ✗ | anpi-platform-q32 | OK |
| 84 | はじめて | 0 | 0 | 0 | ✓ | — | OK |
| 85 | 制限 | 108 | 41 | 67 | ✗ | minor-usage-q11 | OK |
| 86 | 上限 | 48 | 1 | 47 | ✓ | ai-usage-limit | OK |
| 87 | 容量 | 40 | 1 | 39 | ✗ | material-format | OK |
| 88 | ストレージ | 0 | 0 | 0 | ✓ | — | OK |
| 89 | バックアップ | 0 | 0 | 0 | ✓ | — | OK |
| 90 | 同期 | 0 | 0 | 0 | ✓ | — | OK |
| 91 | 遅い | 0 | 0 | 0 | ✓ | — | OK |
| 92 | 重い | 0 | 0 | 0 | ✓ | — | OK |
| 93 | 固まる | 0 | 0 | 0 | ✓ | — | OK |
| 94 | 接続 | 0 | 0 | 0 | ✓ | — | OK |
| 95 | オフライン | 7 | 0 | 7 | ✗ | — | 要確認 |
| 96 | 会員登録はどうやるの？ | 1 | 1 | 0 | ✓ | signup | OK |
| 97 | 利用料金はかかりますか？ | 1 | 1 | 0 | ✓ | pricing | OK |
| 98 | intermediate | 808 | 196 | 612 | ✓ | ai-billing | OK |
| 99 | 直接取引してもいいですか？ | 1 | 1 | 0 | ✓ | direct-trading | OK |
| 100 | beginner | 808 | 312 | 496 | ✗ | ai-error | OK |

## 5. シナリオB — 要注意キーワード

| キーワード | 含む | 除外 | AI top1（含む→除外） |
|------------|------|------|----------------------|
| オフライン | 7 | 0 | material-download-q25 → — |

## 6. シナリオA vs B 差分（ヒット数が大きく異なる語）

| キーワード | A除外後 | B除外後 | B−A |
|------------|---------|---------|-----|
| AI | 171 | 936 | 765 |
| 相談 | 171 | 936 | 765 |
| ヘルプ | 172 | 937 | 765 |
| beginner | 32 | 312 | 280 |
| 規約 | 43 | 282 | 239 |
| プライバシー | 43 | 282 | 239 |
| 料金 | 44 | 249 | 205 |
| 支払い | 42 | 247 | 205 |
| intermediate | 8 | 196 | 188 |
| 法人 | 29 | 166 | 137 |
| セキュリティ | 67 | 203 | 136 |
| 請求 | 20 | 129 | 109 |
| 初心者 | 20 | 125 | 105 |
| English | 5 | 110 | 105 |
| トラブル | 20 | 122 | 102 |

## 7. Archive 候補内訳（シナリオA）

| 区分 | 件数 |
|------|------|
| question-variant | 3641 |
| persona-variant | 481 |
| canonical | 85 |
| priority-category-held | 680 |
| seed-held | 0 |

## 8. 次ステップ（削除なし）

1. シナリオB（変種のみ）で curation UI から段階 archive
2. 8788 で Help 検索・AI 相談の実機確認
3. §5 の要確認語のみ人手レビュー
4. 問題なければ 30 日後 delete（既存フロー）

---

詳細 JSON: `reports/help-qa-archive-search-impact.json`