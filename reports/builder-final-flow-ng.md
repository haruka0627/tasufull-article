# Builder 最終フロー NGレポート

生成: 2026-06-10T20:01:34.590Z

合計 NG: **0**

## ops_partner 2窓ベンチ

exit: FAIL

OK: 4 / NG: 0

（NGなし）

### ログ抜粋

```
OK ops toolbar
OK calendar iframes
OK calendar added — proj-cal-1781121531800-f45d97
OK project id set
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

page.click: Timeout 90000ms exceeded.
Call log:
  - waiting for locator('#opsAcceptBtn')
    - locator resolved to <button type="button" class="bench-btn" id="opsAcceptBtn">パートナー: 受ける</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

    at C:\Users\rubih\tasufull-article\scripts\verify-builder-ops-partner-bench.mjs:37:12 {
  name: 'TimeoutError'
}

Node.js v24.15.0
```

## Builder 2窓ベンチ（全フロー）

exit: PASS

OK: 25 / NG: 0

（NGなし）

### ログ抜粋

```
OK ops_partner boot — Builder 2窓 — 通知・やりとり確認
OK ops_partner iframes — 9 frames
OK ops_partner notification_created
OK ops_partner reply_visible
OK ops_partner mvp only
OK partner_user boot — Builder 2窓 — 通知・やりとり確認
OK partner_user iframes — 6 frames
OK partner_user notification_created
OK partner_user reply_visible
OK partner_user mvp only
OK user_user boot — Builder 2窓 — 通知・やりとり確認
OK user_user iframes — 6 frames
OK user_user notification_created
OK user_user reply_visible
OK user_user mvp only
OK vendor_user boot — Builder 2窓 — 通知・やりとり確認
OK vendor_user iframes — 6 frames
OK vendor_user notification_created
OK vendor_user reply_visible
OK vendor_user mvp only
OK board_project boot — Builder 2窓 — 通知・やりとり確認
OK board_project iframes — 6 frames
OK board_project notification_created
OK board_project reply_visible
OK board_project board only
25/25 passed
All builder dual-window checks passed
```

## スレッド種別

exit: PASS

OK: 9 / NG: 0

（NGなし）

### ログ抜粋

```
OK ops_partner list
OK partner_user list (user)
OK user_user list
OK vendor_user list
OK deprecated user_ops hidden
OK partner all list
OK user all list
OK partner_user detail
OK ops_partner detail
All thread type checks passed
```

## 手動確認URL

- ops_partner 2窓: `chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner`
- partner_user: `?builderFlow=partner_user`
- user_user: `?builderFlow=user_user`
- vendor_user: `?builderFlow=vendor_user`

## 追加診断キー（ops_partner copy NG）

- entry_at_saved / exit_at_saved
- entry_notification_created / exit_notification_created
- thread_exists_after_complete
- review_notification_created（一般案件のみ）
