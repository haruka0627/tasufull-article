# Builder デモ UI · モック · プレースホルダ残存調査

**調査日:** 2026-07-04  
**種別:** 監査レポートのみ（実装 · DB · Edge · API · CSS · commit **なし**）  
**対象:** `builder/` 配下 HTML / JS / 関連アダプタ  
**根拠:** ソース静的調査（`builder.js` · `builder-config.js` · `builder-data-provider.js` · repositories · 各画面）

---

## 0. 総括（商用リリース観点）

| 判定 | 内容 |
| --- | --- |
| **全体** | UI は多くの画面で **見た目が整ったデモ / MVP**。**コアデータ層は localStorage + 固定 DEMO 配列**が主。 |
| **Supabase** | B3 データプロバイダは **未接続スタブ**（`isSupabaseEnabled() === false`）。 |
| **商用完成画面** | **なし**（実ユーザー永続・本番 API 前提の完成は未達）。 |
| **例外的な任意接続** | 条件検索 Repository（Supabase 設定時のみ試行 · 失敗時 demo）· Builder AI Draft（best-effort Supabase）· Builder AI Gateway（設定時）。 |
| **docs 上の「Production Ready · FROZEN」** | **UI/機能セットの完成度ラベル**であり、本調査の「本番データ接続済み」とは **一致しない**。商用データ接続は **別ゲート**。 |

### データ層の正本状態

| モジュール | 状態 |
| --- | --- |
| `builder.js` | 冒頭コメント: **「デモ表示のみ · DB / Supabase ロジックは扱わない」** · `DEMO_*` · `demo-owner-001` 等 |
| `builder-config.js` | `getStorageMode() → "local"` · `isSupabaseEnabled() → false` |
| `builder-data-provider.js` | **stub** · `getMvpStore() → null` |
| `builder-repositories-supabase.js` | **stub** · `isEnabled() → false` |
| `builder-repositories-local.js` | **空 stub** |
| `builder-mvp-store-local.js` / localStorage キー群 | MVP 案件 · スレッド · 通知等の **端末内永続** |
| `builder-project-store.js` | Project Hub 系 **localStorage** |
| `builder-partner-evaluation-store.js` | 評価 **localStorage** |
| `builder-contact-reveal.js` | **demo ストア** · 固定連絡先 |
| `builder-search-repository.js` | demo 配列既定 · Supabase **optional fallback** |
| `partner-mock-data.js` | 管理 UI 用 mock（`?mock=1`） |
| `builder-vendor-pages-ai-mock.js` | AI 文章 **API 未接続 mock** |

---

## 1. Business Directory との境界

| 項目 | 結論 |
| --- | --- |
| **BD 本体** | `business-directory/`（Owner / Admin / Public）— **Builder 配下にはない** |
| **Builder 内の BD 関連** | `vendor-pages.html` + `builder-vendor-pages-*.js` — **業者ページ管理（Builder 側）** |
| **連携状態** | UI 文言「Business Directory 掲載 ON（将来連携）」· バッジ「Business Directory掲載予定」· store コメント `listPublishedForBusinessDirectory()` — **未接続 · Future** |
| **協力会社検索** | `partners.html` は Builder マッチング用。BD 公開一覧とは **別プロダクト** |
| **混同リスク** | ナビ「業者ページ管理」が BD と誤解されやすい。現状は **Builder デモ + BD 将来連携プレースホルダ** |

**残タスク（境界）:** BD 公開掲載とのデータ契約 · 同期方針を仕様化し、Builder vendor-pages を「BD 連携」か「Builder 専用プロフィール」か明示する（実装は別 Epic）。

---

## 2. 画面別監査一覧

凡例:

- **状態:** 商用完成 / デモ / 未完成（プレースホルダ含む）
- **実データ:** 接続済み / Mock（localStorage·DEMO）/ 未接続 / 任意接続（設定時のみ）
- **UI 確認:** 本調査時点の Playwright 商用 E2E は **全体未実施**。一部 UI polish のみ（partners / find-workers / partner dashboard 等の週次監査）

---

### 2.1 ダッシュボード · ホーム

#### パートナー Dashboard（`index.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock（`DEMO_STATS_*` · `DEMO_RECENT_*` · localStorage） |
| **残タスク** | 実 KPI / 最近案件を Supabase 接続 · demo-partner リンク除去 · ロールを本番 Auth に接続 |
| **優先度** | **P0** |
| **UI** | 見た目は商用寄り · レスポンシブ CSS あり · Playwright: TOP 系 polish のみ |

#### 一般ユーザー Dashboard（`user-dashboard.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock（`DEMO_STATS_GENERAL_USER` · `DEMO_USER_*`） |
| **残タスク** | 実ユーザー案件・チャット要約接続 |
| **優先度** | **P0** |

#### Builder TOP（`builder-top.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock / 導線ハブ |
| **残タスク** | 本番エントリ方針の確定（index との役割分担） |
| **優先度** | **P1** |
| **UI** | UI polish Playwright あり（レイアウト） |

---

### 2.2 案件（MVP / Board / Project Hub）

#### 案件一覧 MVP（`mvp-projects.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock（`DEMO_PROJECTS` + localStorage MVP store） |
| **残タスク** | 本番 projects テーブル接続 · demo ID 排除 |
| **優先度** | **P0** |

#### 案件投稿（`mvp-post.html` / `mvp-project-new.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ（UI フローは一通り） |
| **実データ** | Mock（localStorage 書込） |
| **残タスク** | API 永続化 · バリデーション本番化 · 認証必須化 |
| **優先度** | **P0** |

#### 案件詳細 MVP（`mvp-project-detail.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock |
| **残タスク** | 実案件読込 · Talk thread 本番紐付け |
| **優先度** | **P0** |

#### Board 案件一覧 / 詳細（`board-projects.html` / `board-project-detail.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock（board adapter + listing-demo-catalog 参照あり） |
| **残タスク** | Board feed 本番化 · demo catalog 依存除去 |
| **優先度** | **P0** |

#### Project Hub（`project-hub.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ（Phase 6-A UI 完成度は高い） |
| **実データ** | Mock（`builder-project-store.js` = **localStorage**） |
| **残タスク** | ストアの Supabase 移行 |
| **優先度** | **P0** |
| **備考** | Node 回帰テストあり（ストア契約）。本番 DB ではない |

#### Project Dashboard（`project-dashboard.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock（localStorage） |
| **残タスク** | 実案件集計接続 |
| **優先度** | **P0** |

#### Project Detail / Calendar（`project-detail.html` / `project-calendar.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ（機能 UI は厚い） |
| **実データ** | Mock（localStorage · demo calendar events） |
| **残タスク** | カレンダーイベント本番化 · PDF「demo payload」除去 |
| **優先度** | **P0** |

#### MVP Calendar（`mvp-calendar.html`） / Admin Calendar（`admin-calendar.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock · ops bench demo イベント |
| **残タスク** | 運営手配フローの本番永続化 |
| **優先度** | **P0** |

#### パートナー案件割当（`partner-assignment.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock |
| **残タスク** | 受諾/拒否の本番 API |
| **優先度** | **P0** |

#### 再依頼（`re-request.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock（localStorage `MVP_RE_REQUESTS`） |
| **残タスク** | 本番化 |
| **優先度** | **P1** |

---

### 2.3 Talk 連携 · スレッド

#### MVP / Board Threads（`mvp-threads.html` / `board-threads.html` / `threads.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ（一覧 UI） |
| **実データ** | Mock（`thread-demo-*` · localStorage） |
| **残タスク** | 実 threadId 一覧 · Talk 本番同期 |
| **優先度** | **P0** |

#### Thread 詳細（`mvp-thread.html` / `board-thread.html` / `thread.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ / 移行中 |
| **実データ** | Mock · `demo-` ID 正規化あり |
| **残タスク** | 方針どおり **Talk へ寄せる**（Builder 内メッセージ UI は非推奨）· demo ID マップ削除 |
| **優先度** | **P0** |
| **備考** | `builder-talk-bridge.js` は Talk 遷移用。OWNER_ID = `demo-owner-001` |

#### Talk 入口（`mvp-talk.html` / `talk-thread-open.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ導線 |
| **実データ** | Mock thread 前提の遷移 |
| **残タスク** | 本番 thread 作成 API 接続 |
| **優先度** | **P0** |

#### Bench bridge（`bench-bridge.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ / 開発用 |
| **実データ** | Mock |
| **残タスク** | 商用から除外 or 開発専用フラグ |
| **優先度** | **P1** |

---

### 2.4 検索 · マッチング

#### 協力会社検索（`partners.html`） / 詳細（`partner.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ（UI は商用寄り polish 済） |
| **実データ** | Mock 既定（`DEMO_PARTNERS` · search-repository demo）· Supabase **任意**（未設定時 demo） |
| **残タスク** | 本番 partner profiles 必須化 · demo fallback を本番で禁止 · Contact Reveal 本番決済 |
| **優先度** | **P0** |
| **UI** | Playwright UI audit あり（レイアウト · タグ）· Console 0（静的表示時） |

#### ワーカー検索（`find-workers.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | **未完成 / デモ明示**（「準備中」· KPI `demo` · ボタン `data-builder-fw-demo`） |
| **実データ** | Mock（ページ内 `DEMO_WORKERS` + repository demo） |
| **残タスク** | 準備中ラベル除去前に本番データ · 詳細/お気に入りの実動作 |
| **優先度** | **P0**（出すなら）/ **P1**（検索を後回しにするなら） |
| **UI** | Playwright UI audit あり |

#### お気に入り（`favorites.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock（`DEMO_FAVORITES` Set · メモリ） |
| **残タスク** | ユーザー紐付け永続化 |
| **優先度** | **P1** |

---

### 2.5 テンプレート · 通知 · 設定

#### テンプレート（`templates.html` / `template-edit.html` / `mvp-templates.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock（`DEMO_TEMPLATES` + localStorage） |
| **残タスク** | 本番テンプレート API |
| **優先度** | **P1** |

#### 通知（`mvp-notifications.html` / `admin-notifications.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock（localStorage · NotificationAdapter） |
| **残タスク** | プッシュ / DB 通知接続 |
| **優先度** | **P0**（運用必須なら）/ **P1** |

#### 設定（`settings.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ（フォーム UI） |
| **実データ** | 未接続 / local 想定 |
| **残タスク** | 会社情報 · 通知設定の本番保存 |
| **優先度** | **P1** |

---

### 2.6 Admin

| 画面 | 状態 | 実データ | 残タスク | 優先度 |
| --- | --- | --- | --- | --- |
| `admin-partners.html` | デモ | Mock（`ADMIN_DEMO_PARTNERS` · localStorage） | 審査キュー本番化 | **P0** |
| `admin-applications.html` | デモ | Mock | 応募審査本番化 | **P0** |
| `admin-reviews.html` | デモ | Mock | レビュー運用接続 | **P1** |
| `admin-partner-evaluations.html` | デモ | Mock（eval localStorage） | 評価の本番永続 | **P1** |
| `admin-dispatch.html` | デモ | Mock | 手配本番化 | **P0** |
| `admin-calendar.html` | デモ | Mock | 運営カレンダー本番化 | **P0** |
| `partner-management.html` / `partner-detail.html` | デモ | Mock（`partner-mock-data.js` · `?mock=1`） | 本番審査データ | **P0** |

---

### 2.7 業者ページ · 請求 · 課金 UI

#### 業者ページ管理（`vendor-pages.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | **未完成**（ナビ「準備中」· バッジ「Pro（デモ）」） |
| **実データ** | Mock（local store）· AI は **mock**（`builder-vendor-pages-ai-mock.js`） |
| **残タスク** | BD 連携 or Builder 専用の方針確定 · AI API · 公開フロー本番化 |
| **優先度** | **P1**（BD 連携は **P2**） |

#### 請求書（`invoices.html`）

| 項目 | 内容 |
| --- | --- |
| **状態** | **未完成**（「準備中」明示 · 履歴 UI なし） |
| **実データ** | 未接続（billing-policy 文言のみ） |
| **残タスク** | 手数料・開示料履歴の本番一覧 |
| **優先度** | **P0**（課金運用するなら） |

#### Contact Reveal（モジュール）

| 項目 | 内容 |
| --- | --- |
| **状態** | デモ |
| **実データ** | Mock（固定連絡先 · localStorage 開示記録）· **Stripe 未接続** |
| **残タスク** | Checkout · webhook · 本番連絡先 | **P0**（課金開始時） |

---

### 2.8 Builder AI · 施工ツール

| 画面 / 領域 | 状態 | 実データ | 残タスク | 優先度 |
| --- | --- | --- | --- | --- |
| `builder-ai.html` | デモ〜機能完成（Gateway 任意） | Gateway 設定時は接続 / Draft は local + optional Supabase | 本番 entitlements · 課金ゲート | **P1** |
| `builder-ai-guidelines.html` | 商用寄り（静的） | 静的 | — | **P2** |
| `construction-tools.html` | デモ | ローカル計算 | AI コメント「準備中」解消 | **P1** |
| `tool-*.html`（見積・人工・材料・利益） | デモ（クライアント計算） | ローカル | 保存・案件紐付け本番 | **P1** |
| `tool-ai-*.html` | デモ | ローカル / AI 任意 | Gateway 本番品質 | **P1** |

---

### 2.9 その他

| 画面 | 状態 | 実データ | 残タスク | 優先度 |
| --- | --- | --- | --- | --- |
| `export-device-localStorage.html` | 開発用 | localStorage export | 商用ナビから除外 | **P1** |
| `mvp-partner-register.html` | デモ | Mock | 本番登録フロー | **P0** |

---

## 3. 横断所見（調査項目サマリ）

### ① UI 完成度

| 区分 | 画面例 |
| --- | --- |
| **見た目は商用寄りだがデータはデモ** | partners · partner dashboard · project-hub · project-detail |
| **デモ明示 / 準備中** | find-workers · invoices · vendor-pages · 一部 tool AI バッジ |
| **未完成プレースホルダ** | invoices（履歴なし）· vendor-pages（BD 将来） |

**商用完成（データ込み）と判定できる画面: 0**

### ② データ痕跡（代表）

| 種別 | 代表箇所 |
| --- | --- |
| **Mock / 固定配列** | `DEMO_PARTNERS` · `DEMO_PROJECTS` · `DEMO_JOBS` · `DEMO_WORKERS` · `ADMIN_DEMO_PARTNERS` · `partner-mock-data.js` |
| **仮 ID** | `demo-owner-001` · `demo-partner-001` · `thread-demo-*` · `job-demo-*` · `demo-builder-user` |
| **localStorage** | MVP store · project store · notifications · evaluations · contact reveals · templates |
| **TODO / 準備中文言** | find-workers · invoices · vendor-pages nav · tool AI badges |
| **仮 API / stub** | `builder-config` · `builder-data-provider` · `builder-repositories-supabase` |
| **PDF デモ** | `dummyPdfDataUrl` — "Real PDF generation is not implemented" |
| **console.log** | `builder.js` / `builder-ai-engine.js` に少数（致命的量ではない） |
| **未使用 / 空 stub** | `builder-repositories-local.js`（空オブジェクト） |

### ③ 実データ接続マトリクス

| レイヤ | 状態 |
| --- | --- |
| **B3 コア（案件・パートナー・スレッド）** | **ローカル Mock**（Supabase **無効固定**） |
| **条件検索** | **任意接続**（未設定時 demo） |
| **Builder AI Draft** | **任意接続**（失敗時 local） |
| **Builder AI Gateway** | **任意接続**（設定依存） |
| **Contact Reveal / 請求** | **未接続**（決済なし） |
| **BD 連携** | **完全未接続** |
| **Edge Functions（Builder 専用）** | **未使用**（本調査範囲で Builder 専用 Edge 配線なし） |

### ④ UI（レスポンシブ · Console · Playwright）

| 項目 | 結果 |
| --- | --- |
| **レスポンシブ** | 主要画面に 768/390 向け CSS あり。全体の商用 E2E は未実施 |
| **Console Error** | 本調査では全画面 Playwright 未実行。UI 週次監査対象（partners / find-workers / top）は **0** 実績あり |
| **Playwright 商用確認** | **未完了**（機能回帰は Node スクリプト中心 · データは local/demo） |
| **商用レベル UI** | 一部は見た目のみ到達。**データ・課金・Auth 未達のため商用リリース不可** |

### ⑤ 優先度まとめ

#### P0 — リリース前必須（データ接続・デモ除去）

1. B3 データ層の本番化（`builder-config` / DataProvider / Repositories の実配線）
2. 案件 CRUD · 一覧 · 詳細 · カレンダーの demo/localStorage 脱却
3. Talk thread 本番紐付け（demo thread ID マップ削除）
4. 協力会社検索の本番プロファイル必須化（demo fallback 禁止）
5. Admin 審査・手配キューの本番化
6. Auth / ロール（`demo-builder-user` · `demo-partner-*` 排除）
7. 課金を出す場合: Contact Reveal Stripe · invoices 実履歴
8. 商用ナビから「準備中」画面の扱い確定（隠す or 完成）

#### P1 — リリース後でも可

- お気に入り永続化
- テンプレート本番化
- 通知のプッシュ/高度化
- 設定画面の本番保存
- 施工ツールの案件紐付け
- Builder AI entitlements
- vendor-pages（BD 非依存の範囲）
- 開発用ページ（export / bench）の隔離

#### P2 — 将来機能

- Business Directory 自動連携（vendor-pages → BD）
- スポンサー広告（REL-F-13）
- Provider Boost / Credits（設計 Draft）
- AI おすすめ掲載枠

---

## 4. 推奨リリース判定（本調査のみ）

| ゲート | 判定 |
| --- | --- |
| **UI デモとして社内確認** | 可（現状どおり） |
| **商用リリース（実ユーザー・実課金）** | **No-Go** — コアが Mock / localStorage / demo ID |
| **docs「Production Ready · FROZEN」との関係** | UI 凍結ラベルと **本番データ接続は別問題**。商用データ接続完了まで **デモ残存は P0** |

---

## 5. 参照ファイル（調査キー）

- `builder/builder.js`（デモ中核）
- `builder/builder-config.js`
- `builder/builder-data-provider.js`
- `builder/builder-repositories-supabase.js`
- `builder/builder-search-repository.js`
- `builder/builder-contact-reveal.js`
- `builder/builder-project-store.js`
- `builder/builder-vendor-pages-*.js`
- `builder/partner-mock-data.js`
- `builder/find-workers.html` / `invoices.html` / `vendor-pages.html`
- `docs/AI/BUILDER_ARCHITECTURE.md` · `docs/AI/BUILDER_AI.md`

---

*本レポートは静的調査に基づく。全画面の 8788 Playwright 一括実行は未実施。実装変更は行っていない。*
