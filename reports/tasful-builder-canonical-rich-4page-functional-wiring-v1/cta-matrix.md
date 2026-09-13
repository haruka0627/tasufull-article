# CTA matrix

接続条件: **実ハンドラが存在するときだけ BOUND**。無ければ NOT_BOUND。偽の成功表示はしない。

| CTA | Surface | Handler | Status | 備考 |
|---|---|---|---|---|
| Talk | provider-detail / project-detail canonical | `main_thread_id` があるとき `mvp-talk.html?thread_id=` | BOUND only if thread | スレッド未作成は NOT_BOUND |
| 正式依頼 | 同上 | 無し | **NOT_BOUND** | クリックしても成功表示しない |
| 応募 | project-detail canonical | `TasuBuilderCtaBind.applyToMvp`（MVP applications 配列） | BOUND when job id | 一般フロー `applyGeneralFlowProject` は bench 専用のため流用しない |
| 質問 | 同上 | 無し | **NOT_BOUND** | |
| お気に入り | provider-detail / job panel | `tasful:builder:favorites-compat:v1` | BOUND | COMPAT_CACHE。SSOT ではない |
| 下書き保存 | new-project | sessionStorage draft | BOUND | SSOT ではない |
| 投稿 | new-project | `TasuBuilderJobCreateCore` | BOUND | flag ON + client で Staging |
| 登録 | provider-profile | `TasuBuilderPartnerRegisterCore` | BOUND | Sync 失敗時は cache のみと明示 |

実装: `builder/builder-cta-bind.js`。未接続ボタンは `data-cta-bind="NOT_BOUND"` + `aria-disabled`。
