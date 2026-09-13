# Phase 1 — Rich vs MVP functional diff

調査時点の `origin/cf-pages-deploy`（`b1e1d93`）には、仮説で挙げた `builder/new-project.html` / `provider-profile.html` / `provider-detail.html` / `builder-new-project-general-jobs-wire.js` / `builder-top-route-bridge.js` / `TasuBuilderPartnerSupabaseSync` / `TASU_BUILDER_GENERAL_JOBS_REPO` は**存在しなかった**。

添付スクリーンショット（ui4-03 / ui4-02）を視覚 SSOT とし、暗色 MVP 見た目は移植していない。機能は MVP から抽出した。

| Surface | Rich（canonical・視覚 SSOT） | MVP（機能ソース・LEGACY_COMPAT） | 差分（配線後） |
|---|---|---|---|
| Job create | `new-project.html` ライト UI。タイトル / カテゴリ / 詳細カテゴリ / 依頼詳細 + 住所・規模・時期キー。kind 等は hidden | `mvp-post.html` 暗色。全ポリシー露出。localStorage 直 commit | `persist` DualWrite。insert は `private_draft`。mapper が prefecture/city/address/postal_code/scale/desired_timing_note を保持。遷移 `project-detail.html?id=` |
| Job create (alt) | 同上 | `mvp-project-new.html` は mvp-post と同ハンドラ | 残置。コア未ロード時も redirect を canonical に変更 |
| Provider register | `provider-profile.html` ライト UI。種別 / 氏名 / ふりがな / 屋号 / 対応情報 | `mvp-partner-register.html` 暗色。display_name / trades / areas / availability / headline。自己ページへリロード | `TasuBuilderPartnerRegisterCore` → `TasuBuilderPartnerSupabaseSync` + `ProviderStore`。遷移は `provider-detail.html?id=` |
| Provider detail | `provider-detail.html` canonical id bind。id なしはデモプレースホルダ | なし（`partner.html` / `partner-detail.html` は別表面） | 実レコード bind。demo は本番扱いにしない |
| Job detail | `project-detail.html` に canonical パネル追加。既存 Project Hub（見積/請求）は hub id 時維持 | `mvp-project-detail.html` 暗色。応募 / スレッド / 再依頼 | job レコードなら canonical パネル。hub 案件なら既存 UI |
| Search → detail | カード id で canonical 詳細 | find-workers は「詳細」が coming-soon。partners は `partner.html?partner_id=` | provider → `provider-detail?id=` / jobs → `project-detail?id=` |
| TOP | `builder-top-route-bridge.js` | href 直書き `mvp-project-new.html` | `post_job` → `new-project.html`。IWASHO `/partner-register.html` は維持 |
| Persistence | Staging SSOT（flag ON） | localStorage が事実上の SSOT | localStorage は COMPAT_CACHE のみ |
| CTA | 実ハンドラのみ | 応募は MVP apply。Talk は thread があるとき。正式依頼 / 質問は無し | 無いものは NOT_BOUND。偽成功なし |

## 仮説の検証

| 仮説 | 結果 |
|---|---|
| new-project に `builder-new-project-general-jobs-wire.js` と dual-write がある | **棄却**。当該ファイルは git に無い。同等機能を `builder-job-create-core.js` + `builder-general-jobs-repo.js` + `builder-new-project-wire.js` として新設 |
| provider-profile は ProviderStore のみで PartnerSupabaseSync が無い | **部分棄却**。どちらも git に無かった。両方を新設し、save は Sync 先行 |
| TOP bridge が mvp-post / mvp-partner-register を向いている | **採択（方向）**。TOP は `mvp-project-new.html` 直リンクだった。bridge + href を Rich に変更。IWASHO は未変更 |
