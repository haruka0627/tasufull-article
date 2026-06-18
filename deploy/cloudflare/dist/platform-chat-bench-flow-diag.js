/**
 * ベンチ共通 — 期待状態 vs 実状態 → NG分類 → 修正対象
 */
(function (global) {
  "use strict";

  const pickStr = (...vals) => {
    for (const v of vals) {
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  const NG_CODES = Object.freeze({
    OK: "ok",
    DIAG_MISSING: "diag_missing",
    NOTIFICATION_MISSING: "notification_missing",
    RECIPIENT_MISMATCH: "recipient_mismatch",
    NOTIFICATION_DOM_MISSING: "notification_dom_missing",
    CTA_MISSING: "cta_missing",
    CTA_WRONG_HREF: "cta_wrong_href",
    THREAD_MISSING: "thread_missing",
    ROOM_MISSING: "room_missing",
    CHAT_LOAD_FAILED: "chat_load_failed",
    MESSAGE_SYNC_FAILED: "message_sync_failed",
    ROLE_MISMATCH: "role_mismatch",
    STATUS_MISMATCH: "status_mismatch",
    EXPECTED_BUTTON_MISSING: "expected_button_missing",
    PERMISSION_FALSE: "permission_false",
    DOM_NOT_CREATED: "dom_not_created",
    CSS_HIDDEN: "css_hidden",
    WRONG_TEXT: "wrong_text",
    COMPLETION_NOT_SAVED: "completion_not_saved",
    REVIEW_NOTIFICATION_MISSING: "review_notification_missing",
    REVIEW_TARGET_WRONG: "review_target_wrong",
    REVIEW_SAVE_FAILED: "review_save_failed",
    DUPLICATE_REVIEW_FAILED: "duplicate_review_failed",
    NOT_CHAT_DETAIL: "not_chat_detail",
    NO_MESSAGE: "no_message",
    A_USER_MISMATCH: "a_user_mismatch",
    B_USER_MISMATCH: "b_user_mismatch",
    A_NOT_PARTICIPANT: "a_not_participant",
    B_NOT_PARTICIPANT: "b_not_participant",
    COMPLETION_NOTIFY_RECIPIENT_MISMATCH: "completion_notify_recipient_mismatch",
    COMPLETION_NOTIFY_NOT_CREATED: "completion_notify_not_created",
    COMPLETION_NOTIFY_ROWS_MISSING: "completion_notify_rows_missing",
    REVIEW_NOTIFY_RECIPIENT_MISMATCH: "review_notify_recipient_mismatch",
    REVIEW_NOTIFY_NOT_CREATED: "review_notify_not_created",
    REVIEW_NOTIFY_ROWS_MISSING: "review_notify_rows_missing",
    A_NOTIFICATION_STORE_MISSING: "a_notification_store_missing",
    A_NOTIFICATION_ROWS_MISSING: "a_notification_rows_missing",
    A_NOTIFICATION_HREF_MISSING: "a_notification_href_missing",
    A_CHAT_FRAME_SRC_MISSING: "a_chat_frame_src_missing",
    A_CHAT_DETAIL_NOT_REACHED: "a_chat_detail_not_reached",
    CHAT_DETAIL_SCRIPT_NOT_LOADED: "chat_detail_script_not_loaded",
    A_CHAT_THREAD_UNRESOLVED: "a_chat_thread_unresolved",
    THREAD_RESOLVE_DIAG_MISSING: "thread_resolve_diag_missing",
    A_CHAT_ROOM_UNRESOLVED: "a_chat_room_unresolved",
    A_CHAT_COMPOSER_MISSING: "a_chat_composer_missing",
    A_CHAT_LOAD_READY_MISSING: "a_chat_load_ready_missing",
    DIAGNOSTIC_FALSE_POSITIVE: "diagnostic_false_positive",
    CHAT_DIAG_OK_BUT_ERROR_DOM_VISIBLE: "chat_diag_ok_but_error_dom_visible",
    CHAT_DIAG_OK_BUT_COMPOSER_MISSING_DOM: "chat_diag_ok_but_composer_missing_dom",
    NOTIFY_DIAG_OK_BUT_ROW_MISSING_DOM: "notify_diag_ok_but_row_missing_dom",
    NOTIFY_DIAG_OK_BUT_ERROR_DOM_VISIBLE: "notify_diag_ok_but_error_dom_visible",
    BENCH_STALE_STATE_DETECTED: "bench_stale_state_detected",
    BENCH_IFRAME_NOT_RELOADED_AFTER_RESET: "bench_iframe_not_reloaded_after_reset",
    BENCH_OLD_THREAD_REUSED: "bench_old_thread_reused",
    BENCH_OLD_NOTIFICATION_REUSED: "bench_old_notification_reused",
    PRODUCT_SHIPPING_NOTIFICATION_MISSING: "product_shipping_notification_missing",
    PRODUCT_RECEIVE_CONFIRM_UI_MISSING: "product_receive_confirm_ui_missing",
    PRODUCT_BANK_TRANSFER_RECEIVE_UI_MISSING: "product_bank_transfer_receive_ui_missing",
    PRODUCT_BANK_TRANSFER_FLOW_MISSING: "product_bank_transfer_flow_missing",
    PRODUCT_COD_FLOW_MISSING: "product_cod_flow_missing",
  });

  const CHAT_ERROR_TEXT_PATTERN = /チャットを開けませんでした|やりとりを開始できませんでした|読み込みに失敗/;
  const DIAG_DOM_FALSE_POSITIVE_CAUSE = "診断はOKだが、実DOMではNG";

  const JOB_POSTER_NOTIFY_TITLE = /応募者とのやりとり|やりとりを開始/;
  const JOB_APPLICANT_NOTIFY_TITLE = /応募が承諾されました|承諾されました/;
  const CHAT_STARTED_NOTIFY_TITLE = /やりとりが開始されました/;
  const MESSAGE_NOTIFY_TITLE = /新しいメッセージが届きました/;
  const PRODUCT_SHIPPING_NOTIFY_TITLE = /商品が発送されました|発送通知が届きました|発送されました/;
  const PRODUCT_RECEIVED_NOTIFY_TITLE = /商品の受取|受取を確認|受取確認|商品を受け取り/;
  const PRODUCT_RECEIVE_CONFIRM_BUTTON = /受け取り完了|受取確認|商品を受け取り/;
  const JOB_COMPLETION_APPROVED_NOTIFY_TITLE = /やり取り完了が承認|完了が承認され/;
  const JOB_REVIEW_RECEIVED_NOTIFY_TITLE = /レビューされました|評価されました/;

  const PURCHASE_RUNTIME_NOTIFY_PROFILES = new Set([
    "skill",
    "product",
    "worker",
    "business",
    "shop",
    "general",
  ]);

  const BENCH_NOTIFY_CAUSE = Object.freeze({
    CHAT_OPENED_NOT_VISIBLE: "chat_opened_notification_not_visible",
    CHAT_MESSAGE_NOT_VISIBLE: "chat_message_notification_not_visible",
    STORE_NOT_WRITTEN: "notification_store_not_written",
    IFRAME_NOT_UPDATED: "notification_iframe_not_updated",
    POSTMESSAGE_MISSING: "bench_parent_postmessage_missing",
  });

  const PRODUCT_SHIPPING_CAUSE = Object.freeze({
    REQUEST_NOT_NOTIFIED: "product_shipping_request_not_notified",
    RECIPIENT_WRONG: "product_shipping_recipient_wrong",
    STORE_NOT_WRITTEN: "product_shipping_notification_store_not_written",
    FILTERED_OUT: "product_shipping_notification_filtered_out",
    IFRAME_NOT_UPDATED: "product_shipping_notification_iframe_not_updated",
    POSTMESSAGE_MISSING: "product_shipping_postmessage_missing",
  });

  const PRODUCT_RECEIVE_CAUSE = Object.freeze({
    CTA_OPENED_WRONG_THREAD: "product_receive_cta_opened_wrong_thread",
    CURRENT_USER_WRONG: "product_receive_current_user_wrong",
    THREAD_STATE_NOT_LOADED: "product_receive_thread_state_not_loaded",
    PRODUCT_SHIPPED_STATE_MISSING: "product_receive_product_shipped_state_missing",
    CONFIRM_BUTTON_NOT_RENDERED: "product_receive_confirm_button_not_rendered",
    UI_BLOCKED_BY_FROZEN_IFRAME: "product_receive_ui_blocked_by_frozen_iframe",
  });

  const BANK_TRANSFER_CAUSE = Object.freeze({
    SHIPPING_READY_NOTIFICATION_MISSING: "shipping_ready_notification_missing",
    BANK_TRANSFER_REPORT_BUTTON_MISSING: "bank_transfer_report_button_missing",
    BANK_TRANSFER_REPORT_NOTIFICATION_MISSING: "bank_transfer_report_notification_missing",
    PAYMENT_CONFIRM_BUTTON_MISSING: "payment_confirm_button_missing",
    PRODUCT_SHIPPING_BEFORE_PAYMENT_ALLOWED: "product_shipping_before_payment_allowed",
    PRODUCT_SHIPPING_BUTTON_MISSING_AFTER_PAYMENT: "product_shipping_button_missing_after_payment",
    PRODUCT_RECEIVED_COMPLETE_BUTTON_MISSING: "product_received_complete_button_missing",
    PAYMENT_CONFIRMED_NOTIFICATION_MISSING: "payment_confirmed_notification_missing",
    BANK_TRANSFER_WRONG_SIDE_BUTTON_VISIBLE: "bank_transfer_wrong_side_button_visible",
  });

  const BANK_TRANSFER_RECEIVE_CAUSE = Object.freeze({
    PRODUCT_SHIPPED_B_UI_MISSING: "bank_transfer_product_shipped_b_ui_missing",
    RECEIVE_BUTTON_MISSING: "bank_transfer_receive_button_missing",
    THREAD_STATE_NOT_SYNCED: "bank_transfer_thread_state_not_synced",
    B_CHAT_NOT_RERENDERED: "bank_transfer_b_chat_not_rerendered",
    BENCH_DIAG_PANEL_NOT_INITIALIZED: "bench_diag_panel_not_initialized",
    BENCH_NG_PANEL_NOT_RENDERED: "bench_ng_panel_not_rendered",
  });

  const COD_CAUSE = Object.freeze({
    COD_SHIPPING_NOTIFICATION_MISSING: "cod_shipping_notification_missing",
    COD_PAYMENT_REPORT_BUTTON_MISSING: "cod_payment_report_button_missing",
    COD_PAYMENT_REPORT_NOTIFICATION_MISSING: "cod_payment_report_notification_missing",
    COD_CONFIRM_BUTTON_MISSING: "cod_confirm_button_missing",
    COD_CONFIRM_NOTIFICATION_MISSING: "cod_confirm_notification_missing",
    COD_COMPLETED_NOTIFICATION_MISSING: "cod_completed_notification_missing",
    COD_WRONG_SIDE_BUTTON_VISIBLE: "cod_wrong_side_button_visible",
    COD_REVIEW_NOT_AVAILABLE_AFTER_COMPLETE: "cod_review_not_available_after_complete",
  });

  const SHIPPING_READY_NOTIFY_TITLE = /発送準備が整いました|お支払いをお願いします/;
  const BANK_REPORTED_NOTIFY_TITLE = /銀行振込完了を報告|振込完了を報告/;
  const BANK_REPORTED_SELLER_NOTIFY_TITLE = /購入者が銀行振込完了を報告/;
  const PAYMENT_CONFIRMED_NOTIFY_TITLE = /入金確認が完了しました|商品の発送をお待ちください/;
  const COD_REPORTED_NOTIFY_TITLE = /商品受取と代金支払いを報告しました|受取と代金支払い/;
  const COD_CONFIRMED_NOTIFY_TITLE = /代引き回収確認が完了しました/;
  const PURCHASE_COMPLETED_NOTIFY_TITLE = /取引が完了しました/;
  const BANK_REPORT_BUTTON = /銀行振込が完了|振込完了を報告/;
  const PAYMENT_CONFIRM_BUTTON = /入金を確認/;
  const COD_REPORT_BUTTON = /受取・支払い完了を報告|商品受取・支払い/;
  const COD_CONFIRM_BUTTON = /代引き回収を確認/;
  const SHIPPING_READY_BUTTON = /発送準備完了/;
  const SHIP_BUTTON = /商品を発送|発送完了|発送しました/;

  const NOTIFY_DISPLAY_LOAD_META = Object.freeze({
    [NG_CODES.A_NOTIFICATION_STORE_MISSING]: {
      cause: "A 掲載者向け通知が localStorage (tasful_talk_notifications) に存在しません。",
      targetFile: "talk-platform-notify.js",
      targetFunction: "notifyJobHiredToPoster()",
    },
    [NG_CODES.A_NOTIFICATION_ROWS_MISSING]: {
      cause: "storage に A 向け通知はあるが、talk-home の rows に載っていません（filter / paint 問題）。",
      targetFile: "talk-home.js",
      targetFunction: "filterNotificationsByRecipient() / paintNotifyListCards()",
    },
    [NG_CODES.A_NOTIFICATION_HREF_MISSING]: {
      cause: "A 向け通知の href が未設定・#・chat-detail 以外で壊れています。",
      targetFile: "talk-platform-notify.js",
      targetFunction: "buildJobHireChatNotifyUrl()",
    },
    [NG_CODES.A_CHAT_FRAME_SRC_MISSING]: {
      cause: "A chat iframe の src が chat-detail.html を指していません。",
      targetFile: "chat-dual-window-demo.html",
      targetFunction: "openBenchFrameNavigate() / Live.chatUrl()",
    },
    [NG_CODES.A_CHAT_DETAIL_NOT_REACHED]: {
      cause: "A iframe が chat-detail.html に到達していません（init 未開始）。",
      targetFile: "chat-dual-window-demo.html",
      targetFunction: "openBenchFrameNavigate() / postBenchChatStarted()",
    },
    [NG_CODES.CHAT_DETAIL_SCRIPT_NOT_LOADED]: {
      cause: "A iframe は chat-detail.html に到達したが chat-detail.js が実行されていません（キャッシュ・読込失敗・先行 script エラー）。",
      targetFile: "chat-detail.html",
      targetFunction: "chat-detail.js script tag / onerror handler",
    },
    [NG_CODES.A_CHAT_THREAD_UNRESOLVED]: {
      cause: "chat-detail が URL の thread を解決できていません。",
      targetFile: "chat-thread-store.js",
      targetFunction: "resolveThreadAccess() / ensureChatThreadForAcceptedJob()",
    },
    [NG_CODES.THREAD_RESOLVE_DIAG_MISSING]: {
      cause: "chat-detail 到達後も thread解決内部トレースが publish されていません。",
      targetFile: "chat-detail.js",
      targetFunction: "publishBenchThreadResolveDiag() / invokeResolveThreadAccess()",
    },
    [NG_CODES.A_CHAT_ROOM_UNRESOLVED]: {
      cause: "thread はあるが room / loadRoom が解決できず「チャットを開けませんでした」になります。",
      targetFile: "chat-service.js",
      targetFunction: "resolveRoomIdFromLocation() / loadMessages()",
    },
    [NG_CODES.A_CHAT_COMPOSER_MISSING]: {
      cause: "chat-detail 到達後も composer (chatInput) が描画されていません。",
      targetFile: "chat-detail.js",
      targetFunction: "applyRoomComposerState() / renderRoomMessagesOrGate()",
    },
    [NG_CODES.A_CHAT_LOAD_READY_MISSING]: {
      cause: "chat-detail の init が完了せず chatLoadReady=false のままです。",
      targetFile: "chat-detail.js",
      targetFunction: "init() / publishChatDetailLoadDiag()",
    },
    [NG_CODES.BENCH_STALE_STATE_DETECTED]: {
      cause: "前回 run の bench 状態が残っており、再実行前にリセットが必要です。",
      targetFile: "chat-dual-window-demo.html",
      targetFunction: "resetBenchForRerun()",
    },
    [NG_CODES.BENCH_IFRAME_NOT_RELOADED_AFTER_RESET]: {
      cause: "リセット後も iframe が benchRunId / resetToken 未更新のままです。",
      targetFile: "chat-dual-window-demo.html",
      targetFunction: "setFrameSrc() / forceRemountAllFrames()",
    },
    [NG_CODES.BENCH_OLD_THREAD_REUSED]: {
      cause: "リセット前の threadId が store / iframe に残っています。",
      targetFile: "chat-thread-store.js",
      targetFunction: "purgeBenchListingThreads() / resetBenchRun()",
    },
    [NG_CODES.BENCH_OLD_NOTIFICATION_REUSED]: {
      cause: "リセット前の通知が storage に残っています。",
      targetFile: "talk-notifications-store.js",
      targetFunction: "purgeRecipientsNotifications()",
    },
    [NG_CODES.COMPLETION_NOTIFY_NOT_CREATED]: {
      cause: "B 完了承認後、A 掲載者向け完了承認通知が localStorage に作成されていません。",
      targetFile: "talk-platform-notify.js",
      targetFunction: "notifyJobCompletionApprovedToRequester()",
    },
    [NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH]: {
      cause: "完了承認通知の recipientUserId が掲載者(A) ではありません。",
      targetFile: "platform-chat-job-flow.js",
      targetFunction: "confirmJobEndFromApplicant() / notifyJobCompletionApprovedToRequester()",
    },
    [NG_CODES.COMPLETION_NOTIFY_ROWS_MISSING]: {
      cause: "完了承認通知は store にあるが A notify rows に表示されていません（filter / paint 問題）。",
      targetFile: "talk-home.js",
      targetFunction: "filterNotificationsByRecipient() / paintNotifyListCards()",
    },
    [NG_CODES.REVIEW_NOTIFY_NOT_CREATED]: {
      cause: "B レビュー送信後、A 掲載者向けレビュー通知が localStorage に作成されていません。",
      targetFile: "platform-chat-review-flow.js",
      targetFunction: "notifyReviewReceived() / handleReviewSubmitted()",
    },
    [NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH]: {
      cause: "レビュー通知の recipientUserId が掲載者(A) ではありません。",
      targetFile: "platform-chat-job-flow.js",
      targetFunction: "getJobReviewTargetUserId() / notifyReviewReceived()",
    },
    [NG_CODES.REVIEW_NOTIFY_ROWS_MISSING]: {
      cause: "レビュー通知は store にあるが A notify rows に表示されていません（filter / paint 問題）。",
      targetFile: "talk-home.js",
      targetFunction: "filterNotificationsByRecipient() / paintNotifyListCards()",
    },
  });

  const DIAG_DOM_CONSISTENCY_META = Object.freeze({
    [NG_CODES.DIAGNOSTIC_FALSE_POSITIVE]: {
      cause: DIAG_DOM_FALSE_POSITIVE_CAUSE,
      targetFile: "platform-chat-bench-flow-diag.js",
      targetFunction: "evaluateDiagDomConsistencyFailures()",
    },
    [NG_CODES.CHAT_DIAG_OK_BUT_ERROR_DOM_VISIBLE]: {
      cause: DIAG_DOM_FALSE_POSITIVE_CAUSE,
      targetFile: "chat-detail.js",
      targetFunction: "showRoomNotFound() / publishBenchChatDomDiag()",
    },
    [NG_CODES.CHAT_DIAG_OK_BUT_COMPOSER_MISSING_DOM]: {
      cause: DIAG_DOM_FALSE_POSITIVE_CAUSE,
      targetFile: "chat-detail.js",
      targetFunction: "applyRoomComposerState() / bindComposerInput()",
    },
    [NG_CODES.NOTIFY_DIAG_OK_BUT_ROW_MISSING_DOM]: {
      cause: DIAG_DOM_FALSE_POSITIVE_CAUSE,
      targetFile: "talk-home.js",
      targetFunction: "paintNotifyListCards() / publishBenchNotifyDomDiag()",
    },
    [NG_CODES.NOTIFY_DIAG_OK_BUT_ERROR_DOM_VISIBLE]: {
      cause: DIAG_DOM_FALSE_POSITIVE_CAUSE,
      targetFile: "talk-home.js",
      targetFunction: "renderNotifications() / paintNotifyListCards()",
    },
  });

  const STAGE_ORDER = Object.freeze(["notification", "cta", "chat", "completion", "review"]);

  const BENCH_CONSISTENCY_SECTION_KEYS = Object.freeze({
    USER_ID: "user_id_consistency",
    NOTIFY_DISPLAY_LOAD: "notify_display_load",
    COMPLETION_REVIEW_NOTIFY: "completion_review_notify",
    DIAG_DOM: "diag_dom_consistency",
  });

  const BENCH_CONSISTENCY_SECTION_NAMES = Object.freeze({
    [BENCH_CONSISTENCY_SECTION_KEYS.USER_ID]: "A/B userId 整合性",
    [BENCH_CONSISTENCY_SECTION_KEYS.NOTIFY_DISPLAY_LOAD]: "通知表示・chat-detail読込 整合性",
    [BENCH_CONSISTENCY_SECTION_KEYS.COMPLETION_REVIEW_NOTIFY]: "完了承認・レビュー通知 整合性",
    [BENCH_CONSISTENCY_SECTION_KEYS.DIAG_DOM]: "診断結果・実DOM一致チェック",
  });

  const BENCH_NG_SECTION_KEYS = Object.freeze({
    NOTIFY_DISPLAY_LOAD: "notify_display_load",
    DIAG_DOM: "diag_dom",
  });

  const VALID_DIAG_FOCUS = STAGE_ORDER;

  const NEXT_ACTION_HINTS = Object.freeze({
    [NG_CODES.NOTIFICATION_MISSING]: "通知レコード生成（talk-platform-notify）を確認してください。",
    [NG_CODES.RECIPIENT_MISMATCH]: "recipientUserId が B/A userId と一致するか確認してください。",
    [NG_CODES.A_USER_MISMATCH]: "A 側 iframe / talk-home / chat-detail の userId が掲載者と一致するか確認してください。",
    [NG_CODES.B_USER_MISMATCH]: "B 側 iframe / talk-home / chat-detail の userId が応募者と一致するか確認してください。",
    [NG_CODES.A_NOT_PARTICIPANT]: "threadParticipants に掲載者 userId が含まれるか確認してください。",
    [NG_CODES.B_NOT_PARTICIPANT]: "threadParticipants に応募者 userId が含まれるか確認してください。",
    [NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH]: "完了承認通知の recipient が掲載者(A) であるか確認してください。",
    [NG_CODES.COMPLETION_NOTIFY_NOT_CREATED]: "B 完了承認後の notifyJobCompletionApprovedToRequester を確認してください。",
    [NG_CODES.COMPLETION_NOTIFY_ROWS_MISSING]: "完了承認通知の talk-home filter / paint を確認してください。",
    [NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH]: "レビュー通知の recipient が掲載者(A) であるか確認してください。",
    [NG_CODES.REVIEW_NOTIFY_NOT_CREATED]: "B レビュー後の notifyReviewReceived を確認してください。",
    [NG_CODES.REVIEW_NOTIFY_ROWS_MISSING]: "レビュー通知の talk-home filter / paint を確認してください。",
    [NG_CODES.A_NOTIFICATION_STORE_MISSING]: "A 向け通知が storage に無いか確認してください。",
    [NG_CODES.A_NOTIFICATION_ROWS_MISSING]: "storage にある A 通知が talk-home rows に出ているか確認してください。",
    [NG_CODES.A_NOTIFICATION_HREF_MISSING]: "A 通知の href が chat-detail を指すか確認してください。",
    [NG_CODES.A_CHAT_FRAME_SRC_MISSING]: "A chat iframe src が chat-detail か確認してください。",
    [NG_CODES.A_CHAT_DETAIL_NOT_REACHED]: "A iframe が chat-detail に到達しているか確認してください。",
    [NG_CODES.A_CHAT_THREAD_UNRESOLVED]: "chat-detail の thread 解決を確認してください。",
    [NG_CODES.A_CHAT_ROOM_UNRESOLVED]: "chat-detail の room 解決を確認してください。",
    [NG_CODES.A_CHAT_COMPOSER_MISSING]: "chat-detail composer 描画を確認してください。",
    [NG_CODES.A_CHAT_LOAD_READY_MISSING]: "chatDetailLoadOk / chatLoadReady を確認してください。",
    [NG_CODES.DIAGNOSTIC_FALSE_POSITIVE]: "診断値と実DOMの矛盾を確認してください。",
    [NG_CODES.CHAT_DIAG_OK_BUT_ERROR_DOM_VISIBLE]: "chatLoadReady=true だが error DOM が visible です。",
    [NG_CODES.CHAT_DIAG_OK_BUT_COMPOSER_MISSING_DOM]: "chatLoadReady=true だが composer DOM がありません。",
    [NG_CODES.NOTIFY_DIAG_OK_BUT_ROW_MISSING_DOM]: "rows>0 だが通知カード DOM が 0 件です。",
    [NG_CODES.NOTIFY_DIAG_OK_BUT_ERROR_DOM_VISIBLE]: "通知診断OKだが error DOM が visible です。",
    [NG_CODES.NOTIFICATION_DOM_MISSING]: "talk-home.js の paintNotifyListCards() で iframe 描画を確認してください。",
    [NG_CODES.CTA_MISSING]: "通知カードの CTA ボタンが DOM visible か確認してください。",
    [NG_CODES.CTA_WRONG_HREF]: "buildNotifyHref() の遷移先 URL を確認してください。",
    [NG_CODES.THREAD_MISSING]: "ensureChatThread / createHireThread で thread を作成してください。",
    [NG_CODES.ROOM_MISSING]: "chat-service.js の resolveRoomIdFromLocation を確認してください。",
    [NG_CODES.CHAT_LOAD_FAILED]: "chat-detail が読み込まれ chatLoadReady になるよう同期してください。",
    [NG_CODES.DIAG_MISSING]: "A iframe から __tasuJobEndDebug を取得できるようにしてください。",
    [NG_CODES.NOT_CHAT_DETAIL]: "A/B chat iframe を chat-detail.html に遷移させてください。",
    [NG_CODES.NO_MESSAGE]: "チャットにメッセージが1件以上ある状態にしてください。",
    [NG_CODES.ROLE_MISMATCH]: "currentUserId と poster/applicant の対応を確認してください。",
    [NG_CODES.STATUS_MISMATCH]: "roomStatus / normalizedRoomStatus を確認してください。",
    [NG_CODES.PERMISSION_FALSE]: "canRequestEnd / canRequestCompletion の条件を確認してください。",
    [NG_CODES.EXPECTED_BUTTON_MISSING]: "renderCompletionBar() / updateJobRoomEndUi() でボタンを描画してください。",
    [NG_CODES.DOM_NOT_CREATED]: "chatJobEndBar / chatCompleteBtn DOM が作成されているか確認してください。",
    [NG_CODES.CSS_HIDDEN]: "chat-job-end-bar--visible 等の CSS で非表示になっていないか確認してください。",
    [NG_CODES.WRONG_TEXT]: "期待ボタン文言と actual を比較してください。",
    [NG_CODES.REVIEW_NOTIFICATION_MISSING]: "完了後のレビュー通知 / CTA を確認してください。",
    [NG_CODES.OK]: "このステージは OK です。",
  });

  const NG_PRIORITY = [
    NG_CODES.DIAG_MISSING,
    NG_CODES.NOTIFICATION_MISSING,
    NG_CODES.A_USER_MISMATCH,
    NG_CODES.B_USER_MISMATCH,
    NG_CODES.A_NOT_PARTICIPANT,
    NG_CODES.B_NOT_PARTICIPANT,
    NG_CODES.RECIPIENT_MISMATCH,
    NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH,
    NG_CODES.COMPLETION_NOTIFY_NOT_CREATED,
    NG_CODES.COMPLETION_NOTIFY_ROWS_MISSING,
    NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH,
    NG_CODES.REVIEW_NOTIFY_NOT_CREATED,
    NG_CODES.REVIEW_NOTIFY_ROWS_MISSING,
    NG_CODES.A_NOTIFICATION_STORE_MISSING,
    NG_CODES.A_NOTIFICATION_ROWS_MISSING,
    NG_CODES.A_NOTIFICATION_HREF_MISSING,
    NG_CODES.A_CHAT_FRAME_SRC_MISSING,
    NG_CODES.A_CHAT_DETAIL_NOT_REACHED,
    NG_CODES.A_CHAT_THREAD_UNRESOLVED,
    NG_CODES.A_CHAT_ROOM_UNRESOLVED,
    NG_CODES.A_CHAT_COMPOSER_MISSING,
    NG_CODES.A_CHAT_LOAD_READY_MISSING,
    NG_CODES.BENCH_STALE_STATE_DETECTED,
    NG_CODES.BENCH_IFRAME_NOT_RELOADED_AFTER_RESET,
    NG_CODES.BENCH_OLD_THREAD_REUSED,
    NG_CODES.BENCH_OLD_NOTIFICATION_REUSED,
    NG_CODES.DIAGNOSTIC_FALSE_POSITIVE,
    NG_CODES.CHAT_DIAG_OK_BUT_ERROR_DOM_VISIBLE,
    NG_CODES.CHAT_DIAG_OK_BUT_COMPOSER_MISSING_DOM,
    NG_CODES.NOTIFY_DIAG_OK_BUT_ROW_MISSING_DOM,
    NG_CODES.NOTIFY_DIAG_OK_BUT_ERROR_DOM_VISIBLE,
    NG_CODES.NOTIFICATION_DOM_MISSING,
    NG_CODES.CTA_MISSING,
    NG_CODES.CTA_WRONG_HREF,
    NG_CODES.THREAD_MISSING,
    NG_CODES.ROOM_MISSING,
    NG_CODES.CHAT_LOAD_FAILED,
    NG_CODES.ROLE_MISMATCH,
    NG_CODES.EXPECTED_BUTTON_MISSING,
    NG_CODES.WRONG_TEXT,
    NG_CODES.STATUS_MISMATCH,
    NG_CODES.PERMISSION_FALSE,
    NG_CODES.DOM_NOT_CREATED,
    NG_CODES.CSS_HIDDEN,
    NG_CODES.COMPLETION_NOT_SAVED,
    NG_CODES.REVIEW_NOTIFICATION_MISSING,
    NG_CODES.REVIEW_TARGET_WRONG,
    NG_CODES.MESSAGE_SYNC_FAILED,
    NG_CODES.REVIEW_SAVE_FAILED,
    NG_CODES.DUPLICATE_REVIEW_FAILED,
  ];

  const FIX_MAP = Object.freeze({
    [NG_CODES.DIAG_MISSING]: {
      files: ["platform-chat-bench-flow-diag.js", "chat-detail.js"],
      fns: ["refreshBenchJobEndDebug", "publishBenchJobEndDebug"],
    },
    [NG_CODES.NOTIFICATION_MISSING]: {
      files: ["talk-platform-notify.js", "talk-notifications-store.js"],
      fns: ["notify*", "upsertNotification"],
    },
    [NG_CODES.RECIPIENT_MISMATCH]: {
      files: ["talk-platform-notify.js"],
      fns: ["resolveRecipientUserId", "resolveDemoRecipientUserId"],
    },
    [NG_CODES.A_USER_MISMATCH]: {
      files: ["chat-dual-window-demo.html", "platform-chat-live-flow.js", "talk-home.js"],
      fns: ["buildUrls", "chatUrl", "refreshRecipientNotifyFrame"],
    },
    [NG_CODES.B_USER_MISMATCH]: {
      files: ["chat-dual-window-demo.html", "platform-chat-live-flow.js", "talk-home.js"],
      fns: ["buildUrls", "chatUrl", "refreshRecipientNotifyFrame"],
    },
    [NG_CODES.A_NOT_PARTICIPANT]: {
      files: ["chat-thread-store.js", "talk-platform-notify.js"],
      fns: ["createHireThread", "patchJobHireThreadParticipants"],
    },
    [NG_CODES.B_NOT_PARTICIPANT]: {
      files: ["chat-thread-store.js", "talk-platform-notify.js"],
      fns: ["createHireThread", "patchJobHireThreadParticipants"],
    },
    [NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH]: {
      files: ["talk-platform-notify.js", "platform-chat-job-flow.js"],
      fns: ["notifyJobCompletionApprovedToRequester", "confirmJobEndFromApplicant"],
    },
    [NG_CODES.COMPLETION_NOTIFY_NOT_CREATED]: {
      files: ["talk-platform-notify.js", "platform-chat-job-flow.js"],
      fns: ["notifyJobCompletionApprovedToRequester", "confirmJobEndFromApplicant"],
    },
    [NG_CODES.COMPLETION_NOTIFY_ROWS_MISSING]: {
      files: ["talk-home.js", "talk-chat-demo-review-mode.js"],
      fns: ["filterNotificationsByRecipient", "evaluateChatDemoReviewNotificationFilter"],
    },
    [NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH]: {
      files: ["platform-chat-review-flow.js", "platform-chat-job-flow.js"],
      fns: ["notifyReviewReceived", "getJobReviewTargetUserId"],
    },
    [NG_CODES.REVIEW_NOTIFY_NOT_CREATED]: {
      files: ["platform-chat-review-flow.js", "chat-service.js"],
      fns: ["notifyReviewReceived", "handleReviewSubmitted"],
    },
    [NG_CODES.REVIEW_NOTIFY_ROWS_MISSING]: {
      files: ["talk-home.js", "talk-chat-demo-review-mode.js"],
      fns: ["filterNotificationsByRecipient", "evaluateChatDemoReviewNotificationFilter"],
    },
    [NG_CODES.A_NOTIFICATION_STORE_MISSING]: {
      files: ["talk-platform-notify.js", "platform-chat-fee.js"],
      fns: ["notifyJobHiredToPoster", "notifyJobHireAfterPayment"],
    },
    [NG_CODES.A_NOTIFICATION_ROWS_MISSING]: {
      files: ["talk-home.js"],
      fns: ["filterNotificationsByRecipient", "paintNotifyListCards"],
    },
    [NG_CODES.A_NOTIFICATION_HREF_MISSING]: {
      files: ["talk-platform-notify.js", "talk-notify-actions.js"],
      fns: ["buildJobHireChatNotifyUrl", "resolveNotificationOpenHref"],
    },
    [NG_CODES.A_CHAT_FRAME_SRC_MISSING]: {
      files: ["chat-dual-window-demo.html", "platform-chat-live-flow.js"],
      fns: ["openBenchFrameNavigate", "chatUrl"],
    },
    [NG_CODES.A_CHAT_DETAIL_NOT_REACHED]: {
      files: ["chat-dual-window-demo.html", "platform-chat-bench-embed-bridge.js"],
      fns: ["openBenchFrameNavigate", "postBenchChatStarted"],
    },
    [NG_CODES.A_CHAT_THREAD_UNRESOLVED]: {
      files: ["chat-thread-store.js", "platform-chat-job-flow.js"],
      fns: ["resolveThreadAccess", "ensureJobThreadForAccess"],
    },
    [NG_CODES.A_CHAT_ROOM_UNRESOLVED]: {
      files: ["chat-service.js", "chat-detail.js"],
      fns: ["resolveRoomIdFromLocation", "loadMessages"],
    },
    [NG_CODES.A_CHAT_COMPOSER_MISSING]: {
      files: ["chat-detail.js"],
      fns: ["applyRoomComposerState", "setComposerEnabled"],
    },
    [NG_CODES.A_CHAT_LOAD_READY_MISSING]: {
      files: ["chat-detail.js"],
      fns: ["init", "publishChatDetailLoadDiag"],
    },
    [NG_CODES.BENCH_STALE_STATE_DETECTED]: {
      files: ["chat-dual-window-demo.html"],
      fns: ["resetBenchForRerun", "resetBenchRun"],
    },
    [NG_CODES.BENCH_IFRAME_NOT_RELOADED_AFTER_RESET]: {
      files: ["chat-dual-window-demo.html"],
      fns: ["setFrameSrc", "forceRemountAllFrames"],
    },
    [NG_CODES.BENCH_OLD_THREAD_REUSED]: {
      files: ["chat-thread-store.js", "platform-chat-live-flow.js"],
      fns: ["purgeBenchListingThreads", "resetBenchRun"],
    },
    [NG_CODES.BENCH_OLD_NOTIFICATION_REUSED]: {
      files: ["talk-notifications-store.js", "platform-chat-live-flow.js"],
      fns: ["purgeRecipientsNotifications", "resetBenchRun"],
    },
    [NG_CODES.DIAGNOSTIC_FALSE_POSITIVE]: {
      files: ["platform-chat-bench-flow-diag.js", "chat-detail.js"],
      fns: ["evaluateDiagDomConsistencyFailures", "publishBenchChatDomDiag"],
    },
    [NG_CODES.CHAT_DIAG_OK_BUT_ERROR_DOM_VISIBLE]: {
      files: ["chat-detail.js"],
      fns: ["showRoomNotFound", "publishBenchChatDomDiag"],
    },
    [NG_CODES.CHAT_DIAG_OK_BUT_COMPOSER_MISSING_DOM]: {
      files: ["chat-detail.js"],
      fns: ["applyRoomComposerState", "publishBenchChatDomDiag"],
    },
    [NG_CODES.NOTIFY_DIAG_OK_BUT_ROW_MISSING_DOM]: {
      files: ["talk-home.js"],
      fns: ["paintNotifyListCards", "publishBenchNotifyDomDiag"],
    },
    [NG_CODES.NOTIFY_DIAG_OK_BUT_ERROR_DOM_VISIBLE]: {
      files: ["talk-home.js"],
      fns: ["renderNotifications", "publishBenchNotifyDomDiag"],
    },
    [NG_CODES.NOTIFICATION_DOM_MISSING]: {
      files: ["talk-home.js"],
      fns: ["paintNotifyListCards", "filterNotificationsByRecipient"],
    },
    [NG_CODES.CTA_MISSING]: {
      files: ["talk-notify-actions.js"],
      fns: ["buildNotifyNavigateAction", "resolveNotificationOpenHref"],
    },
    [NG_CODES.CTA_WRONG_HREF]: {
      files: ["talk-notify-actions.js", "platform-chat-dual-window-flow.js"],
      fns: ["buildNotifyHref", "buildInitialNotifyHref"],
    },
    [NG_CODES.THREAD_MISSING]: {
      files: ["chat-thread-store.js"],
      fns: ["createHireThread", "ensureChatThread"],
    },
    [NG_CODES.ROOM_MISSING]: {
      files: ["chat-service.js"],
      fns: ["resolveRoomIdFromLocation", "resolveThreadAccess"],
    },
    [NG_CODES.CHAT_LOAD_FAILED]: {
      files: ["chat-detail.js", "chat-service.js"],
      fns: ["init", "loadMessages"],
    },
    [NG_CODES.MESSAGE_SYNC_FAILED]: {
      files: ["chat-service.js", "chat-thread-store.js"],
      fns: ["saveMessage", "getMessages"],
    },
    [NG_CODES.ROLE_MISMATCH]: {
      files: ["platform-chat-category-flow.js", "platform-chat-job-flow.js"],
      fns: ["resolveActorRole", "isJobPoster", "isJobApplicant"],
    },
    [NG_CODES.STATUS_MISMATCH]: {
      files: ["chat-room-status.js", "platform-chat-category-flow-config.js"],
      fns: ["resolveRoomLifecycleStatus", "resolveFlowStage"],
    },
    [NG_CODES.EXPECTED_BUTTON_MISSING]: {
      files: ["platform-chat-category-flow-config.js", "chat-detail.js"],
      fns: ["updateJobRoomEndUi", "updateCompleteButton", "renderCompletionBar"],
    },
    [NG_CODES.PERMISSION_FALSE]: {
      files: ["platform-chat-job-flow.js", "platform-chat-completion-flow.js"],
      fns: ["canRequestEnd", "canConfirmEnd", "canRequestCompletion"],
    },
    [NG_CODES.DOM_NOT_CREATED]: {
      files: ["chat-detail.js", "chat-detail.html"],
      fns: ["updateJobEndComposerBar", "renderCompletionBar"],
    },
    [NG_CODES.CSS_HIDDEN]: {
      files: ["chat.css", "platform-chat-bench-embed.css"],
      fns: ["chat-job-end-bar--visible"],
    },
    [NG_CODES.COMPLETION_NOT_SAVED]: {
      files: ["platform-chat-job-flow.js", "platform-chat-completion-flow.js"],
      fns: ["requestJobConversationEnd", "confirmJobEndFromApplicant", "requestCompletion"],
    },
    [NG_CODES.REVIEW_NOTIFICATION_MISSING]: {
      files: ["talk-platform-notify.js"],
      fns: ["notifyJobCompleted", "notifyCompletionReview"],
    },
    [NG_CODES.REVIEW_TARGET_WRONG]: {
      files: ["platform-chat-review-flow.js"],
      fns: ["getReviewTargetUserId", "getJobReviewTargetUserId"],
    },
    [NG_CODES.REVIEW_SAVE_FAILED]: {
      files: ["platform-chat-review-flow.js"],
      fns: ["submitReview", "hasUserSubmittedReview"],
    },
    [NG_CODES.NOT_CHAT_DETAIL]: {
      files: ["chat-dual-window-demo.html", "talk-notify-actions.js"],
      fns: ["openBenchFrameNavigate", "syncBenchChatOpenedFromIframe"],
    },
    [NG_CODES.NO_MESSAGE]: {
      files: ["platform-chat-job-flow.js", "chat-thread-store.js"],
      fns: ["hasAnyMessage", "resolveJobMessageList"],
    },
  });

  function makeStageVerdict(stage, status, code, evidence, options) {
    const opts = options || {};
    const fix = FIX_MAP[code] || {};
    const isOk = status === "OK";
    const isSkip = status === "SKIP";
    return {
      stage,
      status,
      ngCategory: isOk ? "ok" : isSkip ? "—" : code,
      targetFile: isOk || isSkip ? "—" : pickStr(opts.targetFile, fix.files?.[0], "—"),
      targetFunction: isOk || isSkip ? "—" : pickStr(opts.targetFunction, fix.fns?.[0], "—"),
      evidence: pickStr(evidence, opts.skipReason, "—"),
      nextActionHint: isSkip
        ? "—"
        : pickStr(opts.nextActionHint, NEXT_ACTION_HINTS[code], "—"),
      skipReason: pickStr(opts.skipReason),
      primaryRootCause: pickStr(opts.primaryRootCause),
    };
  }

  function isBApplicantActiveOk(bEnd) {
    if (!bEnd) return true;
    return (
      bEnd.buttonHiddenReason === "applicant_active_no_button" ||
      (!bEnd.requestButtonVisible && !bEnd.buttonVisible && pickStr(bEnd.actualButton, "none") === "none")
    );
  }

  function buildNotificationVerdict(snapshot, stages) {
    const n = stages.notification;
    const uc = stages.userConsistency;
    const ucFailures = evaluateUserConsistencyFailures(snapshot, uc);
    const userFail = ucFailures.find(
      (f) => f.code === NG_CODES.A_USER_MISMATCH || f.code === NG_CODES.B_USER_MISMATCH
    );
    if (userFail) {
      return makeStageVerdict("notification", "NG", userFail.code, userFail.detail, {
        primaryRootCause: userFail.detail,
      });
    }
    const { failures: displayFailures } = evaluateBenchDisplayFailures(snapshot, stages);
    const notifyFail = displayFailures.find((f) => f.stage === "notification");
    if (notifyFail) {
      return makeStageVerdict("notification", "NG", notifyFail.code, notifyFail.detail, {
        primaryRootCause: notifyFail.cause,
        targetFile: notifyFail.targetFile,
        targetFunction: notifyFail.targetFunction,
        evidence: `expected=${notifyFail.expected} actual=${notifyFail.actual} diff=${notifyFail.diff}`,
      });
    }
    const lines = [];
    if (!n.notificationExists && !snapshot.ctx?.hiredRow) {
      const exp =
        snapshot.targetSide === "A" ? n.expectedNotificationA : n.expectedNotificationB;
      return makeStageVerdict(
        "notification",
        "NG",
        NG_CODES.NOTIFICATION_MISSING,
        `notificationExists=false, expected=${exp}`,
        {
          primaryRootCause: `期待通知が未生成（${exp}）`,
        }
      );
    }
    lines.push(`notificationExists=${n.notificationExists}`);
    lines.push(`recipientMatches=${n.recipientMatches}`);
    lines.push(`iframe cards=${n.iframeCardCount}`);
    if (n.notificationExists && !n.recipientMatches) {
      return makeStageVerdict(
        "notification",
        "NG",
        NG_CODES.RECIPIENT_MISMATCH,
        lines.join(", "),
        { primaryRootCause: "recipientUserId が bench userId と不一致" }
      );
    }
    if (n.notificationExists && !n.notificationDomVisible) {
      return makeStageVerdict(
        "notification",
        "NG",
        NG_CODES.NOTIFICATION_DOM_MISSING,
        lines.join(", "),
        { primaryRootCause: "storage に通知ありだが iframe カード未描画" }
      );
    }
    return makeStageVerdict("notification", "OK", NG_CODES.OK, lines.join(", ") || "通知 OK");
  }

  function buildCtaVerdict(snapshot, stages) {
    const c = stages.cta;
    const ucFailures = evaluateUserConsistencyFailures(snapshot, stages.userConsistency);
    const participantFail = ucFailures.find(
      (f) => f.code === NG_CODES.A_NOT_PARTICIPANT || f.code === NG_CODES.B_NOT_PARTICIPANT
    );
    if (participantFail) {
      return makeStageVerdict("cta", "NG", participantFail.code, participantFail.detail, {
        primaryRootCause: participantFail.detail,
      });
    }
    const lines = [
      `ctaHref=${c.ctaHref ? "set" : "—"}`,
      `threadExists=${c.threadExists}`,
      `roomExists=${c.roomExists}`,
      `chatLookupResult=${c.chatLookupResult}`,
      `ctaDomVisible=${c.ctaVisible}`,
    ];
    if (c.ctaHref && !c.threadExists) {
      return makeStageVerdict(
        "cta",
        "NG",
        NG_CODES.THREAD_MISSING,
        lines.join(", "),
        { primaryRootCause: `thread 未作成 (${c.ctaThreadId || "—"})` }
      );
    }
    if (c.ctaHref && c.threadExists && !c.roomExists) {
      return makeStageVerdict(
        "cta",
        "NG",
        NG_CODES.ROOM_MISSING,
        lines.join(", "),
        { primaryRootCause: "room が thread store に存在しない" }
      );
    }
    if (c.ctaHref && !/chat-detail\.html/i.test(c.ctaHref) && c.threadExists) {
      return makeStageVerdict(
        "cta",
        "NG",
        NG_CODES.CTA_WRONG_HREF,
        `${lines.join(", ")}, href=${c.ctaHref}`,
        { primaryRootCause: "CTA href が chat-detail を指していない" }
      );
    }
    if (nHasNotifyDom(stages) && c.ctaHref && !c.ctaVisible) {
      return makeStageVerdict(
        "cta",
        "NG",
        NG_CODES.CTA_MISSING,
        lines.join(", "),
        { primaryRootCause: "通知 CTA ボタンが DOM visible ではない" }
      );
    }
    if (!c.ctaHref && !c.threadExists) {
      return makeStageVerdict("cta", "SKIP", NG_CODES.OK, "通知/CTA 未到達", {
        skipReason: "通知未到達のため CTA 未評価",
      });
    }
    return makeStageVerdict("cta", "OK", NG_CODES.OK, lines.join(", "));
  }

  function nHasNotifyDom(stages) {
    return stages.notification?.notificationDomVisible === true;
  }

  function buildChatVerdict(snapshot, stages) {
    const ch = stages.chat;
    const { failures: displayFailures } = evaluateBenchDisplayFailures(snapshot, stages);
    const chatFail = displayFailures.find((f) => f.stage === "chat");
    if (chatFail) {
      return makeStageVerdict("chat", "NG", chatFail.code, chatFail.detail, {
        primaryRootCause: chatFail.cause,
        targetFile: chatFail.targetFile,
        targetFunction: chatFail.targetFunction,
        evidence: `expected=${chatFail.expected} actual=${chatFail.actual} diff=${chatFail.diff}`,
      });
    }
    const lines = [
      `chatOpenedA=${ch.chatOpenedA}`,
      `chatOpenedB=${ch.chatOpenedB}`,
      `chatLoadReadyA=${ch.chatLoadReadyA}`,
      `chatLoadReadyB=${ch.chatLoadReadyB}`,
      `composerVisibleA=${ch.composerVisibleA}`,
      `composerVisibleB=${ch.composerVisibleB}`,
    ];
    const anyOpened = ch.chatOpenedA || ch.chatOpenedB;
    if (!anyOpened) {
      return makeStageVerdict(
        "chat",
        "NG",
        NG_CODES.CHAT_LOAD_FAILED,
        `${lines.join(", ")}`,
        { primaryRootCause: "chat-detail がどちらの iframe でも未読込" }
      );
    }
    const anyReady = ch.chatLoadReadyA || ch.chatLoadReadyB;
    if (!anyReady) {
      return makeStageVerdict(
        "chat",
        "NG",
        NG_CODES.CHAT_LOAD_FAILED,
        lines.join(", "),
        { primaryRootCause: "chat-detail 読込未完了 (chatLoadReady=false)" }
      );
    }
    const composerOk =
      snapshot.stage === "completed" || snapshot.stage === "closed"
        ? true
        : ch.composerVisibleA || ch.composerVisibleB || ch.composerEnabledA || ch.composerEnabledB;
    if (!composerOk) {
      return makeStageVerdict(
        "chat",
        "NG",
        NG_CODES.CHAT_LOAD_FAILED,
        lines.join(", "),
        { primaryRootCause: "chat composer が visible ではない" }
      );
    }
    return makeStageVerdict(
      "chat",
      "OK",
      NG_CODES.OK,
      `chatLoadReady=${anyReady}, composerVisible=${ch.composerVisibleA || ch.composerVisibleB}`
    );
  }

  function buildCompletionVerdict(snapshot, stages, jobEnd) {
    const comp = stages.completion;
    const aEnd = jobEnd?.a;
    const bEnd = jobEnd?.b;
    const flowStage = snapshot.stage;
    const actorALabel = snapshot.config?.actorA?.label || "A";

    if (snapshot.category === "job" && (aEnd || bEnd)) {
      const expA = pickStr(comp.expectedCompletionButtonA, "終了を依頼する");
      const expB = pickStr(comp.expectedCompletionButtonB, "none");
      const bNote = isBApplicantActiveOk(bEnd) ? "B active none は正常" : "";

      if (!aEnd?.isChatDetail) {
        return makeStageVerdict(
          "completion",
          "NG",
          NG_CODES.NOT_CHAT_DETAIL,
          [
            `A iframe URL: ${pickStr(aEnd?.chatHref, "—")}`,
            `A iframe stage: ${pickStr(aEnd?.stage, "not_chat_detail")}`,
            bNote,
          ]
            .filter(Boolean)
            .join("\n"),
          {
            primaryRootCause: "A側が chat-detail を開いていないため終了ボタン診断不可",
          }
        );
      }
      if (!aEnd?.diagExists || !aEnd?.debugInjected) {
        return makeStageVerdict(
          "completion",
          "NG",
          NG_CODES.DIAG_MISSING,
          [
            `A diag = ${aEnd?.diagExists ? "partial" : "null"}`,
            `B diag = ${bEnd?.diagExists ? "exists" : "null"}`,
            bEnd?.buttonHiddenReason ? `B buttonHiddenReason=${bEnd.buttonHiddenReason}` : "",
            bNote,
          ]
            .filter(Boolean)
            .join("\n"),
          {
            targetFile: "chat-detail.js",
            targetFunction: "publishBenchJobEndDebug()",
            primaryRootCause: "A掲載者 iframe の JOB END DEBUG が未取得",
          }
        );
      }

      if (flowStage === "active" || !flowStage) {
        if (aEnd.currentUserId && aEnd.posterUserId && aEnd.currentUserId !== aEnd.posterUserId) {
          return makeStageVerdict(
            "completion",
            "NG",
            NG_CODES.ROLE_MISMATCH,
            `A currentUserId=${aEnd.currentUserId}, posterUserId=${aEnd.posterUserId}\n${bNote}`,
            { primaryRootCause: "A currentUserId ≠ posterUserId" }
          );
        }
        if (!aEnd.hasAnyMessage) {
          return makeStageVerdict(
            "completion",
            "NG",
            NG_CODES.NO_MESSAGE,
            `A hasAnyMessage=false\n${bNote}`,
            { primaryRootCause: "A hasAnyMessage=false のため終了ボタン判定不可" }
          );
        }
        if (expA !== "none" && !aEnd.canRequestEnd) {
          return makeStageVerdict(
            "completion",
            "NG",
            NG_CODES.PERMISSION_FALSE,
            [
              `A expectedButton=${expA}`,
              `A actualButton=${pickStr(aEnd.actualButton, "none")}`,
              `A canRequestEnd=false`,
              `A buttonHiddenReason=${pickStr(aEnd.buttonHiddenReason, "—")}`,
              bNote,
            ].join("\n"),
            { primaryRootCause: `A${actorALabel} canRequestEnd=false` }
          );
        }
        if (expA !== "none" && !aEnd.chatJobEndBarExists) {
          return makeStageVerdict(
            "completion",
            "NG",
            NG_CODES.DOM_NOT_CREATED,
            `A expectedButton=${expA}, A actualButton=none, chatJobEndBarExists=false\n${bNote}`,
            { primaryRootCause: `A${actorALabel}の「${expA}」DOM未作成` }
          );
        }
        if (expA !== "none" && !aEnd.requestButtonVisible && !aEnd.requestEndButtonVisible) {
          const code = aEnd.chatJobEndBarExists ? NG_CODES.CSS_HIDDEN : NG_CODES.EXPECTED_BUTTON_MISSING;
          return makeStageVerdict(
            "completion",
            "NG",
            code,
            [
              `A expectedButton=${expA}`,
              `A actualButton=${pickStr(aEnd.actualButton, "none")}`,
              `A requestButtonVisible=false`,
              bNote,
            ].join("\n"),
            {
              primaryRootCause: `A${actorALabel}の「${expA}」が未表示`,
            }
          );
        }
        if (expA !== "none" && !/終了を依頼する/.test(pickStr(aEnd.actualButton))) {
          return makeStageVerdict(
            "completion",
            "NG",
            NG_CODES.WRONG_TEXT,
            `A expectedButton=${expA}, A actualButton=${pickStr(aEnd.actualButton, "none")}\n${bNote}`,
            { primaryRootCause: `A actualButton 文言不一致` }
          );
        }
        if (bEnd?.requestButtonVisible && /終了を依頼する/.test(pickStr(bEnd.actualButton))) {
          return makeStageVerdict(
            "completion",
            "NG",
            NG_CODES.ROLE_MISMATCH,
            `B に終了依頼ボタンが表示されている`,
            { primaryRootCause: "B応募者に「終了を依頼する」が表示されている" }
          );
        }
        return makeStageVerdict(
          "completion",
          "OK",
          NG_CODES.OK,
          `A expectedButton=${expA}, A actualButton=${pickStr(aEnd.actualButton, expA)}, ${bNote}`,
          { primaryRootCause: `A${actorALabel}「${expA}」OK` }
        );
      }
    }

    const aBtn = evaluateSideButton("A", snapshot);
    const bBtn = evaluateSideButton("B", snapshot);
    const lines = [
      `A expectedButton=${comp.expectedCompletionButtonA}`,
      `A actualButton=${comp.actualCompletionButtonA}`,
      `A visible=${comp.completionButtonVisibleA}`,
      `B expectedButton=${comp.expectedCompletionButtonB}`,
      `B actualButton=${comp.actualCompletionButtonB}`,
      `B visible=${comp.completionButtonVisibleB}`,
    ];
    if (!aBtn.ok) {
      return makeStageVerdict(
        "completion",
        "NG",
        aBtn.code,
        `${lines.join("\n")}${aBtn.note ? `\n(${aBtn.note})` : ""}`,
        {
          primaryRootCause:
            aBtn.expected !== "none"
              ? `A${actorALabel}の「${aBtn.expected}」が未表示`
              : aBtn.note || aBtn.code,
        }
      );
    }
    if (!bBtn.ok && bBtn.expected !== "none") {
      return makeStageVerdict(
        "completion",
        "NG",
        bBtn.code,
        lines.join("\n"),
        { primaryRootCause: `Bの「${bBtn.expected}」が未表示` }
      );
    }
    const bOkNote =
      bBtn.expected === "none" && snapshot.stage === "active" ? "B active none は正常" : "";
    return makeStageVerdict(
      "completion",
      "OK",
      NG_CODES.OK,
      `${lines.join("\n")}${bOkNote ? `\n${bOkNote}` : ""}`
    );
  }

  function buildReviewVerdict(snapshot, stages) {
    const r = stages.review;
    const uc = stages.userConsistency;
    const ucFailures = evaluateUserConsistencyFailures(snapshot, uc);
    const notifyRecipientFail = ucFailures.find(
      (f) =>
        f.code === NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH ||
        f.code === NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH
    );
    if (notifyRecipientFail) {
      return makeStageVerdict("review", "NG", notifyRecipientFail.code, notifyRecipientFail.detail, {
        primaryRootCause: notifyRecipientFail.detail,
      });
    }
    const closed =
      snapshot.stage === "completed" ||
      snapshot.stage === "closed" ||
      ["closed", "completed"].includes(pickStr(snapshot.roomStatus).toLowerCase());
    if (!closed) {
      return makeStageVerdict("review", "SKIP", NG_CODES.OK, "completion未完了", {
        skipReason: "completion未完了",
      });
    }
    const lines = [
      `reviewCtaVisibleA=${r.reviewCtaVisibleA}`,
      `reviewCtaVisibleB=${r.reviewCtaVisibleB}`,
      `reviewNotificationA=${r.reviewNotificationA}`,
      `reviewNotificationB=${r.reviewNotificationB}`,
    ];
    if (!r.reviewCtaVisibleA || !r.reviewCtaVisibleB) {
      return makeStageVerdict(
        "review",
        "NG",
        NG_CODES.REVIEW_NOTIFICATION_MISSING,
        lines.join(", "),
        { primaryRootCause: "レビュー CTA / 通知が未表示" }
      );
    }
    return makeStageVerdict("review", "OK", NG_CODES.OK, lines.join(", "));
  }

  function buildStageVerdicts(snapshot, options) {
    const stages = buildStageDiagnostics(snapshot, options);
    const jobEnd = options?.jobEnd || snapshot.jobEnd || null;
    return {
      notification: buildNotificationVerdict(snapshot, stages),
      cta: buildCtaVerdict(snapshot, stages),
      chat: buildChatVerdict(snapshot, stages),
      completion: buildCompletionVerdict(snapshot, stages, jobEnd),
      review: buildReviewVerdict(snapshot, stages),
      stages,
    };
  }

  const CURSOR_FIX_TEMPLATES = Object.freeze({
    [NG_CODES.NOTIFICATION_MISSING]: {
      targetFile: "talk-platform-notify.js",
      targetFunction: "notifyPurchaseChatStartedAfterPayment()",
      causeHint: "購入後の通知が storage / iframe DOM / postMessage のいずれかで未達です。",
      todos: [
        "notifyPurchaseChatStartedAfterPayment / notifyDemoChatMessage を確認",
        "talk-home の filter / paint で通知 iframe に表示されるか確認",
        "platform-chat-dual-window-notify の postMessage を確認",
      ],
      done: [
        "購入後 A/B 双方に「やりとりが開始されました」が通知 iframe に visible",
        "A/B 送信後、相手側に「新しいメッセージが届きました」が visible",
        "localStorage / store / iframe DOM が一致",
      ],
    },
    [NG_CODES.NOTIFICATION_DOM_MISSING]: {
      targetFile: "talk-home.js",
      targetFunction: "paintNotifyListCards()",
      causeHint: "notificationExists=true なのに iframe cards=0 です。",
      todos: [
        "paintNotifyListCards() でカード DOM が生成されるか確認",
        "filterNotificationsByRecipient() で除外されていないか確認",
      ],
      done: ["通知 iframe に .talk-notify-card が visible", "notificationDomVisible=true"],
    },
    [NG_CODES.RECIPIENT_MISMATCH]: {
      targetFile: "talk-platform-notify.js",
      targetFunction: "resolveRecipientUserId()",
      causeHint: "recipientUserId が bench userId と一致しません。",
      todos: ["recipient 解決ロジックを確認"],
      done: ["recipientMatches=true"],
    },
    [NG_CODES.A_USER_MISMATCH]: {
      targetFile: "chat-dual-window-demo.html",
      targetFunction: "buildUrls() / refreshRecipientNotifyFrame()",
      causeHint: "A 側 iframe / talk-home / chat-detail の userId が掲載者と不一致です。",
      todos: [
        "frame-a-notify / frame-a-chat の URL userId を確認",
        "Live.chatUrl() が partnerAId を渡しているか確認",
      ],
      done: ["actualA* が expectedAUserId と一致"],
    },
    [NG_CODES.B_USER_MISMATCH]: {
      targetFile: "chat-dual-window-demo.html",
      targetFunction: "buildUrls() / refreshRecipientNotifyFrame()",
      causeHint: "B 側 iframe / talk-home / chat-detail の userId が応募者と不一致です。",
      todos: [
        "frame-b-notify / frame-b-chat の URL userId を確認",
        "Live.chatUrl() が partnerBId を渡しているか確認",
      ],
      done: ["actualB* が expectedBUserId と一致"],
    },
    [NG_CODES.A_NOT_PARTICIPANT]: {
      targetFile: "chat-thread-store.js",
      targetFunction: "createHireThread() / patchJobHireThreadParticipants()",
      causeHint: "threadParticipants に掲載者が含まれていません。",
      todos: ["posterUserId / threadParticipants を thread 作成時に設定"],
      done: ["isAInThreadParticipants=true"],
    },
    [NG_CODES.B_NOT_PARTICIPANT]: {
      targetFile: "chat-thread-store.js",
      targetFunction: "createHireThread() / patchJobHireThreadParticipants()",
      causeHint: "threadParticipants に応募者が含まれていません。",
      todos: ["applicantUserId / threadParticipants を thread 作成時に設定"],
      done: ["isBInThreadParticipants=true"],
    },
    [NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH]: {
      targetFile: "talk-platform-notify.js",
      targetFunction: "notifyJobCompletionApprovedToRequester()",
      causeHint: "完了承認通知の recipient が掲載者(A) ではありません。",
      todos: ["notifyCompletionApprovedToRequester の recipientUserId を確認"],
      done: ["completionNotifyRecipient=expectedAUserId"],
    },
    [NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH]: {
      targetFile: "platform-chat-review-flow.js",
      targetFunction: "notifyPlatformReviewReceived()",
      causeHint: "レビュー通知の recipient が掲載者(A) ではありません。",
      todos: ["reviewNotifyRecipient / reviewedUserId を確認"],
      done: ["reviewNotifyRecipient=expectedAUserId"],
    },
    [NG_CODES.CTA_MISSING]: {
      targetFile: "talk-notify-actions.js",
      targetFunction: "buildNotifyNavigateAction()",
      causeHint: "通知カードの CTA ボタンが DOM visible ではありません。",
      todos: ["CTA ボタン DOM と actionLabel を確認"],
      done: ["ctaDomVisible=true"],
    },
    [NG_CODES.CTA_WRONG_HREF]: {
      targetFile: "talk-notify-actions.js",
      targetFunction: "buildNotifyHref() / resolveNotifyHref()",
      causeHint: "CTA href と thread/room が不一致です。",
      todos: ["buildNotifyHref() の遷移先 URL を確認", "threadId / roomId が href に含まれるか確認"],
      done: ["CTA href が chat-detail.html を指す", "threadExists=true / roomExists=true"],
    },
    [NG_CODES.THREAD_MISSING]: {
      targetFile: "chat-thread-store.js",
      targetFunction: "ensureChatThread()",
      causeHint: "CTA 遷移前に thread が存在しません。",
      todos: ["CTA 前に ensureChatThread / createHireThread で thread を作成・保存"],
      done: ["threadExists=true"],
    },
    [NG_CODES.ROOM_MISSING]: {
      targetFile: "chat-service.js",
      targetFunction: "resolveRoomIdFromLocation()",
      causeHint: "thread/roomId 解決に失敗しています。",
      todos: ["resolveRoomIdFromLocation() と resolveThreadAccess() を確認"],
      done: ["roomExists=true"],
    },
    [NG_CODES.CHAT_LOAD_FAILED]: {
      targetFile: "chat-detail.js",
      targetFunction: "initChatDetail() / renderChatRoom()",
      causeHint: "chat-detail の読込または composer 表示に失敗しています。",
      todos: [
        "chatDetailLoadErrorReason を根拠に init を確認",
        "iframe 同期（openBenchFrameNavigate）を確認",
      ],
      done: ["chatLoadReady=true", "composerVisible=true"],
    },
    [NG_CODES.DIAG_MISSING]: {
      targetFile: "chat-detail.js",
      targetFunction: "publishBenchJobEndDebug()",
      causeHint: "A iframe から __tasuJobEndDebug が取得できません。",
      todos: [
        "publishBenchJobEndDebug() が bench embed 時に呼ばれるか確認",
        "collectJobEndDiagFromFrame() で A/B を分離取得しているか確認",
      ],
      done: ["A __tasuJobEndDebug が取得できる", "JOB END DEBUG パネルが注入される"],
    },
    [NG_CODES.NOT_CHAT_DETAIL]: {
      targetFile: "chat-dual-window-demo.html",
      targetFunction: "openBenchFrameNavigate()",
      causeHint: "A/B chat iframe が chat-detail.html を開いていません。",
      todos: ["CTA 遷移 / chat iframe sync で chat-detail を開く"],
      done: ["A iframe stage=chat_detail"],
    },
    [NG_CODES.EXPECTED_BUTTON_MISSING]: {
      targetFile: "chat-detail.js",
      targetFunction: "renderCompletionBar() / updateCompleteButton()",
      causeHint: "expectedButton が DOM 生成されていません。",
      todos: [
        "renderCompletionBar() / updateJobRoomEndUi() でボタン DOM が生成されるか確認",
        "canRequestEnd=true の場合は必ず期待ラベルを表示",
        "ボタンを composer 直上に visible で配置",
        "B 応募者 active 時の非表示は維持",
      ],
      done: [
        "A 掲載者側に期待ボタンが DOM visible",
        "B active 時はボタン非表示",
        "DOM visible E2E が PASS",
      ],
    },
    [NG_CODES.PERMISSION_FALSE]: {
      targetFile: "platform-chat-job-flow.js",
      targetFunction: "canRequestEnd() / canConfirmEnd()",
      causeHint: "権限判定が false のためボタンが出ません。",
      todos: [
        "canRequestEnd() / canConfirmEnd() / canRequestCompletion() を確認",
        "hasAnyMessage / posterUserId / roomStatus の条件を確認",
      ],
      done: ["canRequestEnd=true（active 掲載者）", "期待ボタンが visible"],
    },
    [NG_CODES.DOM_NOT_CREATED]: {
      targetFile: "chat-detail.js",
      targetFunction: "updateJobEndComposerBar() / renderCompletionBar()",
      causeHint: "完了ボタン用 DOM が作成されていません。",
      todos: ["#chatJobEndBar / #chatJobEndBarBtn / chatJobEndDebug の存在を確認"],
      done: ["chatJobEndBarExists=true", "ボタン DOM visible"],
    },
    [NG_CODES.CSS_HIDDEN]: {
      targetFile: "chat.css",
      targetFunction: "chat-job-end-bar--visible",
      causeHint: "DOM はあるが CSS/hidden で visible=false です。",
      todos: [
        "#chatJobEndBar / .chat-job-end-bar__btn--visible の CSS を確認",
        "platform-chat-bench-embed.css の iframe 内表示を確認",
      ],
      done: ["requestButtonVisible=true", "bounding box > 0"],
    },
    [NG_CODES.WRONG_TEXT]: {
      targetFile: "chat-detail.js",
      targetFunction: "getJobEndButtonState() / updateJobEndComposerBar()",
      causeHint: "ボタン文言が期待と不一致です。",
      todos: ["getJobEndButtonState() の label と actual を比較"],
      done: ["actualButton が expectedButton と一致"],
    },
    [NG_CODES.NO_MESSAGE]: {
      targetFile: "platform-chat-job-flow.js",
      targetFunction: "hasAnyMessage() / resolveJobMessageList()",
      causeHint: "hasAnyMessage=false のため終了ボタン判定が止まっています。",
      todos: ["メッセージ同期と resolveJobMessageList を確認"],
      done: ["hasAnyMessage=true"],
    },
    [NG_CODES.ROLE_MISMATCH]: {
      targetFile: "platform-chat-job-flow.js",
      targetFunction: "resolveJobPosterUserId() / getJobEndButtonState()",
      causeHint: "A/B の userId と poster/applicant の対応が崩れています。",
      todos: ["currentUserId と posterUserId の一致を確認", "B に掲載者専用ボタンが出ていないか確認"],
      done: ["A currentUserId=posterUserId", "B active none は正常"],
    },
    [NG_CODES.REVIEW_NOTIFICATION_MISSING]: {
      targetFile: "talk-platform-notify.js",
      targetFunction: "notifyReview*",
      causeHint: "完了後のレビュー通知または CTA が未表示です。",
      todos: ["A/B 双方のレビュー通知生成を確認", "reviewCtaVisible を確認"],
      done: ["reviewCtaVisibleA/B=true"],
    },
    [NG_CODES.REVIEW_TARGET_WRONG]: {
      targetFile: "platform-chat-review-flow.js",
      targetFunction: "resolveReviewTarget()",
      causeHint: "reviewer/target の逆転ルールが崩れています。",
      todos: ["getReviewTargetUserId() / resolveReviewTarget() を確認"],
      done: ["reviewTargetA/B が正しい相手を指す"],
    },
    [NG_CODES.REVIEW_SAVE_FAILED]: {
      targetFile: "platform-chat-review-flow.js",
      targetFunction: "saveReview()",
      causeHint: "レビュー保存または重複防止に失敗しています。",
      todos: ["submitReview() と hasUserSubmittedReview() を確認"],
      done: ["reviewSubmitted が保存される", "duplicateReviewBlocked が機能"],
    },
    [NG_CODES.OK]: {
      targetFile: "—",
      targetFunction: "—",
      causeHint: "このステージは OK です。",
      todos: ["修正不要"],
      done: ["現状維持"],
    },
    [NG_CODES.PRODUCT_BANK_TRANSFER_RECEIVE_UI_MISSING]: {
      targetFile: "chat-detail.js",
      targetFunction: "updateJobEndComposerBar() / tasu-chat-reload-room",
      causeHint: "銀行振込・発送後に B 側の受取確認 UI（ステータス通知・配送カード・受取ボタン）が未反映です。",
      todos: [
        "productShipped 後に B チャットへ softSyncBenchChatRoomState が届いているか確認",
        "受取ボタン・chatRoomStatusNotice・配送カードの DOM を確認",
        "frozen iframe 時は postMessage reload-room で再描画",
      ],
      done: [
        "B チャットに受取確認ボタン・発送ステータス・配送カードが表示",
        "A 側に受取ボタンが出ない",
        "NG count 0",
      ],
    },
    [NG_CODES.PRODUCT_BANK_TRANSFER_FLOW_MISSING]: {
      targetFile: "platform-chat-purchase-payment-flow.js",
      targetFunction: "markShippingReady() / reportBankTransfer() / confirmBankPayment()",
      causeHint: "銀行振込フローの通知またはボタンが不足、または入金前発送が許可されています。",
      todos: [
        "振込報告→入金確認→発送→受取の順序を確認",
        "canMarkProductShipped が paymentConfirmed を要求するか確認",
        "notifyDemoShippingReady / notifyDemoBankTransferReported / notifyDemoPaymentConfirmed を確認",
      ],
      done: [
        "bank_transfer 全ステップで A/B 通知とボタンが正しい側に表示",
        "入金確認前に A が発送できない",
        "NG count 0",
      ],
    },
    [NG_CODES.PRODUCT_COD_FLOW_MISSING]: {
      targetFile: "platform-chat-purchase-payment-flow.js",
      targetFunction: "reportCodPayment() / confirmCodCollection()",
      causeHint: "代引きフローの通知またはボタンが不足、または A/B ボタンが逆です。",
      todos: [
        "発送→B報告→A代引き確認→完了の順序を確認",
        "notifyDemoProductShipped(COD) / notifyDemoCodPaymentReported / notifyDemoCodConfirmed を確認",
      ],
      done: [
        "cash_on_delivery 全ステップで通知とボタンが正しい側に表示",
        "完了後にレビュー導線あり",
        "NG count 0",
      ],
    },
  });

  function buildCompletionEvidenceBullets(panel) {
    const aEnd = panel?.snapshot?.jobEnd?.a || panel?.jobEnd?.a;
    const bEnd = panel?.snapshot?.jobEnd?.b || panel?.jobEnd?.b;
    const comp = panel?.stages?.completion || panel?.verdicts?.completion;
    const bullets = [];
    if (comp) {
      bullets.push(`A expectedButton=${pickStr(comp.expectedCompletionButtonA, "—")}`);
      bullets.push(`A actualButton=${pickStr(comp.actualCompletionButtonA, "none")}`);
      bullets.push(`A expectedVisible=${comp.expectedCompletionButtonA !== "none"}`);
      bullets.push(`A actualVisible=${comp.completionButtonVisibleA === true}`);
    }
    if (aEnd) {
      bullets.push(`A roomStatus=${pickStr(aEnd.normalizedRoomStatus, aEnd.roomStatus, "—")}`);
      bullets.push(`A hasAnyMessage=${aEnd.hasAnyMessage === true}`);
      bullets.push(`A canRequestEnd=${aEnd.canRequestEnd === true}`);
    }
    if (isBApplicantActiveOk(bEnd)) bullets.push("B active none は正常");
    return bullets;
  }

  function generateCursorFixInstruction(panel) {
    const p = panel || {};
    const focus = pickStr(p.focus, "completion");
    const primary = p.primary || {};
    const categoryLabel = pickStr(p.categoryLabel, p.category, "—");
    const code = primary.ngCategory || NG_CODES.OK;
    const template = CURSOR_FIX_TEMPLATES[code] || {
      targetFile: pickStr(primary.targetFile, "—"),
      targetFunction: pickStr(primary.targetFunction, "—"),
      causeHint: pickStr(p.primaryRootCause, primary.evidence),
      todos: [pickStr(primary.nextActionHint, "該当ステージの NG を修正")],
      done: ["該当ステージが OK になる"],
    };

    if (primary.status === "SKIP") {
      const text = [
        "Cursor修正指示:",
        "",
        `${categoryLabel}フローの ${focus} ステージは現時点で修正できません。`,
        "",
        "理由:",
        "前段ステージ未完了のため修正不可",
        "",
        `SKIP根拠: ${pickStr(primary.skipReason, primary.evidence)}`,
        "",
        "やること:",
        "- 先に前段ステージ（notification / cta / chat）を OK にしてください",
        "",
        "完了条件:",
        `- ${focus} ステージが SKIP ではなく判定可能になる`,
      ].join("\n");
      return { text, focus, status: "SKIP" };
    }

    if (primary.status === "OK") {
      const text = [
        "Cursor修正指示:",
        "",
        `${categoryLabel}フローの ${focus} ステージは OK です。修正不要です。`,
        "",
        `根拠: ${pickStr(primary.evidence, p.primaryRootCause)}`,
      ].join("\n");
      return { text, focus, status: "OK" };
    }

    const targetFile = pickStr(primary.targetFile, template.targetFile);
    const targetFunction = pickStr(primary.targetFunction, template.targetFunction);
    const cause =
      code === NG_CODES.EXPECTED_BUTTON_MISSING && p.category === "job"
        ? `A掲載者側で expectedButton=終了を依頼する ですが、actualButton=none になっています。`
        : pickStr(p.primaryRootCause, template.causeHint, primary.evidence);

    const evidenceBullets =
      focus === "completion" && p.category === "job"
        ? buildCompletionEvidenceBullets(p)
        : String(primary.evidence || "")
            .split(/\n|,/)
            .map((s) => s.trim())
            .filter(Boolean);

    const todos = Array.isArray(template.todos) ? template.todos : [];
    const done =
      focus === "completion" && p.category === "job" && code === NG_CODES.EXPECTED_BUTTON_MISSING
        ? [
            "A掲載者側に「終了を依頼する」が visible",
            "B応募者 active 時はボタン非表示",
            "Aクリック後、Bに「やり取りを完了する」が visible",
            "DOM visible E2E が PASS",
          ]
        : template.done || [];

    const lines = [
      "Cursor修正指示:",
      "",
      `${categoryLabel}フローの ${focus} ステージを修正してください。`,
      "",
      "対象カテゴリ:",
      categoryLabel,
      "",
      "対象ステージ:",
      focus,
      "",
      "NG分類:",
      code,
      "",
      "修正対象:",
      targetFile,
      "",
      "修正関数:",
      targetFunction,
      "",
      "原因:",
      cause,
      "",
      "根拠:",
      ...evidenceBullets.map((b) => `- ${b}`),
      "",
      "やること:",
      ...todos.map((t) => `- ${t}`),
      "",
      "完了条件:",
      ...done.map((d) => `- ${d}`),
    ];

    return {
      text: lines.join("\n"),
      focus,
      status: "NG",
      code,
      targetFile,
      targetFunction,
    };
  }

  function resolvePrimaryFocus(diagFocus, stageVerdicts, category) {
    const verdicts = stageVerdicts || {};
    const explicit = VALID_DIAG_FOCUS.includes(diagFocus) ? diagFocus : "";
    if (explicit) {
      const primary = verdicts[explicit] || {};
      const primaryRootCause =
        primary.primaryRootCause ||
        (primary.status === "OK"
          ? `${explicit} OK`
          : primary.status === "SKIP"
            ? primary.skipReason
            : primary.evidence);
      return { focus: explicit, primary, primaryRootCause };
    }
    let focus = "";
    if (!focus) {
      if (category === "job" && verdicts.completion?.status === "NG") {
        focus = "completion";
      } else {
        for (const key of STAGE_ORDER) {
          if (verdicts[key]?.status === "NG") {
            focus = key;
            break;
          }
        }
      }
    }
    if (!focus) {
      focus = verdicts.completion?.status !== "SKIP" ? "completion" : "notification";
    }
    const primary = verdicts[focus] || {};
    const primaryRootCause =
      primary.primaryRootCause ||
      (primary.status === "OK"
        ? `${focus} OK`
        : primary.status === "SKIP"
          ? primary.skipReason
          : primary.evidence);
    return { focus, primary, primaryRootCause };
  }

  function formatTargetFileLink(file, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const f = pickStr(file);
    if (!f || f === "—") return esc("—");
    return (
      `<button type="button" class="bench-verdict__target-link" data-bench-copy-target="${esc(f)}" title="クリックでコピー">${esc(f)}</button>`
    );
  }

  function extractCursorDoneCondition(panel) {
    const p = panel || {};
    const ci = p.cursorInstruction || generateCursorFixInstruction(p);
    if (ci.status === "OK") return `${pickStr(p.focus, "completion")} ステージが OK`;
    const tail = String(ci.text || "").split("完了条件:")[1] || "";
    const first = tail
      .trim()
      .split("\n")
      .map((s) => s.replace(/^\-\s*/, "").trim())
      .filter(Boolean)[0];
    if (first) return first;
    if (p.focus === "completion" && p.category === "job") return "A requestButtonVisible=true";
    return pickStr(p.primary?.nextActionHint, "該当ステージが OK");
  }

  function buildCursorTargetOnlyCopyText(panel) {
    const p = panel || {};
    const ci = p.cursorInstruction || generateCursorFixInstruction(p);
    const primary = p.primary || {};
    const code = pickStr(ci.code, primary.ngCategory, "—");
    const targetFile = pickStr(ci.targetFile, primary.targetFile, "—");
    const targetFunction = pickStr(ci.targetFunction, primary.targetFunction, "—");
    const cause =
      code !== "—" && code !== NG_CODES.OK
        ? code
        : pickStr(p.primaryRootCause, primary.evidence, "—");
    return [
      "修正対象:",
      targetFile,
      "",
      "修正関数:",
      targetFunction,
      "",
      "原因:",
      cause,
      "",
      "完了条件:",
      extractCursorDoneCondition(p),
    ].join("\n");
  }

  function buildFullStageDiagCopyText(panel) {
    const p = panel || {};
    const lines = [
      `Primary Focus: ${pickStr(p.focus, "—")}`,
      `Primary Root Cause: ${pickStr(p.primaryRootCause, "—")}`,
      "",
    ];
    for (const key of STAGE_ORDER) {
      const v = p.verdicts?.[key];
      const title = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      if (!v) {
        lines.push(`${title}: —`);
        continue;
      }
      lines.push(`${title}: ${v.status}`);
      if (v.status === "NG") {
        lines.push(`  分類: ${pickStr(v.ngCategory, "—")}`);
        lines.push(`  修正対象: ${pickStr(v.targetFile, "—")}`);
        lines.push(`  修正関数: ${pickStr(v.targetFunction, "—")}`);
      }
      if (v.status === "SKIP") {
        lines.push(`  理由: ${pickStr(v.skipReason, v.evidence, "—")}`);
      } else if (pickStr(v.evidence)) {
        lines.push(`  根拠: ${pickStr(v.evidence)}`);
      }
      lines.push("");
    }
    const uc = p.stages?.userConsistency;
    if (uc) {
      lines.push("--- A/B userId 整合性 ---");
      lines.push(`expectedAUserId: ${uc.expectedAUserId || "—"}`);
      lines.push(
        `actualANotifyFrameUserId: ${uc.actualANotifyFrameUserId || "—"} | diff: ${uc.aNotifyCmp?.diff || "—"}`
      );
      lines.push(
        `actualATalkHomeUserId: ${uc.actualATalkHomeUserId || "—"} | diff: ${uc.aTalkCmp?.diff || "—"}`
      );
      lines.push(
        `actualAChatFrameUserId: ${uc.actualAChatFrameUserId || "—"} | diff: ${uc.aChatFrameCmp?.diff || "—"}`
      );
      lines.push(
        `actualAChatDetailQueryUserId: ${uc.actualAChatDetailQueryUserId || "—"} | diff: ${uc.aChatDetailCmp?.diff || "—"}`
      );
      lines.push(`expectedBUserId: ${uc.expectedBUserId || "—"}`);
      lines.push(
        `actualBNotifyFrameUserId: ${uc.actualBNotifyFrameUserId || "—"} | diff: ${uc.bNotifyCmp?.diff || "—"}`
      );
      lines.push(
        `actualBTalkHomeUserId: ${uc.actualBTalkHomeUserId || "—"} | diff: ${uc.bTalkCmp?.diff || "—"}`
      );
      lines.push(
        `actualBChatFrameUserId: ${uc.actualBChatFrameUserId || "—"} | diff: ${uc.bChatFrameCmp?.diff || "—"}`
      );
      lines.push(
        `actualBChatDetailQueryUserId: ${uc.actualBChatDetailQueryUserId || "—"} | diff: ${uc.bChatDetailCmp?.diff || "—"}`
      );
      lines.push(`threadParticipants: ${uc.threadParticipants || "—"}`);
      lines.push(
        `isAInThreadParticipants: ${uc.isAInThreadParticipants == null ? "—" : uc.isAInThreadParticipants} | diff: ${uc.aParticipantCmp?.diff || "—"}`
      );
      lines.push(
        `isBInThreadParticipants: ${uc.isBInThreadParticipants == null ? "—" : uc.isBInThreadParticipants} | diff: ${uc.bParticipantCmp?.diff || "—"}`
      );
      lines.push(
        `completionNotifyRecipient: ${uc.completionNotifyRecipient || "—"} | diff: ${uc.completionCmp?.diff || "—"}`
      );
      lines.push(
        `reviewNotifyRecipient: ${uc.reviewNotifyRecipient || "—"} | diff: ${uc.reviewCmp?.diff || "—"}`
      );
      lines.push("");
    }
    const ndl = p.stages?.notifyDisplayLoad;
    if (ndl) {
      lines.push("--- 通知表示・chat-detail読込 整合性 ---");
      lines.push(`expectedANotificationRecipient: ${ndl.expectedANotificationRecipient}`);
      lines.push(
        `actualANotificationStoreCount: ${ndl.actualANotificationStoreCount} | rows: ${ndl.actualANotificationRowsCount} | diff: ${ndl.aNotificationRenderDiff}`
      );
      lines.push(`latestANotificationHref: ${ndl.latestANotificationHref}`);
      lines.push(`expectedAChatHref: ${ndl.expectedAChatHref}`);
      lines.push(`actualAChatFrameSrc: ${ndl.actualAChatFrameSrc}`);
      lines.push(`aChatDetailReached: ${ndl.aChatDetailReached} | thread: ${ndl.aChatThreadResolved} | room: ${ndl.aChatRoomResolved}`);
      lines.push(`aChatLoadReady: ${ndl.aChatLoadReady} | composer: ${ndl.aComposerRendered}`);
      lines.push(`aChatLoadErrorReason: ${ndl.aChatLoadErrorReason}`);
      lines.push("");
    }
    const crn =
      p.stages?.notifyDisplayLoad?.completionReviewNotify ||
      p.stages?.completionReviewNotify ||
      buildCompletionReviewNotifyDiagnostics(p.snapshot || {});
    if (crn) {
      lines.push("--- 完了承認・レビュー通知 整合性 ---");
      lines.push(`completionNotifyCreated: ${crn.completionNotifyCreated}`);
      lines.push(
        `completionNotifyRecipient: ${crn.completionNotifyRecipient} | expected: ${crn.completionNotifyExpectedRecipient}`
      );
      lines.push(
        `completionNotifyStoreCountForA: ${crn.completionNotifyStoreCountForA} | rows: ${crn.completionNotifyRowsCountForA}`
      );
      lines.push(`completionNotifyHref: ${crn.completionNotifyHref}`);
      lines.push(`completionNotifyDropReason: ${crn.completionNotifyDropReason || "—"}`);
      lines.push(`reviewNotifyCreated: ${crn.reviewNotifyCreated}`);
      lines.push(
        `reviewNotifyRecipient: ${crn.reviewNotifyRecipient} | expected: ${crn.reviewNotifyExpectedRecipient}`
      );
      lines.push(
        `reviewNotifyStoreCountForA: ${crn.reviewNotifyStoreCountForA} | rows: ${crn.reviewNotifyRowsCountForA}`
      );
      lines.push(`reviewNotifyHref: ${crn.reviewNotifyHref}`);
      lines.push(`reviewNotifyDropReason: ${crn.reviewNotifyDropReason || "—"}`);
      const { failures: displayFails, ddc } = evaluateBenchDisplayFailures(p.snapshot, p.stages);
      displayFails.forEach((f) => {
        lines.push(`NG ${f.code}: ${f.cause}`);
        lines.push(`  expected=${f.expected} actual=${f.actual} diff=${f.diff}`);
        lines.push(`  fix: ${f.targetFile} / ${f.targetFunction}`);
      });
      if (ddc?.aChatDom) {
        lines.push(
          `dom actualChatErrorVisible: ${ddc.aChatDom.actualChatErrorVisible} text: ${ddc.aChatDom.actualChatErrorText}`
        );
        lines.push(
          `dom actualNotifyRowDomCount: ${ddc.aNotifyDom?.actualNotifyRowDomCount} empty: ${ddc.aNotifyDom?.actualNotifyEmptyTextVisible}`
        );
      }
      lines.push("");
    }
    const ddc = p.stages?.diagDomConsistency;
    if (ddc) {
      lines.push("--- 診断結果・実DOM一致チェック ---");
      lines.push(`aChatLoadReady(diag): ${p.stages?.notifyDisplayLoad?.aChatLoadReady}`);
      lines.push(`actualChatErrorVisible(dom): ${ddc.aChatDom?.actualChatErrorVisible}`);
      lines.push(`actualBodyTextIncludesChatError(dom): ${ddc.aChatDom?.actualBodyTextIncludesChatError}`);
      lines.push(`rowsCount(diag): ${p.stages?.notifyDisplayLoad?.actualANotificationRowsCount}`);
      lines.push(`actualNotifyRowDomCount(dom): ${ddc.aNotifyDom?.actualNotifyRowDomCount}`);
      lines.push("");
    }
    const cursorText = pickStr(p.cursorInstruction?.text);
    if (cursorText) {
      lines.push("--- Cursor修正指示 ---", cursorText);
    }
    return lines.join("\n").trim();
  }

  function formatOneStageVerdictHtml(v, escapeHtml, highlighted) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const title = `${v.stage.charAt(0).toUpperCase() + v.stage.slice(1)} Verdict`;
    const statusCls =
      v.status === "OK"
        ? "bench-verdict__status-ok"
        : v.status === "SKIP"
          ? "bench-verdict__status-skip"
          : "bench-verdict__status-ng";
    const stageStatusCls =
      v.status === "OK" ? "is-ok" : v.status === "SKIP" ? "is-skip" : "is-ng";
    const hl = highlighted ? " bench-verdict__stage--focus" : "";
    return (
      `<section class="bench-verdict__stage ${stageStatusCls}${hl}" aria-label="${esc(title)}">` +
      `<p class="bench-verdict__section-title">${esc(title)}: <span class="${statusCls}">${esc(v.status)}</span></p>` +
      (v.status === "SKIP"
        ? `<p class="bench-verdict__detail">理由: ${esc(v.skipReason || v.evidence)}</p>`
        : `<ul class="bench-verdict__kv">` +
          (v.status === "NG"
            ? `<li><dt>分類</dt><dd>${esc(v.ngCategory)}</dd></li>` +
              `<li><dt>修正対象</dt><dd>${formatTargetFileLink(v.targetFile, esc)}</dd></li>` +
              `<li><dt>修正関数</dt><dd>${esc(v.targetFunction)}</dd></li>`
            : "") +
          `</ul>` +
          `<p class="bench-verdict__detail">根拠: ${esc(v.evidence)}</p>` +
          (v.nextActionHint && v.nextActionHint !== "—"
            ? `<p class="bench-verdict__detail">next: ${esc(v.nextActionHint)}</p>`
            : "")) +
      `</section>`
    );
  }

  function formatStageVerdictsPanelHtml(panel, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const p = panel || {};
    const focus = p.focus || "completion";
    const primary = p.primary || {};
    const headStatusCls =
      primary.status === "OK" ? "is-ok" : primary.status === "SKIP" ? "is-skip" : "is-ng";
    const focusSelect = STAGE_ORDER.map(
      (s) =>
        `<option value="${s}"${s === focus ? " selected" : ""}>${s}</option>`
    ).join("");
    let stagesHtml = "";
    for (const key of STAGE_ORDER) {
      stagesHtml += formatOneStageVerdictHtml(p.verdicts?.[key], escapeHtml, key === focus);
    }
    const rootCauseCls =
      primary.status === "OK"
        ? "bench-verdict__status-ok"
        : primary.status === "SKIP"
          ? "bench-verdict__status-skip"
          : "bench-verdict__status-ng";
    return (
      `<div class="bench-verdict__layout" data-bench-focus="${esc(focus)}" data-bench-stage="${esc(focus)}">` +
      `<div class="bench-verdict__sticky-head ${headStatusCls}" aria-label="Primary Focus">` +
      `<p class="bench-verdict__sticky-title">Primary Focus / Root Cause</p>` +
      `<div class="bench-verdict__focus-row">` +
      `<label class="bench-verdict__focus-label">focus` +
      `<select id="benchDiagFocusSelect" class="bench-verdict__focus-select" aria-label="diagFocus">${focusSelect}</select>` +
      `</label>` +
      `</div>` +
      `<ul class="bench-verdict__kv bench-verdict__kv--sticky">` +
      `<li><dt>Primary Focus</dt><dd><strong>${esc(focus)}</strong></dd></li>` +
      `<li><dt>Primary Root Cause</dt><dd class="${rootCauseCls}">${esc(p.primaryRootCause || "—")}</dd></li>` +
      (primary.status === "NG"
        ? `<li><dt>修正対象</dt><dd>${formatTargetFileLink(primary.targetFile, esc)}</dd></li>` +
          `<li><dt>修正関数</dt><dd>${esc(primary.targetFunction)}</dd></li>`
        : "") +
      `</ul>` +
      `<div class="bench-verdict__head-actions">` +
      `<button type="button" class="bench-verdict__close-btn" id="benchVerdictCloseBtn" aria-label="診断パネルを閉じる">閉じる</button>` +
      `</div>` +
      `<div class="bench-verdict__copy bench-verdict__copy--sticky">` +
      `<button type="button" class="bench-verdict__copy-btn" id="benchCursorFixCopyBtn">Cursor指示をコピー</button>` +
      `<button type="button" class="bench-verdict__copy-btn" id="benchTargetOnlyCopyBtn">修正対象だけコピー</button>` +
      `<button type="button" class="bench-verdict__copy-btn" id="benchFullDiagCopyBtn">全診断コピー</button>` +
      `<button type="button" class="bench-verdict__copy-btn bench-verdict__copy-btn--sub" id="benchNgBulkCopyBtn">NG全部コピー</button>` +
      `<button type="button" class="bench-verdict__copy-btn bench-verdict__copy-btn--sub" id="benchVerdictCopyBtn">詳細診断をコピー</button>` +
      `<span class="bench-verdict__copy-hint" id="benchVerdictCopyHint">ワンクリックで Cursor へ貼り付け</span>` +
      `</div>` +
      `</div>` +
      `<div class="bench-verdict__scroll-body">` +
      (p.cursorInstruction?.text
        ? `<section class="bench-verdict__cursor-block" aria-label="Cursor修正指示">` +
          `<p class="bench-verdict__section-title">Cursor修正指示</p>` +
          `<div class="bench-cursor-fix-box">` +
          `<textarea readonly class="bench-cursor-fix-box__textarea" id="benchCursorFixTextarea" aria-label="Cursor修正指示全文">${esc(p.cursorInstruction.text)}</textarea>` +
          `</div>` +
          `</section>`
        : "") +
      stagesHtml +
      `</div>` +
      `</div>`
    );
  }

  function analyzeStageVerdicts(ctx, options) {
    if (options?.lightMode !== true) {
      refreshChatFrameDebug();
    }
    const snapshot = collectSnapshot(ctx);
    const built = buildStageVerdicts(snapshot, options);
    const verdicts = {
      notification: built.notification,
      cta: built.cta,
      chat: built.chat,
      completion: built.completion,
      review: built.review,
    };
    const focusInfo = resolvePrimaryFocus(
      pickStr(options?.diagFocus, ctx?.diagFocus),
      verdicts,
      snapshot.category
    );
    const panel = {
      category: snapshot.category,
      categoryLabel: snapshot.categoryLabel,
      flowStage: snapshot.stage,
      focus: focusInfo.focus,
      primary: focusInfo.primary,
      primaryRootCause: focusInfo.primaryRootCause,
      verdicts,
      stages: built.stages,
      snapshot,
      jobEnd: options?.jobEnd || ctx?.jobEnd || null,
    };
    panel.cursorInstruction = generateCursorFixInstruction(panel);
    panel.consistencySectionCopies = buildAllConsistencySectionCopyTexts(panel);
    panel.ngBlockCopies = buildAllNgBlockCopyTexts(panel);
    panel.ngBlocksBulkCopyText = buildAllNgBlocksBulkCopyText(panel);
    try {
      global.__tasuBenchStageVerdicts = panel;
      global.__tasuBenchCursorFixText = trimBenchGlobalCopyText(panel.cursorInstruction?.text || "", 12000);
      global.__tasuBenchSectionCopyTexts = panel.consistencySectionCopies;
      global.__tasuBenchNgBlockCopyTexts = panel.ngBlockCopies;
      global.__tasuBenchNgBlocksBulkCopyText = trimBenchGlobalCopyText(panel.ngBlocksBulkCopyText);
    } catch {
      /* ignore */
    }
    return panel;
  }

  function normalizeButtonText(text) {
    const t = pickStr(text).replace(/\s+/g, "");
    if (!t || t === "none") return "none";
    return t;
  }

  function buttonMatches(expected, actual) {
    const exp = normalizeButtonText(expected);
    const act = normalizeButtonText(actual);
    if (exp === "none") return act === "none" || !act;
    if (exp === "依頼済み表示") return /依頼|待ち/.test(act) || act === "none";
    if (exp === "申請済み" || exp === "報告済み") return /申請|報告|済|待ち/.test(act) || act === "none";
    if (/承認/.test(exp)) return /承認|差し戻し/.test(act);
    if (/レビュー/.test(exp)) return /レビュー|評価/.test(act);
    return act.includes(exp) || exp.includes(act);
  }

  function titleMatches(title, pattern) {
    const t = String(title || "");
    if (!pattern) return false;
    if (pattern instanceof RegExp) return pattern.test(t);
    return t.includes(String(pattern).slice(0, 6));
  }

  function readMountedFrameHref(frameId) {
    try {
      const el = global.document?.getElementById(frameId);
      if (!el) return "";
      const live = pickStr(el.contentWindow?.location?.href);
      if (live && !/^about:/i.test(live)) return live;
      return pickStr(el.src);
    } catch {
      try {
        return pickStr(global.document?.getElementById(frameId)?.src);
      } catch {
        return "";
      }
    }
  }

  function readIframeUrlUserId(frameId) {
    try {
      const href = readMountedFrameHref(frameId);
      if (!href) return "";
      return pickStr(new URL(href, global.location?.href || "http://localhost/").searchParams.get("userId"));
    } catch {
      return "";
    }
  }

  function readTalkHomeUserId(frameId) {
    const urlUid = readIframeUrlUserId(frameId);
    if (urlUid) return urlUid;
    try {
      const win = global.document?.getElementById(frameId)?.contentWindow;
      return pickStr(
        win?.__tasuBenchNotifyRenderDiag?.userId,
        win?.__tasuBenchNotifyRenderDiag?.urlUserId,
        win?.TasuChatUserIdentity?.getEffectiveUserId?.()
      );
    } catch {
      return "";
    }
  }

  function readChatDetailQueryUserId(side) {
    const loadUid = pickStr(side?.chatLoadDiag?.currentUserId, side?.currentUserId);
    if (loadUid) return loadUid;
    try {
      const href = pickStr(side?.chatHref, side?.chatLoadDiag?.currentUrl);
      if (!href || !/chat-detail\.html/i.test(href)) return "";
      return pickStr(new URL(href, global.location?.href || "http://localhost/").searchParams.get("userId"));
    } catch {
      return "";
    }
  }

  function compareExpectedActual(expected, actual) {
    const exp = pickStr(expected);
    const act = pickStr(actual);
    if (!exp) return { expected: "—", actual: act || "—", diff: "—", ok: true, pending: true };
    if (!act) return { expected: exp, actual: "—", diff: "— (未読込)", ok: true, pending: true };
    const ok = exp === act;
    return {
      expected: exp,
      actual: act,
      diff: ok ? "OK" : `NG expected=${exp} actual=${act}`,
      ok,
      pending: false,
    };
  }

  function buildUserIdConsistencyDiagnostics(snapshot) {
    const expectedAUserId = pickStr(snapshot.actorAId, snapshot.config?.actorA?.userId);
    const expectedBUserId = pickStr(snapshot.actorBId, snapshot.config?.actorB?.userId);
    const actualANotifyFrameUserId = readIframeUrlUserId("frame-a-notify");
    const actualATalkHomeUserId = readTalkHomeUserId("frame-a-notify");
    const actualAChatFrameUserId = readIframeUrlUserId("frame-a-chat");
    const actualAChatDetailQueryUserId = readChatDetailQueryUserId(snapshot.sideA);
    const actualBNotifyFrameUserId = readIframeUrlUserId("frame-b-notify");
    const actualBTalkHomeUserId = readTalkHomeUserId("frame-b-notify");
    const actualBChatFrameUserId = readIframeUrlUserId("frame-b-chat");
    const actualBChatDetailQueryUserId = readChatDetailQueryUserId(snapshot.sideB);

    const thread = snapshot.thread || {};
    const participants = [
      ...(Array.isArray(thread.threadParticipants) ? thread.threadParticipants : []),
      ...(Array.isArray(thread.participantIds) ? thread.participantIds : []),
    ]
      .map((id) => pickStr(id))
      .filter(Boolean);
    const threadParticipantsList = [...new Set(participants)];
    const threadParticipants = threadParticipantsList.length ? threadParticipantsList.join(", ") : "—";

    const isAInThreadParticipants =
      !expectedAUserId || !threadParticipantsList.length
        ? null
        : threadParticipantsList.includes(expectedAUserId);
    const isBInThreadParticipants =
      !expectedBUserId || !threadParticipantsList.length
        ? null
        : threadParticipantsList.includes(expectedBUserId);

    const notifs = snapshot.notifs || {};
    const completionNotifyRecipient = pickStr(
      notifs.completionApprovedNotifyDiag?.completionApprovedNotifyRecipient,
      notifs.completionApprovedA?.recipientUserId
    );
    const reviewNotifyRecipient = pickStr(
      notifs.reviewNotifyDiag?.reviewNotifyRecipient,
      notifs.reviewA?.recipientUserId
    );
    const completionNotifyCreated = Boolean(
      notifs.completionApprovedNotifyDiag?.completionApprovedNotifyCreated ||
        notifs.completionApprovedA
    );
    const reviewNotifyCreated = Boolean(
      notifs.reviewNotifyDiag?.reviewNotifyCreated || notifs.reviewA
    );
    const isCompletionNotifyForA = completionNotifyRecipient
      ? completionNotifyRecipient === expectedAUserId
      : null;
    const isReviewNotifyForA = reviewNotifyRecipient ? reviewNotifyRecipient === expectedAUserId : null;

    const aNotifyCmp = compareExpectedActual(expectedAUserId, actualANotifyFrameUserId);
    const aTalkCmp = compareExpectedActual(expectedAUserId, actualATalkHomeUserId);
    const aChatFrameCmp = compareExpectedActual(expectedAUserId, actualAChatFrameUserId);
    const aChatDetailCmp = compareExpectedActual(expectedAUserId, actualAChatDetailQueryUserId);
    const bNotifyCmp = compareExpectedActual(expectedBUserId, actualBNotifyFrameUserId);
    const bTalkCmp = compareExpectedActual(expectedBUserId, actualBTalkHomeUserId);
    const bChatFrameCmp = compareExpectedActual(expectedBUserId, actualBChatFrameUserId);
    const bChatDetailCmp = compareExpectedActual(expectedBUserId, actualBChatDetailQueryUserId);
    const aParticipantCmp = {
      expected: expectedAUserId || "—",
      actual: isAInThreadParticipants == null ? "—" : String(isAInThreadParticipants),
      diff:
        isAInThreadParticipants == null
          ? "— (thread未確定)"
          : isAInThreadParticipants
            ? "OK"
            : `NG expected=in [${threadParticipants}]`,
      ok: isAInThreadParticipants !== false,
      pending: isAInThreadParticipants == null,
    };
    const bParticipantCmp = {
      expected: expectedBUserId || "—",
      actual: isBInThreadParticipants == null ? "—" : String(isBInThreadParticipants),
      diff:
        isBInThreadParticipants == null
          ? "— (thread未確定)"
          : isBInThreadParticipants
            ? "OK"
            : `NG expected=in [${threadParticipants}]`,
      ok: isBInThreadParticipants !== false,
      pending: isBInThreadParticipants == null,
    };
    const completionCmp = {
      expected: expectedAUserId || "—",
      actual: completionNotifyRecipient || "—",
      diff: !completionNotifyRecipient
        ? "— (未生成)"
        : isCompletionNotifyForA
          ? "OK"
          : `NG expected=${expectedAUserId} actual=${completionNotifyRecipient}`,
      ok: !completionNotifyRecipient || isCompletionNotifyForA === true,
      pending: !completionNotifyRecipient,
    };
    const reviewCmp = {
      expected: expectedAUserId || "—",
      actual: reviewNotifyRecipient || "—",
      diff: !reviewNotifyRecipient
        ? "— (未生成)"
        : isReviewNotifyForA
          ? "OK"
          : `NG expected=${expectedAUserId} actual=${reviewNotifyRecipient}`,
      ok: !reviewNotifyRecipient || isReviewNotifyForA === true,
      pending: !reviewNotifyRecipient,
    };

    return {
      expectedAUserId,
      actualANotifyFrameUserId,
      actualATalkHomeUserId,
      actualAChatFrameUserId,
      actualAChatDetailQueryUserId,
      expectedBUserId,
      actualBNotifyFrameUserId,
      actualBTalkHomeUserId,
      actualBChatFrameUserId,
      actualBChatDetailQueryUserId,
      threadParticipants,
      threadParticipantsList,
      isAInThreadParticipants,
      isBInThreadParticipants,
      completionNotifyRecipient: completionNotifyRecipient || "—",
      reviewNotifyRecipient: reviewNotifyRecipient || "—",
      isCompletionNotifyForA,
      isReviewNotifyForA,
      completionNotifyCreated,
      reviewNotifyCreated,
      aNotifyCmp,
      aTalkCmp,
      aChatFrameCmp,
      aChatDetailCmp,
      bNotifyCmp,
      bTalkCmp,
      bChatFrameCmp,
      bChatDetailCmp,
      aParticipantCmp,
      bParticipantCmp,
      completionCmp,
      reviewCmp,
    };
  }

  function evaluateUserConsistencyFailures(snapshot, userConsistency) {
    const uc = userConsistency || buildUserIdConsistencyDiagnostics(snapshot);
    const failures = [];
    const expA = uc.expectedAUserId;
    const expB = uc.expectedBUserId;

    const aChecks = [
      ["A-notify iframe", uc.actualANotifyFrameUserId],
      ["A talk-home", uc.actualATalkHomeUserId],
      ["A-chat iframe", uc.actualAChatFrameUserId],
    ];
    if (snapshot.sideA?.isChatDetail) {
      aChecks.push(["A chat-detail query", uc.actualAChatDetailQueryUserId]);
    }
    for (const [label, actual] of aChecks) {
      if (actual && expA && actual !== expA) {
        failures.push({
          code: NG_CODES.A_USER_MISMATCH,
          name: "A userId整合",
          detail: `${label}: expected=${expA} actual=${actual}`,
          stage: "notification",
        });
        break;
      }
    }

    const bChecks = [
      ["B-notify iframe", uc.actualBNotifyFrameUserId],
      ["B talk-home", uc.actualBTalkHomeUserId],
      ["B-chat iframe", uc.actualBChatFrameUserId],
    ];
    if (snapshot.sideB?.isChatDetail) {
      bChecks.push(["B chat-detail query", uc.actualBChatDetailQueryUserId]);
    }
    for (const [label, actual] of bChecks) {
      if (actual && expB && actual !== expB) {
        failures.push({
          code: NG_CODES.B_USER_MISMATCH,
          name: "B userId整合",
          detail: `${label}: expected=${expB} actual=${actual}`,
          stage: "notification",
        });
        break;
      }
    }

    if (uc.threadParticipantsList?.length && expA && uc.isAInThreadParticipants === false) {
      failures.push({
        code: NG_CODES.A_NOT_PARTICIPANT,
        name: "A threadParticipants",
        detail: `A ${expA} not in [${uc.threadParticipants}]`,
        stage: "cta",
      });
    }
    if (uc.threadParticipantsList?.length && expB && uc.isBInThreadParticipants === false) {
      failures.push({
        code: NG_CODES.B_NOT_PARTICIPANT,
        name: "B threadParticipants",
        detail: `B ${expB} not in [${uc.threadParticipants}]`,
        stage: "cta",
      });
    }

    if (uc.completionNotifyCreated && uc.completionNotifyRecipient && uc.isCompletionNotifyForA === false) {
      failures.push({
        code: NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH,
        name: "完了承認通知recipient",
        detail: `expected=${expA} actual=${uc.completionNotifyRecipient}`,
        stage: "review",
      });
    }
    if (uc.reviewNotifyCreated && uc.reviewNotifyRecipient && uc.isReviewNotifyForA === false) {
      failures.push({
        code: NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH,
        name: "レビュー通知recipient",
        detail: `expected=${expA} actual=${uc.reviewNotifyRecipient}`,
        stage: "review",
      });
    }

    return failures;
  }

  function isNotificationHrefValid(href) {
    const h = pickStr(href);
    if (!h || h === "#" || h.length < 8) return false;
    return /chat-detail\.html|detail-job\.html|applications/i.test(h);
  }

  function resolveBenchProfileId(snapshot) {
    return pickStr(snapshot.ctx?.profile?.id, snapshot.demoProfile, snapshot.category);
  }

  function resolveBenchANotifyTitlePattern(snapshot) {
    const profileId = resolveBenchProfileId(snapshot);
    if (profileId === "job") return JOB_POSTER_NOTIFY_TITLE;
    return CHAT_STARTED_NOTIFY_TITLE;
  }

  function resolveBenchBNotifyTitlePattern(snapshot) {
    const profileId = resolveBenchProfileId(snapshot);
    if (profileId === "job") return JOB_APPLICANT_NOTIFY_TITLE;
    return CHAT_STARTED_NOTIFY_TITLE;
  }

  function resolveBenchANotifyTitleExpectedLabel(snapshot) {
    const profileId = resolveBenchProfileId(snapshot);
    if (profileId === "job") return "応募者とのやりとりを開始してください";
    return "やりとりが開始されました";
  }

  function resolveNotifyDisplayFixTarget(code, snapshot) {
    const profileId = resolveBenchProfileId(snapshot);
    if (code === NG_CODES.A_NOTIFICATION_STORE_MISSING) {
      if (
        profileId === "product" ||
        profileId === "skill" ||
        profileId === "worker" ||
        profileId === "business" ||
        profileId === "shop" ||
        profileId === "general"
      ) {
        return {
          files: ["talk-platform-notify.js", "platform-chat-fee.js"],
          fns: ["notifyPurchaseChatStartedToSeller", "notifyPurchaseChatStartedAfterPayment"],
          targetFile: "talk-platform-notify.js",
          targetFunction: "notifyPurchaseChatStartedToSeller()",
        };
      }
      if (profileId === "job") {
        return {
          files: ["talk-platform-notify.js", "platform-chat-fee.js"],
          fns: ["notifyJobHiredToPoster", "notifyJobHireAfterPayment"],
          targetFile: "talk-platform-notify.js",
          targetFunction: "notifyJobHiredToPoster()",
        };
      }
    }
    if (
      code === NG_CODES.A_NOTIFICATION_HREF_MISSING &&
      ["product", "skill", "worker", "business", "shop", "general"].includes(profileId)
    ) {
      return {
        files: ["talk-platform-notify.js"],
        fns: ["buildPurchaseChatNotifyUrl"],
        targetFile: "talk-platform-notify.js",
        targetFunction: "buildPurchaseChatNotifyUrl()",
      };
    }
    return null;
  }

  function isPurchaseRuntimeNotifyEvalContext(snapshot) {
    const profileId = resolveBenchProfileId(snapshot);
    if (!PURCHASE_RUNTIME_NOTIFY_PROFILES.has(profileId)) return false;
    const profile = snapshot.ctx?.profile;
    if (profile?.connect === true) return false;

    const Live = global.TasuPlatformChatLiveFlow;
    if (Live?.hasBenchPurchased?.(profile)) return true;

    const thread = snapshot.thread;
    if (thread) {
      const st = String(thread.status || thread.roomStatus || "").toLowerCase();
      if (st === "open" || st === "active" || st === "fee_pending") {
        const listingType = pickStr(thread.listingType, thread.listing_type, profileId).toLowerCase();
        if (listingType && listingType !== "job") return true;
      }
    }

    if (
      pickStr(snapshot.threadId) &&
      (snapshot.sideA?.chatOpened ||
        snapshot.sideB?.chatOpened ||
        snapshot.sideA?.chatLoadReady ||
        snapshot.sideB?.chatLoadReady)
    ) {
      return true;
    }

    return false;
  }

  function isPostHireEvalContext(snapshot) {
    if (isPurchaseRuntimeNotifyEvalContext(snapshot)) return true;
    const thread = snapshot.thread;
    if (thread && String(thread.threadKind || "") === "job_hire") {
      const st = String(thread.status || thread.roomStatus || "").toLowerCase();
      if (st === "open" || st === "active") return true;
    }
    if (thread) {
      const st = String(thread.status || thread.roomStatus || "").toLowerCase();
      const listingType = pickStr(thread.listingType, thread.listing_type).toLowerCase();
      if ((st === "open" || st === "active") && listingType && listingType !== "job") {
        return true;
      }
    }
    if (snapshot.threadId && snapshot.ctx?.hiredRow) return true;
    const rows = snapshot.notifs?.rows || [];
    const aId = pickStr(snapshot.actorAId);
    const bId = pickStr(snapshot.actorBId);
    if (aId && rows.some((n) => String(n.recipientUserId) === aId && JOB_POSTER_NOTIFY_TITLE.test(String(n.title)))) {
      return true;
    }
    if (bId && rows.some((n) => String(n.recipientUserId) === bId && JOB_APPLICANT_NOTIFY_TITLE.test(String(n.title)))) {
      return true;
    }
    if (aId && rows.some((n) => String(n.recipientUserId) === aId && CHAT_STARTED_NOTIFY_TITLE.test(String(n.title)))) {
      return true;
    }
    if (bId && rows.some((n) => String(n.recipientUserId) === bId && CHAT_STARTED_NOTIFY_TITLE.test(String(n.title)))) {
      return true;
    }
    return false;
  }

  function readNotificationsStoreForRecipient(recipientUserId, titlePattern) {
    let rows = [];
    try {
      rows = global.TasuTalkNotifications?.getAll?.() || [];
    } catch {
      rows = [];
    }
    const uid = pickStr(recipientUserId);
    const forRecipient = uid ? rows.filter((n) => String(n.recipientUserId) === uid) : [];
    const matched = titlePattern
      ? forRecipient.filter((n) => titleMatches(n.title, titlePattern))
      : forRecipient;
    const sorted = matched
      .slice()
      .sort((a, b) => String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || "")));
    return {
      storeCount: forRecipient.length,
      matchedCount: matched.length,
      latest: sorted[0] || null,
    };
  }

  function readBenchRuntimeNotifyDelivery(recipientUserId, titlePattern, threadId, notifyKind) {
    const log = global.__tasuBenchRuntimeNotifyLog || {};
    const deliveries = Array.isArray(log.deliveries) ? log.deliveries : [];
    const uid = pickStr(recipientUserId);
    const tid = pickStr(threadId);
    const hit = deliveries.find((d) => {
      if (pickStr(d.recipientUserId) !== uid) return false;
      if (tid && pickStr(d.threadId) && pickStr(d.threadId) !== tid) return false;
      if (notifyKind && pickStr(d.kind) && pickStr(d.kind) !== notifyKind) return false;
      if (titlePattern && d.title && !titleMatches(d.title, titlePattern)) return false;
      return true;
    });
    return { received: Boolean(hit), delivery: hit || null };
  }

  function readThreadMessageSenders(threadId, actorAId, actorBId) {
    const tid = pickStr(threadId);
    if (!tid) return { aSent: false, bSent: false, messages: [] };
    let messages = [];
    try {
      messages = global.TasuChatThreadStore?.getMessages?.(tid) || [];
    } catch {
      messages = [];
    }
    if (!Array.isArray(messages) || !messages.length) {
      try {
        const map = JSON.parse(global.localStorage?.getItem("tasful_chat_messages") || "{}");
        messages = Array.isArray(map[tid]) ? map[tid] : [];
      } catch {
        messages = [];
      }
    }
    const senderId = (m) => pickStr(m.senderId, m.userId, m.authorId, m.sender_id);
    const aId = pickStr(actorAId);
    const bId = pickStr(actorBId);
    return {
      aSent: messages.some((m) => senderId(m) === aId),
      bSent: messages.some((m) => senderId(m) === bId),
      messages,
    };
  }

  function resolvePurchaseNotifyFixTarget(cause, notifyKind) {
    if (cause === BENCH_NOTIFY_CAUSE.POSTMESSAGE_MISSING) {
      return {
        targetFile: "platform-chat-dual-window-notify.js",
        targetFunction: "notifyBenchParentRuntimeNotification()",
      };
    }
    if (cause === BENCH_NOTIFY_CAUSE.STORE_NOT_WRITTEN) {
      return notifyKind === "message"
        ? {
            targetFile: "platform-chat-dual-window-notify.js",
            targetFunction: "notifyDemoChatMessage() / notifyPlatformChatMessage()",
          }
        : {
            targetFile: "talk-platform-notify.js",
            targetFunction: "notifyPurchaseChatStartedAfterPayment()",
          };
    }
    if (
      cause === BENCH_NOTIFY_CAUSE.IFRAME_NOT_UPDATED ||
      cause === BENCH_NOTIFY_CAUSE.CHAT_OPENED_NOT_VISIBLE ||
      cause === BENCH_NOTIFY_CAUSE.CHAT_MESSAGE_NOT_VISIBLE
    ) {
      return {
        targetFile: "talk-home.js",
        targetFunction: "filterNotificationsByRecipient() / paintNotifyListCards()",
      };
    }
    return {
      targetFile: "talk-platform-notify.js",
      targetFunction: "notifyPurchaseChatStartedAfterPayment()",
    };
  }

  function resolveProductShippingNotifyFixTarget(cause) {
    if (cause === PRODUCT_SHIPPING_CAUSE.POSTMESSAGE_MISSING) {
      return {
        targetFile: "platform-chat-dual-window-notify.js",
        targetFunction: "notifyBenchParentRuntimeNotification()",
      };
    }
    if (
      cause === PRODUCT_SHIPPING_CAUSE.STORE_NOT_WRITTEN ||
      cause === PRODUCT_SHIPPING_CAUSE.REQUEST_NOT_NOTIFIED ||
      cause === PRODUCT_SHIPPING_CAUSE.RECIPIENT_WRONG
    ) {
      return {
        targetFile: "platform-chat-dual-window-notify.js",
        targetFunction: "notifyDemoProductShipped()",
      };
    }
    if (
      cause === PRODUCT_SHIPPING_CAUSE.IFRAME_NOT_UPDATED ||
      cause === PRODUCT_SHIPPING_CAUSE.FILTERED_OUT
    ) {
      return {
        targetFile: "talk-home.js",
        targetFunction: "filterNotificationsByRecipient() / paintNotifyListCards()",
      };
    }
    return {
      targetFile: "platform-chat-completion-flow.js",
      targetFunction: "markProductShipped()",
    };
  }

  function mapProductShippingCause(delivery, sellerHasShippingNotify) {
    if (sellerHasShippingNotify) return PRODUCT_SHIPPING_CAUSE.RECIPIENT_WRONG;
    const filterDrop = pickStr(delivery?.fields?.renderDiag?.filterDropReason);
    if (filterDrop && (delivery.localStorageOk || delivery.storeApiOk)) {
      return PRODUCT_SHIPPING_CAUSE.FILTERED_OUT;
    }
    if (!delivery.localStorageOk && !delivery.storeApiOk) {
      return PRODUCT_SHIPPING_CAUSE.STORE_NOT_WRITTEN;
    }
    if (delivery.localStorageOk && delivery.storeApiOk && !delivery.iframeDomOk) {
      return PRODUCT_SHIPPING_CAUSE.IFRAME_NOT_UPDATED;
    }
    if (!delivery.benchPostOk) {
      return PRODUCT_SHIPPING_CAUSE.POSTMESSAGE_MISSING;
    }
    if (delivery.cause === BENCH_NOTIFY_CAUSE.IFRAME_NOT_UPDATED) {
      return PRODUCT_SHIPPING_CAUSE.IFRAME_NOT_UPDATED;
    }
    if (delivery.cause === BENCH_NOTIFY_CAUSE.POSTMESSAGE_MISSING) {
      return PRODUCT_SHIPPING_CAUSE.POSTMESSAGE_MISSING;
    }
    if (delivery.cause === BENCH_NOTIFY_CAUSE.STORE_NOT_WRITTEN) {
      return PRODUCT_SHIPPING_CAUSE.STORE_NOT_WRITTEN;
    }
    return PRODUCT_SHIPPING_CAUSE.REQUEST_NOT_NOTIFIED;
  }

  function makeProductShippingNotifyFailure(opts) {
    const o = opts || {};
    const related = o.related || {};
    const cause = pickStr(o.cause, PRODUCT_SHIPPING_CAUSE.REQUEST_NOT_NOTIFIED);
    const fix = resolveProductShippingNotifyFixTarget(cause);
    return {
      code: NG_CODES.PRODUCT_SHIPPING_NOTIFICATION_MISSING,
      name: NG_CODES.PRODUCT_SHIPPING_NOTIFICATION_MISSING,
      cause,
      detail: pickStr(o.detail, cause),
      stage: pickStr(o.stage, "notification"),
      expected: pickStr(o.expected, "—"),
      actual: pickStr(o.actual, "—"),
      diff: pickStr(o.diff, "NG"),
      targetFile: fix.targetFile,
      targetFunction: fix.targetFunction,
      related,
    };
  }

  function makePurchaseRuntimeNotifyFailure(opts) {
    const o = opts || {};
    const related = o.related || {};
    const fix = resolvePurchaseNotifyFixTarget(pickStr(o.cause), pickStr(related.notifyKind));
    return {
      code: NG_CODES.NOTIFICATION_MISSING,
      name: NG_CODES.NOTIFICATION_MISSING,
      cause: pickStr(o.cause, BENCH_NOTIFY_CAUSE.CHAT_OPENED_NOT_VISIBLE),
      detail: pickStr(o.detail, o.cause),
      stage: pickStr(o.stage, "notification"),
      expected: pickStr(o.expected, "—"),
      actual: pickStr(o.actual, "—"),
      diff: pickStr(o.diff, "NG"),
      targetFile: fix.targetFile,
      targetFunction: fix.targetFunction,
      related,
    };
  }

  function evaluateNotifyDeliveryForRecipient(snapshot, sideKey, titlePattern, notifyKind) {
    const frameId = sideKey === "A" ? "frame-a-notify" : "frame-b-notify";
    const recipientId = sideKey === "A" ? pickStr(snapshot.actorAId) : pickStr(snapshot.actorBId);
    const threadId = pickStr(snapshot.threadId);
    const localStorageDiag = readStorageNotificationsForRecipient(recipientId, titlePattern);
    const storeApi = readNotificationsStoreForRecipient(recipientId, titlePattern);
    const fields = buildSideNotificationLoadFields(frameId, recipientId, titlePattern);
    const domCount = countNotifyRowsForTitle(frameId, titlePattern);
    const benchPost = readBenchRuntimeNotifyDelivery(recipientId, titlePattern, threadId, notifyKind);
    const localStorageOk = localStorageDiag.matchedCount > 0;
    const storeApiOk = storeApi.matchedCount > 0;
    const iframeDomOk = domCount > 0 && fields.renderedInRows;
    const allStoreOk = localStorageOk && storeApiOk;
    const uiVisible = allStoreOk && iframeDomOk;
    let cause = null;
    if (!localStorageOk && !storeApiOk) {
      cause = BENCH_NOTIFY_CAUSE.STORE_NOT_WRITTEN;
    } else if (allStoreOk && !iframeDomOk) {
      cause = BENCH_NOTIFY_CAUSE.IFRAME_NOT_UPDATED;
    } else if (!iframeDomOk) {
      cause =
        notifyKind === "message"
          ? BENCH_NOTIFY_CAUSE.CHAT_MESSAGE_NOT_VISIBLE
          : BENCH_NOTIFY_CAUSE.CHAT_OPENED_NOT_VISIBLE;
    } else if (
      (notifyKind === "message" || notifyKind === "product_shipped") &&
      !benchPost.received
    ) {
      cause = BENCH_NOTIFY_CAUSE.POSTMESSAGE_MISSING;
    }
    return {
      sideKey,
      recipientId,
      frameId,
      notifyKind,
      localStorageOk,
      storeApiOk,
      iframeDomOk,
      domCount,
      benchPostOk: benchPost.received,
      uiVisible,
      cause,
      localStorageDiag,
      storeApi,
      fields,
      benchPost,
    };
  }

  function evaluatePurchaseRuntimeNotificationFailures(snapshot) {
    if (!isPurchaseRuntimeNotifyEvalContext(snapshot)) return [];
    const failures = [];
    const threadId = pickStr(snapshot.threadId);
    const sideLabel = (key) => (key === "A" ? "A側" : "B側");

    ["A", "B"].forEach((sideKey) => {
      const delivery = evaluateNotifyDeliveryForRecipient(
        snapshot,
        sideKey,
        CHAT_STARTED_NOTIFY_TITLE,
        "chat_started"
      );
      if (delivery.uiVisible && !delivery.cause) return;
      const cause = delivery.cause || BENCH_NOTIFY_CAUSE.CHAT_OPENED_NOT_VISIBLE;
      failures.push(
        makePurchaseRuntimeNotifyFailure({
          cause,
          detail: `${sideLabel(sideKey)}: ${cause}`,
          expected: `「やりとりが開始されました」が${sideLabel(sideKey)}通知に表示`,
          actual: `localStorage=${delivery.localStorageOk} storeApi=${delivery.storeApiOk} iframeRows=${delivery.domCount} postMessage=${delivery.benchPostOk}`,
          diff: `NG ${cause}`,
          related: {
            recipientUserId: delivery.recipientId,
            side: sideKey,
            threadId,
            notifyKind: "chat_started",
            localStorageMatched: delivery.localStorageDiag.matchedCount,
            storeApiMatched: delivery.storeApi.matchedCount,
            iframeDomRows: delivery.domCount,
            benchPostMessageReceived: delivery.benchPostOk,
            latestTitle: delivery.fields.latestTitle,
            filterDropReason: pickStr(delivery.fields.renderDiag?.filterDropReason),
          },
        })
      );
    });

    const { aSent, bSent } = readThreadMessageSenders(threadId, snapshot.actorAId, snapshot.actorBId);
    if (aSent) {
      const delivery = evaluateNotifyDeliveryForRecipient(
        snapshot,
        "B",
        MESSAGE_NOTIFY_TITLE,
        "message"
      );
      if (!delivery.uiVisible || delivery.cause) {
        const cause = delivery.cause || BENCH_NOTIFY_CAUSE.CHAT_MESSAGE_NOT_VISIBLE;
        failures.push(
          makePurchaseRuntimeNotifyFailure({
            cause,
            detail: `B側: A送信後メッセージ通知なし (${cause})`,
            expected: "A送信後、B通知に「新しいメッセージが届きました」",
            actual: `localStorage=${delivery.localStorageOk} storeApi=${delivery.storeApiOk} iframeRows=${delivery.domCount} postMessage=${delivery.benchPostOk}`,
            diff: `NG ${cause}`,
            related: {
              recipientUserId: delivery.recipientId,
              side: "B",
              threadId,
              notifyKind: "message",
              senderSide: "A",
              localStorageMatched: delivery.localStorageDiag.matchedCount,
              storeApiMatched: delivery.storeApi.matchedCount,
              iframeDomRows: delivery.domCount,
              benchPostMessageReceived: delivery.benchPostOk,
              latestTitle: delivery.fields.latestTitle,
            },
          })
        );
      }
    }
    if (bSent) {
      const delivery = evaluateNotifyDeliveryForRecipient(
        snapshot,
        "A",
        MESSAGE_NOTIFY_TITLE,
        "message"
      );
      if (!delivery.uiVisible || delivery.cause) {
        const cause = delivery.cause || BENCH_NOTIFY_CAUSE.CHAT_MESSAGE_NOT_VISIBLE;
        failures.push(
          makePurchaseRuntimeNotifyFailure({
            cause,
            detail: `A側: B送信後メッセージ通知なし (${cause})`,
            expected: "B送信後、A通知に「新しいメッセージが届きました」",
            actual: `localStorage=${delivery.localStorageOk} storeApi=${delivery.storeApiOk} iframeRows=${delivery.domCount} postMessage=${delivery.benchPostOk}`,
            diff: `NG ${cause}`,
            related: {
              recipientUserId: delivery.recipientId,
              side: "A",
              threadId,
              notifyKind: "message",
              senderSide: "B",
              localStorageMatched: delivery.localStorageDiag.matchedCount,
              storeApiMatched: delivery.storeApi.matchedCount,
              iframeDomRows: delivery.domCount,
              benchPostMessageReceived: delivery.benchPostOk,
              latestTitle: delivery.fields.latestTitle,
            },
          })
        );
      }
    }

    return failures;
  }

  function resolveProductReceiveConfirmFixTarget(cause) {
    if (cause === PRODUCT_RECEIVE_CAUSE.UI_BLOCKED_BY_FROZEN_IFRAME) {
      return {
        targetFile: "chat-dual-window-demo.html",
        targetFunction: "reloadBenchChatRoomState() / openBenchFrameNavigate()",
      };
    }
    if (
      cause === PRODUCT_RECEIVE_CAUSE.CTA_OPENED_WRONG_THREAD ||
      cause === PRODUCT_RECEIVE_CAUSE.CURRENT_USER_WRONG
    ) {
      return {
        targetFile: "platform-chat-dual-window-demo.js",
        targetFunction: "chatUrl() / openBenchFrameNavigate()",
      };
    }
    if (
      cause === PRODUCT_RECEIVE_CAUSE.THREAD_STATE_NOT_LOADED ||
      cause === PRODUCT_RECEIVE_CAUSE.PRODUCT_SHIPPED_STATE_MISSING
    ) {
      return {
        targetFile: "chat-detail.js",
        targetFunction: "reloadRoomStateFromStore() / init()",
      };
    }
    return {
      targetFile: "platform-chat-category-flow.js",
      targetFunction: "canRequestCompletion() / getPrimaryActionMode()",
    };
  }

  function makeProductReceiveConfirmUiFailure(opts) {
    const o = opts || {};
    const related = o.related || {};
    const cause = pickStr(o.cause, PRODUCT_RECEIVE_CAUSE.CONFIRM_BUTTON_NOT_RENDERED);
    const fix = resolveProductReceiveConfirmFixTarget(cause);
    return {
      code: NG_CODES.PRODUCT_RECEIVE_CONFIRM_UI_MISSING,
      name: NG_CODES.PRODUCT_RECEIVE_CONFIRM_UI_MISSING,
      cause,
      detail: pickStr(o.detail, cause),
      stage: pickStr(o.stage, "chat_ui"),
      expected: pickStr(o.expected, "—"),
      actual: pickStr(o.actual, "—"),
      diff: pickStr(o.diff, "NG"),
      targetFile: fix.targetFile,
      targetFunction: fix.targetFunction,
      related,
    };
  }

  function readBenchChatFrameFrozen(frameId) {
    try {
      const fn = global.isBenchChatFrameFrozenOnDetail;
      if (typeof fn === "function") return fn(frameId) === true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function isProductOrShopPurchaseEvalContext(snapshot) {
    const profileId = resolveBenchProfileId(snapshot);
    return profileId === "product" || profileId === "shop";
  }

  function resolveBenchPurchasePaymentMethod(snapshot) {
    const thread = snapshot?.thread;
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    if (Purchase?.getPaymentMethod && thread) {
      return Purchase.getPaymentMethod(thread);
    }
    try {
      return pickStr(new URLSearchParams(global.location?.search || "").get("paymentMethod"), "prepaid");
    } catch {
      return "prepaid";
    }
  }

  function resolvePurchasePaymentFlowFixTarget(cause) {
    if (/notification/.test(cause)) {
      return {
        targetFile: "platform-chat-dual-window-notify.js",
        targetFunction: "notifyDemoShippingReady() / notifyDemoBankTransferReported() / notifyDemoCod*()",
      };
    }
    if (/button|wrong_side|shipping_before_payment|review/.test(cause)) {
      return {
        targetFile: "platform-chat-purchase-payment-flow.js",
        targetFunction: "getPrimaryActionMode() / canMarkProductShipped()",
      };
    }
    return {
      targetFile: "chat-detail.js",
      targetFunction: "openCompleteModal() / onCompleteSubmit()",
    };
  }

  function resolveBankTransferReceiveUiFixTarget(cause) {
    if (
      cause === BANK_TRANSFER_RECEIVE_CAUSE.B_CHAT_NOT_RERENDERED ||
      cause === BANK_TRANSFER_RECEIVE_CAUSE.BENCH_DIAG_PANEL_NOT_INITIALIZED ||
      cause === BANK_TRANSFER_RECEIVE_CAUSE.BENCH_NG_PANEL_NOT_RENDERED
    ) {
      return {
        targetFile: "chat-dual-window-demo.html",
        targetFunction: "softSyncBenchChatRoomState() / renderBenchRootCausePanel()",
      };
    }
    if (cause === BANK_TRANSFER_RECEIVE_CAUSE.THREAD_STATE_NOT_SYNCED) {
      return {
        targetFile: "chat-detail.js",
        targetFunction: "tasu-chat-reload-room / reloadRoomStateFromStore()",
      };
    }
    return {
      targetFile: "chat-detail.js",
      targetFunction: "updateJobEndComposerBar() / syncProductShippingCards()",
    };
  }

  function makeBankTransferReceiveUiFailure(opts) {
    const o = opts || {};
    const related = o.related || {};
    const cause = pickStr(o.cause, BANK_TRANSFER_RECEIVE_CAUSE.PRODUCT_SHIPPED_B_UI_MISSING);
    const fix = resolveBankTransferReceiveUiFixTarget(cause);
    return {
      code: NG_CODES.PRODUCT_BANK_TRANSFER_RECEIVE_UI_MISSING,
      name: NG_CODES.PRODUCT_BANK_TRANSFER_RECEIVE_UI_MISSING,
      cause,
      detail: pickStr(o.detail, cause),
      stage: pickStr(o.stage, "chat_ui"),
      expected: pickStr(o.expected, "—"),
      actual: pickStr(o.actual, "—"),
      diff: pickStr(o.diff, "NG"),
      targetFile: fix.targetFile,
      targetFunction: fix.targetFunction,
      related,
    };
  }

  function makeBenchPanelHealthFailure(opts) {
    const o = opts || {};
    const cause = pickStr(o.cause);
    const fix = resolveBankTransferReceiveUiFixTarget(cause);
    return {
      code: NG_CODES.PRODUCT_BANK_TRANSFER_RECEIVE_UI_MISSING,
      name: NG_CODES.PRODUCT_BANK_TRANSFER_RECEIVE_UI_MISSING,
      cause,
      detail: pickStr(o.detail, cause),
      stage: pickStr(o.stage, "bench_diag"),
      expected: pickStr(o.expected, "診断パネルが初期化・描画済み"),
      actual: pickStr(o.actual, "—"),
      diff: pickStr(o.diff, "NG"),
      targetFile: fix.targetFile,
      targetFunction: fix.targetFunction,
      related: o.related || {},
    };
  }

  function makeBankTransferFlowFailure(opts) {
    const o = opts || {};
    const cause = pickStr(o.cause);
    const fix = resolvePurchasePaymentFlowFixTarget(cause);
    return {
      code: NG_CODES.PRODUCT_BANK_TRANSFER_FLOW_MISSING,
      name: NG_CODES.PRODUCT_BANK_TRANSFER_FLOW_MISSING,
      cause,
      detail: pickStr(o.detail, cause),
      stage: pickStr(o.stage, "purchase_payment"),
      expected: pickStr(o.expected, "—"),
      actual: pickStr(o.actual, "—"),
      diff: pickStr(o.diff, "NG"),
      targetFile: fix.targetFile,
      targetFunction: fix.targetFunction,
      related: o.related || {},
    };
  }

  function makeCodFlowFailure(opts) {
    const o = opts || {};
    const cause = pickStr(o.cause);
    const fix = resolvePurchasePaymentFlowFixTarget(cause);
    return {
      code: NG_CODES.PRODUCT_COD_FLOW_MISSING,
      name: NG_CODES.PRODUCT_COD_FLOW_MISSING,
      cause,
      detail: pickStr(o.detail, cause),
      stage: pickStr(o.stage, "purchase_payment"),
      expected: pickStr(o.expected, "—"),
      actual: pickStr(o.actual, "—"),
      diff: pickStr(o.diff, "NG"),
      targetFile: fix.targetFile,
      targetFunction: fix.targetFunction,
      related: o.related || {},
    };
  }

  function sideButtonMatches(side, pattern) {
    return side?.completionButtonVisible === true && pattern.test(pickStr(side.actualCompletionButton));
  }

  function evaluateProductReceiveConfirmUiFailures(snapshot) {
    if (!isProductOrShopPurchaseEvalContext(snapshot)) return [];
    if (!isPurchaseRuntimeNotifyEvalContext(snapshot)) return [];
    if (resolveBenchPurchasePaymentMethod(snapshot) === "cash_on_delivery") return [];
    if (resolveBenchPurchasePaymentMethod(snapshot) === "bank_transfer") return [];
    const thread = snapshot.thread;
    if (!thread || global.TasuPlatformChatCategoryFlow?.isProductShipped?.(thread) !== true) {
      return [];
    }

    const threadId = pickStr(snapshot.threadId, thread?.id);
    const buyerId = pickStr(snapshot.actorBId);
    const sellerId = pickStr(snapshot.actorAId);
    const sideB = snapshot.sideB || {};
    const sideA = snapshot.sideA || {};
    const bBtn = pickStr(sideB.actualCompletionButton);
    const aBtn = pickStr(sideA.actualCompletionButton);
    const bVisible = sideB.completionButtonVisible === true;
    const aVisible = sideA.completionButtonVisible === true;
    const bReceiveBtn = bVisible && PRODUCT_RECEIVE_CONFIRM_BUTTON.test(bBtn);
    const aReceiveBtn = aVisible && PRODUCT_RECEIVE_CONFIRM_BUTTON.test(aBtn);
    const bChatOpen = sideB.chatOpened === true && sideB.isChatDetail === true;
    const bUserOk = !pickStr(sideB.currentUserId) || pickStr(sideB.currentUserId) === buyerId;
    const bThreadOk =
      !pickStr(sideB.chatLoadDiag?.resolvedThreadId) ||
      pickStr(sideB.chatLoadDiag.resolvedThreadId) === threadId;
    const bFrozen = readBenchChatFrameFrozen("frame-b-chat");

    if (bReceiveBtn && !aReceiveBtn && bUserOk && bThreadOk) return [];

    let cause = PRODUCT_RECEIVE_CAUSE.CONFIRM_BUTTON_NOT_RENDERED;
    if (bFrozen && !bReceiveBtn) {
      cause = PRODUCT_RECEIVE_CAUSE.UI_BLOCKED_BY_FROZEN_IFRAME;
    } else if (!bUserOk) {
      cause = PRODUCT_RECEIVE_CAUSE.CURRENT_USER_WRONG;
    } else if (!bThreadOk) {
      cause = PRODUCT_RECEIVE_CAUSE.CTA_OPENED_WRONG_THREAD;
    } else if (!bChatOpen) {
      cause = PRODUCT_RECEIVE_CAUSE.THREAD_STATE_NOT_LOADED;
    } else if (
      global.TasuPlatformChatCategoryFlow?.isProductShipped?.(thread) !== true
    ) {
      cause = PRODUCT_RECEIVE_CAUSE.PRODUCT_SHIPPED_STATE_MISSING;
    } else if (aReceiveBtn) {
      cause = PRODUCT_RECEIVE_CAUSE.CURRENT_USER_WRONG;
    }

    return [
      makeProductReceiveConfirmUiFailure({
        cause,
        detail: `B側: 発送通知後の受取確認UIなし (${cause})`,
        expected: "Bチャットに「受け取り完了申請」等の受取確認ボタンが表示、A側には出ない",
        actual: `B visible=${bVisible} btn="${bBtn || "none"}" A visible=${aVisible} btn="${aBtn || "none"}" bUser=${pickStr(sideB.currentUserId)} frozen=${bFrozen}`,
        diff: `NG ${cause}`,
        related: {
          recipientUserId: buyerId,
          sellerUserId: sellerId,
          side: "B",
          threadId,
          productShipped: true,
          bChatOpened: bChatOpen,
          bCompletionButtonVisible: bVisible,
          bCompletionButtonText: bBtn,
          aCompletionButtonVisible: aVisible,
          aCompletionButtonText: aBtn,
          bCurrentUserId: pickStr(sideB.currentUserId),
          bResolvedThreadId: pickStr(sideB.chatLoadDiag?.resolvedThreadId),
          bChatFrameFrozen: bFrozen,
        },
      }),
    ];
  }

  function evaluateProductShippingNotificationFailures(snapshot) {
    if (!isProductOrShopPurchaseEvalContext(snapshot)) return [];
    if (!isPurchaseRuntimeNotifyEvalContext(snapshot)) return [];
    const thread = snapshot.thread;
    if (!thread || global.TasuPlatformChatCategoryFlow?.isProductShipped?.(thread) !== true) {
      return [];
    }

    const threadId = pickStr(snapshot.threadId, thread?.id);
    const sellerDelivery = evaluateNotifyDeliveryForRecipient(
      snapshot,
      "A",
      PRODUCT_SHIPPING_NOTIFY_TITLE,
      "product_shipped"
    );
    const buyerDelivery = evaluateNotifyDeliveryForRecipient(
      snapshot,
      "B",
      PRODUCT_SHIPPING_NOTIFY_TITLE,
      "product_shipped"
    );
    const sellerHasShippingNotify =
      sellerDelivery.localStorageOk || sellerDelivery.storeApiOk || sellerDelivery.iframeDomOk;

    if (buyerDelivery.uiVisible && !buyerDelivery.cause && !sellerHasShippingNotify) {
      return [];
    }

    const cause = mapProductShippingCause(buyerDelivery, sellerHasShippingNotify);
    return [
      makeProductShippingNotifyFailure({
        cause,
        detail: `B側: 発送申請後の購入者通知なし (${cause})`,
        expected: "A発送申請後、B通知に「商品が発送されました」系が表示",
        actual: `localStorage=${buyerDelivery.localStorageOk} storeApi=${buyerDelivery.storeApiOk} iframeRows=${buyerDelivery.domCount} postMessage=${buyerDelivery.benchPostOk} sellerHasNotify=${sellerHasShippingNotify}`,
        diff: `NG ${cause}`,
        related: {
          recipientUserId: buyerDelivery.recipientId,
          sellerUserId: sellerDelivery.recipientId,
          side: "B",
          threadId,
          notifyKind: "product_shipped",
          productShipped: true,
          localStorageMatched: buyerDelivery.localStorageDiag.matchedCount,
          storeApiMatched: buyerDelivery.storeApi.matchedCount,
          iframeDomRows: buyerDelivery.domCount,
          benchPostMessageReceived: buyerDelivery.benchPostOk,
          latestTitle: buyerDelivery.fields.latestTitle,
          filterDropReason: pickStr(buyerDelivery.fields.renderDiag?.filterDropReason),
          sellerNotifyMatched: sellerDelivery.storeApi.matchedCount,
        },
      }),
    ];
  }

  function evaluateProductBankTransferFlowFailures(snapshot) {
    if (!isProductOrShopPurchaseEvalContext(snapshot)) return [];
    if (!isPurchaseRuntimeNotifyEvalContext(snapshot)) return [];
    if (resolveBenchPurchasePaymentMethod(snapshot) !== "bank_transfer") return [];

    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    const thread = snapshot.thread;
    if (!thread || !Purchase) return [];

    const failures = [];
    const threadId = pickStr(snapshot.threadId, thread?.id);
    const sideA = snapshot.sideA || {};
    const sideB = snapshot.sideB || {};

    if (Purchase.isProductShipped?.(thread) && !Purchase.isPaymentConfirmed?.(thread)) {
      failures.push(
        makeBankTransferFlowFailure({
          cause: BANK_TRANSFER_CAUSE.PRODUCT_SHIPPING_BEFORE_PAYMENT_ALLOWED,
          detail: "入金確認前に商品発送が許可されています",
          expected: "paymentConfirmed=true の後のみ productShipped=true",
          actual: `paymentConfirmed=${Purchase.isPaymentConfirmed?.(thread)} productShipped=${Purchase.isProductShipped?.(thread)}`,
          related: { threadId, paymentMethod: "bank_transfer" },
        })
      );
    }

    if (!Purchase.isBankTransferReported?.(thread) && !Purchase.isPaymentConfirmed?.(thread)) {
      if (!sideButtonMatches(sideB, BANK_REPORT_BUTTON)) {
        failures.push(
          makeBankTransferFlowFailure({
            cause: BANK_TRANSFER_CAUSE.BANK_TRANSFER_REPORT_BUTTON_MISSING,
            detail: "B側: 振込完了報告ボタンなし",
            expected: "Bチャットに「銀行振込が完了しました」",
            actual: `visible=${sideB.completionButtonVisible} btn="${pickStr(sideB.actualCompletionButton, "none")}"`,
            related: { threadId, side: "B" },
          })
        );
      }
      if (sideButtonMatches(sideA, SHIP_BUTTON)) {
        failures.push(
          makeBankTransferFlowFailure({
            cause: BANK_TRANSFER_CAUSE.BANK_TRANSFER_WRONG_SIDE_BUTTON_VISIBLE,
            detail: "A側: 入金前に発送ボタンが表示",
            expected: "入金確認前はAに発送ボタンを出さない",
            actual: `btn="${pickStr(sideA.actualCompletionButton, "none")}"`,
            related: { threadId, side: "A" },
          })
        );
      }
    }

    if (Purchase.isBankTransferReported?.(thread) && !Purchase.isPaymentConfirmed?.(thread)) {
      const delivery = evaluateNotifyDeliveryForRecipient(
        snapshot,
        "A",
        BANK_REPORTED_SELLER_NOTIFY_TITLE,
        "bank_transfer_reported"
      );
      if (!delivery.uiVisible) {
        failures.push(
          makeBankTransferFlowFailure({
            cause: BANK_TRANSFER_CAUSE.BANK_TRANSFER_REPORT_NOTIFICATION_MISSING,
            detail: "A側: 銀行振込完了報告通知なし",
            expected: "A通知に「購入者が銀行振込完了を報告しました」",
            actual: `localStorage=${delivery.localStorageOk} iframe=${delivery.iframeDomOk}`,
            related: { threadId, recipientUserId: delivery.recipientId, side: "A" },
          })
        );
      }
      if (!sideButtonMatches(sideA, PAYMENT_CONFIRM_BUTTON)) {
        failures.push(
          makeBankTransferFlowFailure({
            cause: BANK_TRANSFER_CAUSE.PAYMENT_CONFIRM_BUTTON_MISSING,
            detail: "A側: 入金確認ボタンなし",
            expected: "Aチャットに「入金を確認する」",
            actual: `visible=${sideA.completionButtonVisible} btn="${pickStr(sideA.actualCompletionButton, "none")}"`,
            related: { threadId, side: "A" },
          })
        );
      }
      if (sideButtonMatches(sideB, PAYMENT_CONFIRM_BUTTON)) {
        failures.push(
          makeBankTransferFlowFailure({
            cause: BANK_TRANSFER_CAUSE.BANK_TRANSFER_WRONG_SIDE_BUTTON_VISIBLE,
            detail: "B側: 入金確認ボタンが誤表示",
            expected: "入金確認はAのみ",
            actual: `btn="${pickStr(sideB.actualCompletionButton, "none")}"`,
            related: { threadId, side: "B" },
          })
        );
      }
    }

    if (Purchase.isPaymentConfirmed?.(thread) && !Purchase.isProductShipped?.(thread)) {
      const delivery = evaluateNotifyDeliveryForRecipient(
        snapshot,
        "B",
        PAYMENT_CONFIRMED_NOTIFY_TITLE,
        "payment_confirmed"
      );
      if (!delivery.uiVisible) {
        failures.push(
          makeBankTransferFlowFailure({
            cause: BANK_TRANSFER_CAUSE.PAYMENT_CONFIRMED_NOTIFICATION_MISSING,
            detail: "B側: 入金確認完了通知なし",
            expected: "B通知に「入金確認が完了しました。商品の発送をお待ちください」",
            actual: `localStorage=${delivery.localStorageOk} iframe=${delivery.iframeDomOk}`,
            related: { threadId, recipientUserId: delivery.recipientId, side: "B" },
          })
        );
      }
      if (!sideButtonMatches(sideA, SHIP_BUTTON)) {
        failures.push(
          makeBankTransferFlowFailure({
            cause: BANK_TRANSFER_CAUSE.PRODUCT_SHIPPING_BUTTON_MISSING_AFTER_PAYMENT,
            detail: "A側: 入金確認後の発送ボタンなし",
            expected: "Aチャットに発送ボタン",
            actual: `visible=${sideA.completionButtonVisible} btn="${pickStr(sideA.actualCompletionButton, "none")}"`,
            related: { threadId, side: "A" },
          })
        );
      }
    }

    return failures;
  }

  function evaluateProductBankTransferReceiveUiFailures(snapshot, options) {
    if (!isProductOrShopPurchaseEvalContext(snapshot)) return [];
    if (!isPurchaseRuntimeNotifyEvalContext(snapshot)) return [];
    if (resolveBenchPurchasePaymentMethod(snapshot) !== "bank_transfer") return [];

    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    const thread = snapshot.thread;
    if (!thread || !Purchase) return [];
    if (Purchase.isProductShipped?.(thread) !== true) return [];
    if (Purchase.isProductReceived?.(thread) === true) return [];

    const purchaseCompleted =
      pickStr(thread?.roomStatus, thread?.status).toLowerCase() === "completed" ||
      Boolean(thread?.completed);
    if (purchaseCompleted) return [];

    const threadId = pickStr(snapshot.threadId, thread?.id);
    const buyerId = pickStr(snapshot.actorBId);
    const sideB = snapshot.sideB || {};
    const sideA = snapshot.sideA || {};
    const bReceiveBtn = sideButtonMatches(sideB, PRODUCT_RECEIVE_CONFIRM_BUTTON);
    const aReceiveBtn = sideButtonMatches(sideA, PRODUCT_RECEIVE_CONFIRM_BUTTON);
    const bStatusVisible = sideB.statusNoticeVisible === true;
    const bShippingCard = sideB.shippingCardVisible === true;
    const bChatOpen = sideB.chatOpened === true && sideB.isChatDetail === true;
    const bFrozen = readBenchChatFrameFrozen("frame-b-chat");
    const bUserOk = !pickStr(sideB.currentUserId) || pickStr(sideB.currentUserId) === buyerId;
    const bThreadOk =
      !pickStr(sideB.chatLoadDiag?.resolvedThreadId) ||
      pickStr(sideB.chatLoadDiag.resolvedThreadId) === threadId;

    if (bReceiveBtn && !aReceiveBtn && bUserOk && bThreadOk) return [];

    let cause = BANK_TRANSFER_RECEIVE_CAUSE.PRODUCT_SHIPPED_B_UI_MISSING;
    if (bFrozen && !bReceiveBtn) {
      cause = BANK_TRANSFER_RECEIVE_CAUSE.B_CHAT_NOT_RERENDERED;
    } else if (!bReceiveBtn) {
      cause = BANK_TRANSFER_RECEIVE_CAUSE.RECEIVE_BUTTON_MISSING;
    } else if (bChatOpen && bThreadOk && Purchase.isProductShipped?.(thread) && (!bStatusVisible || !bShippingCard)) {
      cause = BANK_TRANSFER_RECEIVE_CAUSE.THREAD_STATE_NOT_SYNCED;
    } else if (!bReceiveBtn || !bStatusVisible || !bShippingCard) {
      cause = BANK_TRANSFER_RECEIVE_CAUSE.PRODUCT_SHIPPED_B_UI_MISSING;
    }

    return [
      makeBankTransferReceiveUiFailure({
        cause,
        detail: `B側: 銀行振込・発送後の受取確認UI未反映 (${cause})`,
        expected:
          "Bチャットに発送ステータス通知・配送情報カード・受取確認ボタン（A側には出ない）",
        actual: `receiveBtn=${bReceiveBtn} statusNotice=${bStatusVisible} shippingCard=${bShippingCard} frozen=${bFrozen} btn="${pickStr(sideB.actualCompletionButton, "none")}"`,
        diff: `NG ${cause}`,
        related: {
          recipientUserId: buyerId,
          side: "B",
          threadId,
          paymentMethod: "bank_transfer",
          productShipped: true,
          bReceiveButtonVisible: bReceiveBtn,
          bStatusNoticeVisible: bStatusVisible,
          bShippingCardVisible: bShippingCard,
          bChatFrameFrozen: bFrozen,
          bCompletionButtonText: pickStr(sideB.actualCompletionButton),
          bStatusNoticeText: pickStr(sideB.statusNoticeText),
        },
      }),
    ];
  }

  function evaluateBenchPanelHealthFailures(snapshot, options) {
    const opts = options || {};
    const failures = [];
    if (opts.expectDiagPanel === true && opts.benchDiagInitialized !== true) {
      const grace = Number(opts.benchDiagBootGraceMs) || 2500;
      const started = Number(opts.benchSessionStartedAt) || 0;
      if (started && Date.now() - started > grace) {
        failures.push(
          makeBenchPanelHealthFailure({
            cause: BANK_TRANSFER_RECEIVE_CAUSE.BENCH_DIAG_PANEL_NOT_INITIALIZED,
            detail: "原因パネル / NG診断の初期化が未完了",
            actual: `diagEvaluatedAt=${pickStr(opts.benchDiagEvaluatedAt, "0")}`,
            related: { panelId: "benchRootCausePanel" },
          })
        );
      }
    }
    if (
      opts.benchNgPanelRendered !== true &&
      Number(opts.businessNgCount) > 0 &&
      /診断中/.test(pickStr(opts.benchPanelText))
    ) {
      failures.push(
        makeBenchPanelHealthFailure({
          cause: BANK_TRANSFER_RECEIVE_CAUSE.BENCH_NG_PANEL_NOT_RENDERED,
          detail: "NG検出済みだが原因パネル HTML が未描画",
          actual: `businessNgCount=${opts.businessNgCount} panelText=${pickStr(opts.benchPanelText, "—").slice(0, 80)}`,
          related: { panelId: "benchRootCausePanel", businessNgCount: opts.businessNgCount },
        })
      );
    }
    return failures;
  }

  function evaluateProductCodFlowFailures(snapshot) {
    if (!isProductOrShopPurchaseEvalContext(snapshot)) return [];
    if (!isPurchaseRuntimeNotifyEvalContext(snapshot)) return [];
    if (resolveBenchPurchasePaymentMethod(snapshot) !== "cash_on_delivery") return [];

    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    const thread = snapshot.thread;
    if (!thread || !Purchase) return [];

    const failures = [];
    const threadId = pickStr(snapshot.threadId, thread?.id);
    const sideA = snapshot.sideA || {};
    const sideB = snapshot.sideB || {};

    if (Purchase.isProductShipped?.(thread) && !Purchase.isProductReceived?.(thread)) {
      const delivery = evaluateNotifyDeliveryForRecipient(
        snapshot,
        "B",
        PRODUCT_SHIPPING_NOTIFY_TITLE,
        "product_shipped"
      );
      if (!delivery.uiVisible) {
        failures.push(
          makeCodFlowFailure({
            cause: COD_CAUSE.COD_SHIPPING_NOTIFICATION_MISSING,
            detail: "B側: 代引き発送通知なし",
            expected: "B通知に「商品が発送されました」系（代引き案内）",
            actual: `localStorage=${delivery.localStorageOk} iframe=${delivery.iframeDomOk}`,
            related: { threadId, recipientUserId: delivery.recipientId, side: "B" },
          })
        );
      }
      if (!sideButtonMatches(sideB, PRODUCT_RECEIVE_CONFIRM_BUTTON)) {
        failures.push(
          makeCodFlowFailure({
            cause: COD_CAUSE.COD_PAYMENT_REPORT_BUTTON_MISSING,
            detail: "B側: 受取ボタンなし",
            expected: "Bチャットに「商品を受け取りました」",
            actual: `visible=${sideB.completionButtonVisible} btn="${pickStr(sideB.actualCompletionButton, "none")}"`,
            related: { threadId, side: "B" },
          })
        );
      }
      if (sideButtonMatches(sideA, PRODUCT_RECEIVE_CONFIRM_BUTTON)) {
        failures.push(
          makeCodFlowFailure({
            cause: COD_CAUSE.COD_WRONG_SIDE_BUTTON_VISIBLE,
            detail: "A側: 受取ボタンが誤表示",
            expected: "受取ボタンはBのみ",
            actual: `btn="${pickStr(sideA.actualCompletionButton, "none")}"`,
            related: { threadId, side: "A" },
          })
        );
      }
    }

    if (Purchase.isProductReceived?.(thread) || thread.completed) {
      const aDelivery = evaluateNotifyDeliveryForRecipient(
        snapshot,
        "A",
        PRODUCT_RECEIVED_NOTIFY_TITLE,
        "product_received"
      );
      const bDelivery = evaluateNotifyDeliveryForRecipient(
        snapshot,
        "B",
        PURCHASE_COMPLETED_NOTIFY_TITLE,
        "purchase_completed"
      );
      if (!aDelivery.uiVisible && !bDelivery.uiVisible) {
        failures.push(
          makeCodFlowFailure({
            cause: COD_CAUSE.COD_CONFIRM_NOTIFICATION_MISSING,
            detail: "受取完了後の完了通知なし",
            expected: "A/Bに受取または取引完了通知",
            actual: `A=${aDelivery.uiVisible} B=${bDelivery.uiVisible}`,
            related: { threadId },
          })
        );
      }
      if (!(sideA.reviewCtaVisible || sideB.reviewCtaVisible)) {
        failures.push(
          makeCodFlowFailure({
            cause: COD_CAUSE.COD_REVIEW_NOT_AVAILABLE_AFTER_COMPLETE,
            detail: "取引完了後にレビューCTAなし",
            expected: "完了後 A/B にレビュー導線",
            actual: `A review=${sideA.reviewCtaVisible} B review=${sideB.reviewCtaVisible}`,
            related: { threadId },
          })
        );
      }
    }

    return failures;
  }

  function buildExpectedChatHref(snapshot, sideKey) {
    const uid = sideKey === "A" ? pickStr(snapshot.actorAId) : pickStr(snapshot.actorBId);
    const threadId = pickStr(snapshot.threadId, snapshot.thread?.id);
    const profile = snapshot.ctx?.profile;
    const Live = global.TasuPlatformChatLiveFlow;
    if (Live?.chatUrl && profile && uid) {
      try {
        return pickStr(Live.chatUrl(profile, uid, { threadId }));
      } catch {
        /* ignore */
      }
    }
    if (threadId && uid) {
      return `chat-detail.html?thread=${encodeURIComponent(threadId)}&userId=${encodeURIComponent(uid)}&talkDev=1`;
    }
    return "";
  }

  function readNotifyRenderDiagFromFrame(frameId) {
    try {
      return global.document?.getElementById(frameId)?.contentWindow?.__tasuBenchNotifyRenderDiag || {};
    } catch {
      return {};
    }
  }

  function readStorageNotificationsForRecipient(recipientUserId, titlePattern) {
    let rows = [];
    try {
      rows = JSON.parse(global.localStorage?.getItem("tasful_talk_notifications") || "[]");
    } catch {
      rows = [];
    }
    const uid = pickStr(recipientUserId);
    const forRecipient = uid ? rows.filter((n) => String(n.recipientUserId) === uid) : [];
    const matched = titlePattern
      ? forRecipient.filter((n) => titleMatches(n.title, titlePattern))
      : forRecipient;
    const sorted = matched
      .slice()
      .sort((a, b) => String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || "")));
    const latest = sorted[0] || null;
    return {
      storeCount: forRecipient.length,
      matchedCount: matched.length,
      latest,
      latestHref: pickStr(latest?.href, latest?.targetUrl),
    };
  }

  function buildSideNotificationLoadFields(frameId, recipientUserId, titlePattern, options) {
    const renderDiag = readNotifyRenderDiagFromFrame(frameId);
    const hint = options?.notifyHint;
    const hintRecipient = pickStr(hint?.recipientUserId);
    if (hintRecipient && hintRecipient === pickStr(recipientUserId) && hint?.notificationId) {
      const hinted = (global.TasuTalkNotifications?.getAll?.() || []).find(
        (n) => String(n.id) === String(hint.notificationId)
      );
      if (hinted) {
        const href = pickStr(hinted.href, hinted.targetUrl);
        return {
          storeCount: 1,
          rowsCount: Number(renderDiag.rowsLength ?? renderDiag.domCardCount ?? (href ? 1 : 0)),
          latestType: pickStr(hinted.type, renderDiag.latestRowType, "—"),
          latestTitle: pickStr(hinted.title, renderDiag.latestRowTitle, "—"),
          latestHref: href || "—",
          inStore: true,
          renderedInRows: Number(renderDiag.rowsLength ?? 0) > 0,
          hrefValid: isNotificationHrefValid(href),
          renderDiff: Number(renderDiag.rowsLength ?? 0) > 0 ? "OK (hint)" : "NG store=1 rows=0",
          renderDiag,
        };
      }
    }
    const storage = readStorageNotificationsForRecipient(recipientUserId, titlePattern);
    const latest = storage.latest;
    const href = pickStr(storage.latestHref, renderDiag.latestRowHref);
    const rowsCount = Number(renderDiag.rowsLength ?? renderDiag.recipientRowsCount ?? 0);
    const storeCount = Number(storage.matchedCount || storage.storeCount || 0);
    const inStore = Boolean(latest);
    const hrefValid = isNotificationHrefValid(href);
    const renderedInRows = inStore && rowsCount > 0;
    let renderDiff = "— (未評価)";
    if (!inStore) renderDiff = "NG store=0";
    else if (rowsCount < 1) {
      const dropReason = pickStr(renderDiag.filterDropReason);
      renderDiff = dropReason
        ? `NG store=${storeCount} rows=0; filterDropReason: ${dropReason}`
        : `NG store=${storeCount} rows=0`;
    }
    else if (!hrefValid) renderDiff = `NG rows=${rowsCount} href invalid`;
    else renderDiff = `OK store=${storeCount} rows=${rowsCount}`;
    return {
      storeCount,
      rowsCount,
      latestType: pickStr(latest?.type, renderDiag.latestRowType, "—"),
      latestTitle: pickStr(latest?.title, renderDiag.latestRowTitle, "—"),
      latestHref: href || "—",
      inStore,
      renderedInRows,
      hrefValid,
      renderDiff,
      renderDiag,
    };
  }

  function countNotifyRowsForTitle(frameId, titlePattern, options) {
    const renderDiag = readNotifyRenderDiagFromFrame(frameId);
    const logs = renderDiag.perNotificationFilterLogs || [];
    const passed = logs.filter((log) => log.passed && titleMatches(log.title, titlePattern));
    if (passed.length) return passed.length;
    if (options?.lightMode === true) {
      const rows = Number(renderDiag.rowsLength ?? renderDiag.domCardCount ?? 0);
      if (rows > 0 && titlePattern) return rows;
      return 0;
    }
    try {
      const doc = global.document?.getElementById(frameId)?.contentWindow?.document;
      const cards = doc ? [...doc.querySelectorAll(".talk-notify-card")] : [];
      return cards.filter((card) =>
        titlePattern.test(card.querySelector(".talk-notify-card__title")?.textContent || "")
      ).length;
    } catch {
      return 0;
    }
  }

  function pickNotifyDropReasonForTitle(frameId, recipientUserId, titlePattern) {
    const storage = readStorageNotificationsForRecipient(recipientUserId, titlePattern);
    if (!storage.latest) return "";
    const renderDiag = readNotifyRenderDiagFromFrame(frameId);
    const logs = renderDiag.perNotificationFilterLogs || [];
    const log = logs.find(
      (row) => pickStr(row.notificationId) === pickStr(storage.latest.id) && row.passed === false
    );
    if (log) return pickStr(log.filterDropReason);
    if (
      storage.matchedCount > 0 &&
      countNotifyRowsForTitle(frameId, titlePattern, options) < 1
    ) {
      return pickStr(renderDiag.filterDropReason, "rows=0");
    }
    return "";
  }

  function shouldExpectCompletionNotifyForA(snapshot) {
    const thread = snapshot.thread;
    if (!thread) return false;
    const st = String(thread.roomStatus || thread.status || "").toLowerCase();
    if (!["closed", "completed"].includes(st)) return false;
    const closedBy = pickStr(
      thread.closedByUserId,
      thread.closedBy,
      thread.confirmedEndBy,
      global.__tasuCompletionApprovedNotifyDiag?.approverId
    );
    const bId = pickStr(snapshot.actorBId);
    return Boolean(bId && closedBy === bId);
  }

  function shouldExpectReviewNotifyForA(snapshot) {
    if (snapshot.sideB?.diag?.reviewSubmitted === true) return true;
    if (global.__tasuReviewNotifyDiag?.reviewNotifyCreated === true) return true;
    const bId = pickStr(snapshot.actorBId);
    const rows = snapshot.notifs?.rows || [];
    return rows.some(
      (n) =>
        String(n.recipientUserId) === pickStr(snapshot.actorAId) &&
        JOB_REVIEW_RECEIVED_NOTIFY_TITLE.test(String(n.title || "")) &&
        pickStr(n.reviewerId, n.senderUserId) === bId
    );
  }

  function isPostCompletionReviewEvalContext(snapshot) {
    if (shouldExpectCompletionNotifyForA(snapshot) || shouldExpectReviewNotifyForA(snapshot)) {
      return true;
    }
    const thread = snapshot.thread;
    if (thread) {
      const st = String(thread.roomStatus || thread.status || "").toLowerCase();
      if (["end_requested", "closed", "completed"].includes(st)) return true;
    }
    if (global.__tasuCompletionApprovedNotifyDiag || global.__tasuReviewNotifyDiag) return true;
    if (snapshot.notifs?.completionApprovedA || snapshot.notifs?.reviewA) return true;
    return false;
  }

  function buildCompletionReviewNotifyDiagnostics(snapshot) {
    const aRecipient = pickStr(snapshot.actorAId);
    const expectedA = aRecipient || "—";
    const notifs = snapshot.notifs || {};
    const completionDiag =
      global.__tasuCompletionApprovedNotifyDiag || notifs.completionApprovedNotifyDiag || {};
    const reviewDiag = global.__tasuReviewNotifyDiag || notifs.reviewNotifyDiag || {};
    const completionStorage = readStorageNotificationsForRecipient(
      aRecipient,
      JOB_COMPLETION_APPROVED_NOTIFY_TITLE
    );
    const reviewStorage = readStorageNotificationsForRecipient(
      aRecipient,
      JOB_REVIEW_RECEIVED_NOTIFY_TITLE
    );
    const completionNotify =
      completionStorage.latest || notifs.completionApprovedA || null;
    const reviewNotify = reviewStorage.latest || notifs.reviewA || null;
    const completionCreated = Boolean(
      completionDiag.completionApprovedNotifyCreated ||
        completionNotify ||
        notifs.completionApprovedA
    );
    const reviewCreated = Boolean(
      reviewDiag.reviewNotifyCreated || reviewNotify || notifs.reviewA
    );
    const completionRecipient = pickStr(
      completionDiag.completionApprovedNotifyRecipient,
      completionNotify?.recipientUserId,
      notifs.completionApprovedA?.recipientUserId
    );
    const reviewRecipient = pickStr(
      reviewDiag.reviewNotifyRecipient,
      reviewNotify?.recipientUserId,
      notifs.reviewA?.recipientUserId
    );
    const completionStoreCount = Number(completionStorage.matchedCount || 0);
    const reviewStoreCount = Number(reviewStorage.matchedCount || 0);
    const completionRowsCount = countNotifyRowsForTitle(
      "frame-a-notify",
      JOB_COMPLETION_APPROVED_NOTIFY_TITLE
    );
    const reviewRowsCount = countNotifyRowsForTitle(
      "frame-a-notify",
      JOB_REVIEW_RECEIVED_NOTIFY_TITLE
    );
    const completionHref = pickStr(
      completionNotify?.href,
      completionNotify?.targetUrl,
      "—"
    );
    const reviewHref = pickStr(reviewNotify?.href, reviewNotify?.targetUrl, "—");
    const expectCompletion = shouldExpectCompletionNotifyForA(snapshot);
    const expectReview = shouldExpectReviewNotifyForA(snapshot);
    const evalContext = isPostCompletionReviewEvalContext(snapshot);

    return {
      evalContext,
      expectCompletionNotifyForA: expectCompletion,
      expectReviewNotifyForA: expectReview,
      completionNotifyCreated: completionCreated,
      completionNotifyRecipient: completionRecipient || "—",
      completionNotifyExpectedRecipient: expectedA,
      completionNotifyStoreCountForA: completionStoreCount,
      completionNotifyRowsCountForA: completionRowsCount,
      completionNotifyHref: completionHref,
      completionNotifyDropReason: pickNotifyDropReasonForTitle(
        "frame-a-notify",
        aRecipient,
        JOB_COMPLETION_APPROVED_NOTIFY_TITLE
      ),
      reviewNotifyCreated: reviewCreated,
      reviewNotifyRecipient: reviewRecipient || "—",
      reviewNotifyExpectedRecipient: expectedA,
      reviewNotifyStoreCountForA: reviewStoreCount,
      reviewNotifyRowsCountForA: reviewRowsCount,
      reviewNotifyHref: reviewHref,
      reviewNotifyDropReason: pickNotifyDropReasonForTitle(
        "frame-a-notify",
        aRecipient,
        JOB_REVIEW_RECEIVED_NOTIFY_TITLE
      ),
      _completionNotify: completionNotify,
      _reviewNotify: reviewNotify,
    };
  }

  function makeCompletionReviewNotifyFailure(code, detail, expected, actual, diff, stage) {
    const meta = NOTIFY_DISPLAY_LOAD_META[code] || {};
    const fix = FIX_MAP[code] || {};
    return {
      code,
      name: code,
      detail: pickStr(detail),
      stage: pickStr(stage, "review"),
      cause: pickStr(meta.cause, detail),
      expected: pickStr(expected, "—"),
      actual: pickStr(actual, "—"),
      diff: pickStr(diff, "NG"),
      targetFile: pickStr(meta.targetFile, fix.files?.[0], "—"),
      targetFunction: pickStr(meta.targetFunction, fix.fns?.[0], "—"),
    };
  }

  function evaluateCompletionReviewNotifyFailures(snapshot, crn) {
    const d = crn || buildCompletionReviewNotifyDiagnostics(snapshot);
    if (!d.evalContext) return [];
    const failures = [];
    const expectedA = pickStr(d.completionNotifyExpectedRecipient);

    if (d.expectCompletionNotifyForA) {
      if (!d.completionNotifyCreated) {
        failures.push(
          makeCompletionReviewNotifyFailure(
            NG_CODES.COMPLETION_NOTIFY_NOT_CREATED,
            "B 完了承認後、A 向け完了承認通知が store にありません",
            `recipient=${expectedA} title=${JOB_COMPLETION_APPROVED_NOTIFY_TITLE}`,
            `created=false store=${d.completionNotifyStoreCountForA}`,
            "NG not created",
            "completion"
          )
        );
      } else if (
        d.completionNotifyRecipient &&
        d.completionNotifyRecipient !== "—" &&
        expectedA &&
        d.completionNotifyRecipient !== expectedA
      ) {
        failures.push(
          makeCompletionReviewNotifyFailure(
            NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH,
            `completion recipient mismatch expected=${expectedA}`,
            expectedA,
            d.completionNotifyRecipient,
            `NG expected=${expectedA} actual=${d.completionNotifyRecipient}`,
            "completion"
          )
        );
      } else if (d.completionNotifyStoreCountForA > 0 && d.completionNotifyRowsCountForA < 1) {
        failures.push(
          makeCompletionReviewNotifyFailure(
            NG_CODES.COMPLETION_NOTIFY_ROWS_MISSING,
            `store=${d.completionNotifyStoreCountForA} rows=${d.completionNotifyRowsCountForA}`,
            "rows>=1",
            String(d.completionNotifyRowsCountForA),
            pickStr(d.completionNotifyDropReason, "NG rows=0"),
            "completion"
          )
        );
      }
    }

    if (d.expectReviewNotifyForA) {
      if (!d.reviewNotifyCreated) {
        failures.push(
          makeCompletionReviewNotifyFailure(
            NG_CODES.REVIEW_NOTIFY_NOT_CREATED,
            "B レビュー後、A 向けレビュー通知が store にありません",
            `recipient=${expectedA} title=${JOB_REVIEW_RECEIVED_NOTIFY_TITLE}`,
            `created=false store=${d.reviewNotifyStoreCountForA}`,
            "NG not created",
            "review"
          )
        );
      } else if (
        d.reviewNotifyRecipient &&
        d.reviewNotifyRecipient !== "—" &&
        expectedA &&
        d.reviewNotifyRecipient !== expectedA
      ) {
        failures.push(
          makeCompletionReviewNotifyFailure(
            NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH,
            `review recipient mismatch expected=${expectedA}`,
            expectedA,
            d.reviewNotifyRecipient,
            `NG expected=${expectedA} actual=${d.reviewNotifyRecipient}`,
            "review"
          )
        );
      } else if (d.reviewNotifyStoreCountForA > 0 && d.reviewNotifyRowsCountForA < 1) {
        failures.push(
          makeCompletionReviewNotifyFailure(
            NG_CODES.REVIEW_NOTIFY_ROWS_MISSING,
            `store=${d.reviewNotifyStoreCountForA} rows=${d.reviewNotifyRowsCountForA}`,
            "rows>=1",
            String(d.reviewNotifyRowsCountForA),
            pickStr(d.reviewNotifyDropReason, "NG rows=0"),
            "review"
          )
        );
      }
    }

    return failures;
  }

  const BENCH_THREAD_RESOLVE_TRACE_NAME = "thread解決内部トレース";

  const BENCH_THREAD_RESOLVE_DIAG_KEYS = [
    "traceName",
    "phase",
    "urlThreadId",
    "queryListingId",
    "queryApplicationId",
    "queryUserId",
    "applicationsCount",
    "applicationFoundById",
    "applicationFoundByThreadId",
    "applicationId",
    "applicationThreadIdBefore",
    "applicationThreadIdAfter",
    "threadStoreCount",
    "threadExistsByUrlThreadId",
    "threadExistsByApplicationThreadId",
    "findHireThreadCalled",
    "findHireThreadResultId",
    "ensureCalled",
    "ensureInputListingId",
    "ensureInputApplicationId",
    "ensureInputPreferredThreadId",
    "ensureResultThreadId",
    "restoreCalled",
    "restoreInputThreadId",
    "restoreResultThreadId",
    "restoreResultRoomId",
    "createCalled",
    "createPreferredThreadId",
    "createdThreadId",
    "resolvedThreadId",
    "resolvedRoomId",
    "participantIds",
    "isQueryUserParticipant",
    "finalResult",
    "failStep",
    "failReason",
  ];

  function readThreadResolveDiagFromFrame(frameId) {
    try {
      const win = global.document?.getElementById(frameId)?.contentWindow;
      const raw = win?.__tasuBenchThreadResolveDiag || {};
      const out = {};
      BENCH_THREAD_RESOLVE_DIAG_KEYS.forEach((key) => {
        const value = raw[key];
        if (value === undefined || value === null || value === "") {
          out[key] = "—";
        } else if (typeof value === "boolean") {
          out[key] = String(value);
        } else {
          out[key] = String(value);
        }
      });
      out.traceName = pickStr(raw.traceName, BENCH_THREAD_RESOLVE_TRACE_NAME);
      out.at = pickStr(raw.at, "—");
      return out;
    } catch {
      const empty = {};
      BENCH_THREAD_RESOLVE_DIAG_KEYS.forEach((key) => {
        empty[key] = "—";
      });
      empty.traceName = BENCH_THREAD_RESOLVE_TRACE_NAME;
      empty.at = "—";
      return empty;
    }
  }

  const EXPECTED_CHAT_DETAIL_SCRIPT_VERSION = "20260609-script-trace-v2";

  function collectChatDetailDiagWindowKeys(win) {
    if (!win) return "—";
    try {
      const keys = new Set();
      Object.getOwnPropertyNames(win).forEach((key) => {
        if (/^__tasu/i.test(key) || /tasu|BenchThread|ChatDetail|chatDetail/i.test(key)) {
          keys.add(key);
        }
      });
      const sorted = [...keys].sort();
      return sorted.length ? sorted.join(", ") : "—";
    } catch {
      return "—";
    }
  }

  function readChatDetailScriptLoadError(win, doc) {
    const body = doc?.body;
    const root = doc?.documentElement;
    const scriptEl = doc?.getElementById("chat-detail-main-script");
    const candidates = [
      win?.__tasuChatDetailScriptLoadError,
      body?.dataset?.chatDetailScriptLoadError,
      scriptEl?.dataset?.loadError,
    ];
    for (const raw of candidates) {
      const text = pickStr(raw);
      if (!text) continue;
      if (text === "1") return "dom_dataset_load_error";
      return text;
    }
    return "—";
  }

  function readChatLoadDiagFromFrame(frameId) {
    try {
      const win = global.document?.getElementById(frameId)?.contentWindow;
      const doc = win?.document;
      const body = doc?.body;
      const root = doc?.documentElement;
      const scriptEl = doc?.getElementById("chat-detail-main-script");
      const loadDiag = win?.__tasuChatDetailLoadDiag || {};
      const threadResolveDiag = win?.__tasuBenchThreadResolveDiag || {};
      const unavailableTitle = pickStr(doc?.querySelector(".chat-room-unavailable__title")?.textContent);
      const chatInput = doc?.getElementById("chatInput");
      const chatDetailHtmlReached =
        win?.__tasuChatDetailHtmlReached === true ||
        root?.dataset?.chatDetailHtmlReached === "1";
      const chatDetailScriptLoaded =
        win?.__tasuChatDetailScriptLoaded === true ||
        body?.dataset?.chatDetailScriptLoaded === "1" ||
        scriptEl?.dataset?.loaded === "1";
      const chatDetailScriptVersion = pickStr(
        win?.__tasuChatDetailScriptVersion,
        body?.dataset?.chatDetailScriptVersion,
        scriptEl?.dataset?.expectedVersion,
        root?.dataset?.chatDetailExpectedVersion,
        win?.__tasuChatDetailExpectedScriptVersion,
        threadResolveDiag.chatDetailScriptVersion
      );
      const chatDetailScriptLoadError = readChatDetailScriptLoadError(win, doc);
      const chatDetailScriptTagSrc = pickStr(scriptEl?.src, scriptEl?.getAttribute?.("src"));
      const chatDetailScriptPipelinePhase = pickStr(
        win?.__tasuChatDetailScriptPipelinePhase,
        body?.dataset?.chatDetailScriptPipelinePhase
      );
      return {
        ...loadDiag,
        threadResolveDiag,
        chatDetailHtmlReached,
        chatDetailScriptLoaded,
        chatDetailScriptPipelinePhase: chatDetailScriptPipelinePhase || "—",
        chatDetailScriptVersion: chatDetailScriptVersion || "—",
        chatDetailDiagWindowKeys: collectChatDetailDiagWindowKeys(win),
        chatDetailScriptLoadError,
        chatDetailScriptTagSrc: chatDetailScriptTagSrc || "—",
        chatDetailScriptTagLoaded: scriptEl?.dataset?.loaded === "1",
        chatUnavailableTitle: unavailableTitle,
        composerRenderedDom:
          Boolean(chatInput) &&
          !chatInput.hidden &&
          global.getComputedStyle(chatInput).display !== "none",
      };
    } catch (err) {
      return {
        chatDetailScriptLoaded: false,
        chatDetailScriptVersion: "—",
        chatDetailDiagWindowKeys: "—",
        chatDetailScriptLoadError: pickStr(err?.message, "frame_read_failed"),
        chatDetailScriptTagSrc: "—",
      };
    }
  }

  function buildSideChatLoadFields(snapshot, sideKey) {
    const side = sideKey === "A" ? snapshot.sideA : snapshot.sideB;
    const frameId = sideKey === "A" ? "frame-a-chat" : "frame-b-chat";
    const prefix = sideKey;
    const loadDiag = readChatLoadDiagFromFrame(frameId);
    const expectedHref = buildExpectedChatHref(snapshot, sideKey);
    const actualFrameSrc = readMountedFrameHref(frameId);
    const actualChatDetailUrl = pickStr(loadDiag.currentUrl, side.chatHref, actualFrameSrc);
    const chatDetailReached =
      loadDiag.chatDetailReached === true ||
      side.isChatDetail === true ||
      /chat-detail\.html/i.test(actualChatDetailUrl);
    const initStarted = loadDiag.chatDetailInitStarted === true;
    const threadResolved =
      loadDiag.chatDetailThreadResolved === true ||
      loadDiag.chatDetailThreadExists === true ||
      side.chatLoadDiag?.threadExists === true;
    const roomResolved =
      loadDiag.chatDetailRoomResolved === true ||
      loadDiag.chatDetailRoomExists === true ||
      side.chatLoadDiag?.roomExists === true;
    const composerRendered =
      loadDiag.composerRendered === true ||
      loadDiag.composerRenderedDom === true ||
      side.composerVisible === true;
    const chatLoadReady = side.chatLoadReady === true || loadDiag.chatDetailLoadOk === true;
    const errorReason = pickStr(
      loadDiag.chatDetailLoadErrorReason,
      loadDiag.failReason,
      side.chatLoadError,
      loadDiag.chatUnavailableTitle
    );
    let failStep = pickStr(loadDiag.failStep, readThreadResolveDiagFromFrame(frameId).failStep);
    let failReason = pickStr(loadDiag.failReason, errorReason);
    if (!chatLoadReady && !pickStr(failStep, failReason) && /chat-detail\.html/i.test(actualChatDetailUrl)) {
      if (loadDiag.chatDetailInitStarted !== true) {
        if (loadDiag.chatDetailScriptLoaded !== true) {
          failStep = "script_load";
          failReason = pickStr(
            loadDiag.chatDetailScriptLoadError,
            loadDiag.chatDetailScriptPipelinePhase !== "—"
              ? `pipeline_stuck:${loadDiag.chatDetailScriptPipelinePhase}`
              : "",
            loadDiag.chatDetailHtmlReached
              ? "chat-detail.js not loaded (deps pending or iframe reload interrupted)"
              : "chat-detail.html body not ready"
          );
        } else {
          failStep = "init_not_started";
          failReason = pickStr(
            loadDiag.chatDetailScriptPipelinePhase,
            "chat-detail.js loaded but init() did not publish diagnostics"
          );
        }
      }
    }
    const initLastStep = pickStr(loadDiag.initLastStep);
    const initExitKind = pickStr(loadDiag.initExitKind);
    const initTrace = Array.isArray(loadDiag.initTrace) ? loadDiag.initTrace : [];
    const frameIsChatDetail = /chat-detail\.html/i.test(actualFrameSrc);
    return {
      expectedChatHref: expectedHref || "—",
      actualChatFrameSrc: actualFrameSrc || "—",
      actualChatDetailUrl: actualChatDetailUrl || "—",
      chatDetailReached,
      chatDetailInitStarted: initStarted,
      chatDetailHtmlReached: loadDiag.chatDetailHtmlReached === true,
      chatDetailScriptLoaded: loadDiag.chatDetailScriptLoaded === true,
      chatDetailScriptVersion: pickStr(loadDiag.chatDetailScriptVersion),
      chatDetailDiagWindowKeys: pickStr(loadDiag.chatDetailDiagWindowKeys),
      chatDetailScriptLoadError: pickStr(loadDiag.chatDetailScriptLoadError),
      chatDetailScriptTagSrc: pickStr(loadDiag.chatDetailScriptTagSrc),
      chatThreadResolved: threadResolved,
      chatRoomResolved: roomResolved,
      composerRendered,
      chatLoadReady,
      chatLoadErrorReason: errorReason || "—",
      failStep: failStep || "—",
      failReason: failReason || "—",
      initLastStep: initLastStep || "—",
      initExitKind: initExitKind || "—",
      initStepCount: Number(loadDiag.initStepCount) || initTrace.length || 0,
      chatDetailScriptPipelinePhase: pickStr(loadDiag.chatDetailScriptPipelinePhase),
      initTrace,
      threadId: pickStr(loadDiag.threadId, loadDiag.chatDetailResolvedThreadId),
      listingId: pickStr(loadDiag.listingId, loadDiag.chatDetailListingId),
      roomId: pickStr(loadDiag.roomId, loadDiag.chatDetailResolvedThreadId),
      participantId: pickStr(loadDiag.participantId, loadDiag.queryUserId),
      demoProfile: pickStr(loadDiag.demoProfile),
      threadKind: pickStr(loadDiag.threadKind),
      frameIsChatDetail,
      loadDiag,
      side,
      prefix,
    };
  }

  function buildNotifyDisplayLoadDiagnostics(snapshot, options) {
    const aRecipient = pickStr(snapshot.actorAId);
    const bRecipient = pickStr(snapshot.actorBId);
    const aNotifyTitlePattern = resolveBenchANotifyTitlePattern(snapshot);
    const bNotifyTitlePattern = resolveBenchBNotifyTitlePattern(snapshot);
    const aNotify = buildSideNotificationLoadFields(
      "frame-a-notify",
      aRecipient,
      aNotifyTitlePattern,
      options
    );
    const bNotify = buildSideNotificationLoadFields(
      "frame-b-notify",
      bRecipient,
      bNotifyTitlePattern,
      options
    );
    const aChat = buildSideChatLoadFields(snapshot, "A");
    const bChat = buildSideChatLoadFields(snapshot, "B");
    const postHire = isPostHireEvalContext(snapshot);
    const completionReviewNotify = buildCompletionReviewNotifyDiagnostics(snapshot);
    const benchRun = buildBenchRunDiagnostics(snapshot);
    return {
      postHire,
      completionReviewNotify,
      benchRun,
      expectedANotificationRecipient: aRecipient || "—",
      actualANotificationStoreCount: aNotify.storeCount,
      actualANotificationRowsCount: aNotify.rowsCount,
      latestANotificationType: aNotify.latestType,
      latestANotificationTitle: aNotify.latestTitle,
      latestANotificationHref: aNotify.latestHref,
      isANotificationInStore: aNotify.inStore,
      isANotificationRenderedInRows: aNotify.renderedInRows,
      aNotificationRenderDiff: aNotify.renderDiff,
      _filterDropReason: pickStr(
        aNotify.renderDiag?.filterDropReason,
        readNotifyRenderDiagFromFrame("frame-a-notify").filterDropReason
      ),
      actualBNotificationStoreCount: bNotify.storeCount,
      actualBNotificationRowsCount: bNotify.rowsCount,
      latestBNotificationType: bNotify.latestType,
      latestBNotificationTitle: bNotify.latestTitle,
      latestBNotificationHref: bNotify.latestHref,
      isBNotificationInStore: bNotify.inStore,
      isBNotificationRenderedInRows: bNotify.renderedInRows,
      bNotificationRenderDiff: bNotify.renderDiff,
      expectedAChatHref: aChat.expectedChatHref,
      actualAChatFrameSrc: aChat.actualChatFrameSrc,
      actualAChatDetailUrl: aChat.actualChatDetailUrl,
      aChatDetailReached: aChat.chatDetailReached,
      aChatDetailInitStarted: aChat.chatDetailInitStarted,
      chatDetailHtmlReached: aChat.chatDetailHtmlReached,
      chatDetailScriptLoaded: aChat.chatDetailScriptLoaded,
      chatDetailScriptVersion: aChat.chatDetailScriptVersion || "—",
      chatDetailDiagWindowKeys: aChat.chatDetailDiagWindowKeys || "—",
      chatDetailScriptLoadError: aChat.chatDetailScriptLoadError || "—",
      chatDetailScriptTagSrc: aChat.chatDetailScriptTagSrc || "—",
      aChatThreadResolved: aChat.chatThreadResolved,
      aChatRoomResolved: aChat.chatRoomResolved,
      aComposerRendered: aChat.composerRendered,
      aChatLoadReady: aChat.chatLoadReady,
      aChatLoadErrorReason: aChat.chatLoadErrorReason,
      expectedBChatHref: bChat.expectedChatHref,
      actualBChatFrameSrc: bChat.actualChatFrameSrc,
      actualBChatDetailUrl: bChat.actualChatDetailUrl,
      bChatDetailReached: bChat.chatDetailReached,
      bChatDetailInitStarted: bChat.chatDetailInitStarted,
      bChatThreadResolved: bChat.chatThreadResolved,
      bChatRoomResolved: bChat.chatRoomResolved,
      bComposerRendered: bChat.composerRendered,
      bChatLoadReady: bChat.chatLoadReady,
      bChatLoadErrorReason: bChat.chatLoadErrorReason,
      _aNotify: aNotify,
      _bNotify: bNotify,
      _aChat: aChat,
      _bChat: bChat,
    };
  }

  function makeNotifyDisplayLoadFailure(code, detail, expected, actual, diff, stage, snapshot) {
    const meta = NOTIFY_DISPLAY_LOAD_META[code] || {};
    const profileFix = snapshot ? resolveNotifyDisplayFixTarget(code, snapshot) : null;
    const fix = profileFix || FIX_MAP[code] || {};
    return {
      code,
      name: code,
      detail: pickStr(detail),
      stage: pickStr(stage, "chat"),
      cause: pickStr(meta.cause, detail),
      expected: pickStr(expected, "—"),
      actual: pickStr(actual, "—"),
      diff: pickStr(diff, "NG"),
      targetFile: pickStr(profileFix?.targetFile, meta.targetFile, fix.files?.[0], "—"),
      targetFunction: pickStr(profileFix?.targetFunction, meta.targetFunction, fix.fns?.[0], "—"),
    };
  }

  function evaluateNotifyDisplayLoadFailures(snapshot, ndl) {
    const d = ndl || buildNotifyDisplayLoadDiagnostics(snapshot);
    if (!d.postHire) return [];
    const failures = [];
    const aRecipient = pickStr(d.expectedANotificationRecipient);
    const expHref = d.expectedAChatHref !== "—" ? d.expectedAChatHref : "";
    const aNotifyExpectedLabel = resolveBenchANotifyTitleExpectedLabel(snapshot);

    if (aRecipient && !d.isANotificationInStore) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.A_NOTIFICATION_STORE_MISSING,
          `A notification missing in store for ${aRecipient}`,
          `store>=1 (${aNotifyExpectedLabel})`,
          String(d.actualANotificationStoreCount),
          d.aNotificationRenderDiff,
          "notification",
          snapshot
        )
      );
    } else if (d.isANotificationInStore && !d.isANotificationRenderedInRows) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.A_NOTIFICATION_ROWS_MISSING,
          `store=${d.actualANotificationStoreCount} rows=${d.actualANotificationRowsCount}`,
          "rows>=1",
          String(d.actualANotificationRowsCount),
          d.aNotificationRenderDiff,
          "notification"
        )
      );
    } else if (d.isANotificationInStore && !d._aNotify?.hrefValid) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.A_NOTIFICATION_HREF_MISSING,
          `href=${d.latestANotificationHref}`,
          "valid chat-detail href",
          d.latestANotificationHref,
          d.aNotificationRenderDiff,
          "notification",
          snapshot
        )
      );
    }

    const chatEval =
      d.postHire ||
      pickStr(d.actualAChatFrameSrc) ||
      d.aChatDetailReached ||
      d.aChatDetailInitStarted;
    if (!chatEval) return failures;

    if (pickStr(d.actualAChatFrameSrc) && !d._aChat?.frameIsChatDetail) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.A_CHAT_FRAME_SRC_MISSING,
          `frame src=${d.actualAChatFrameSrc}`,
          "chat-detail.html",
          d.actualAChatFrameSrc,
          `NG expected chat-detail actual=${d.actualAChatFrameSrc}`,
          "chat"
        )
      );
      return failures;
    }

    if (pickStr(d.actualAChatFrameSrc) && d._aChat?.frameIsChatDetail && !d.aChatDetailReached) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.A_CHAT_DETAIL_NOT_REACHED,
          "chat-detail init not started",
          "chatDetailReached=true",
          String(d.aChatDetailReached),
          `initStarted=${d.aChatDetailInitStarted}`,
          "chat"
        )
      );
      return failures;
    }

    if (d.aChatDetailReached && d.chatDetailScriptLoaded !== true) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.CHAT_DETAIL_SCRIPT_NOT_LOADED,
          pickStr(d.chatDetailScriptLoadError, "chat-detail.js not executed in A iframe"),
          "chatDetailScriptLoaded=true",
          String(d.chatDetailScriptLoaded),
          `version=${d.chatDetailScriptVersion} keys=${d.chatDetailDiagWindowKeys} loadError=${d.chatDetailScriptLoadError}`,
          "chat"
        )
      );
      return failures;
    }

    if (d.aChatDetailReached && !d.aChatThreadResolved) {
      const trd = readThreadResolveDiagFromFrame("frame-a-chat");
      const diagMissing =
        pickStr(trd.phase) === "—" ||
        (pickStr(trd.urlThreadId) === "—" &&
          pickStr(trd.failStep) === "—" &&
          pickStr(trd.failReason) === "—");
      if (diagMissing) {
        failures.push(
          makeNotifyDisplayLoadFailure(
            NG_CODES.THREAD_RESOLVE_DIAG_MISSING,
            "thread resolve diag not published from chat-detail iframe",
            "urlThreadId/query fields/failStep/failReason populated",
            "empty diag",
            `phase=${trd.phase} ensureCalled=${trd.ensureCalled}`,
            "chat"
          )
        );
      }
      const failDetail = pickStr(
        trd.failReason !== "—" ? trd.failReason : "",
        trd.failStep !== "—" && trd.failReason !== "—"
          ? `${trd.failStep}: ${trd.failReason}`
          : "",
        d.aChatLoadErrorReason,
        "unknown_thread_resolve_failure"
      );
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.A_CHAT_THREAD_UNRESOLVED,
          failDetail,
          pickStr(snapshot.threadId, trd.urlThreadId, "thread resolved"),
          String(d.aChatThreadResolved),
          `thread解決内部トレース failStep=${trd.failStep} failReason=${trd.failReason}`,
          "chat"
        )
      );
      return failures;
    }

    if (d.aChatDetailReached && d.aChatThreadResolved && !d.aChatRoomResolved) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.A_CHAT_ROOM_UNRESOLVED,
          pickStr(d.aChatLoadErrorReason, "room unresolved"),
          "roomExists=true",
          String(d.aChatRoomResolved),
          `error=${d.aChatLoadErrorReason}`,
          "chat"
        )
      );
      return failures;
    }

    if (d.aChatDetailReached && d.aChatRoomResolved && !d.aChatLoadReady) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.A_CHAT_LOAD_READY_MISSING,
          pickStr(d.aChatLoadErrorReason, "chatLoadReady=false"),
          "chatLoadReady=true",
          String(d.aChatLoadReady),
          `error=${d.aChatLoadErrorReason}`,
          "chat"
        )
      );
      return failures;
    }

    if (
      d.aChatDetailReached &&
      d.aChatRoomResolved &&
      d.aChatLoadReady &&
      !d.aComposerRendered &&
      snapshot.stage === "active"
    ) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.A_CHAT_COMPOSER_MISSING,
          "composer not rendered",
          "composerRendered=true",
          String(d.aComposerRendered),
          `chatLoadReady=${d.aChatLoadReady}`,
          "chat"
        )
      );
    }

    if (expHref && d.actualAChatFrameSrc && d._aChat?.frameIsChatDetail) {
      const tid = pickStr(snapshot.threadId);
      if (tid && !String(d.actualAChatFrameSrc).includes(tid) && !String(d.actualAChatDetailUrl).includes(tid)) {
        failures.push(
          makeNotifyDisplayLoadFailure(
            NG_CODES.A_CHAT_FRAME_SRC_MISSING,
            `threadId missing in chat URL`,
            expHref,
            d.actualAChatFrameSrc,
            `NG thread=${tid}`,
            "chat"
          )
        );
      }
    }

    return failures;
  }

  function isDomElementVisible(el, view) {
    if (!el || !view) return false;
    if (el.hidden) return false;
    try {
      const st = view.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch {
      return false;
    }
  }

  function readChatDomActual(frameId) {
    try {
      const frameEl = global.document?.getElementById(frameId);
      const win = frameEl?.contentWindow;
      const doc = win?.document;
      const view = win || global;
      const benchDom = win?.__tasuBenchChatDomDiag || {};
      const unavailableEl = doc?.querySelector(".chat-room-unavailable__title");
      const inlineErrorEl = doc?.getElementById("chatInlineError");
      const errorText = pickStr(
        benchDom.actualChatErrorText,
        unavailableEl?.textContent,
        inlineErrorEl?.textContent
      );
      const errorVisible =
        benchDom.actualChatErrorVisible === true ||
        isDomElementVisible(unavailableEl, view) ||
        (isDomElementVisible(inlineErrorEl, view) && pickStr(inlineErrorEl?.textContent));
      const chatInput = doc?.getElementById("chatInput");
      const composerExists = benchDom.actualComposerDomExists === true || Boolean(chatInput);
      const composerVisible =
        benchDom.actualComposerVisible === true || isDomElementVisible(chatInput, view);
      const messagesEl = doc?.getElementById("chatMessages");
      const bodyText = pickStr(doc?.body?.innerText, doc?.body?.textContent);
      return {
        actualChatErrorText: errorText || "—",
        actualChatErrorVisible: errorVisible,
        actualComposerDomExists: composerExists,
        actualComposerVisible: composerVisible,
        actualMessageListExists:
          benchDom.actualMessageListExists === true || Boolean(messagesEl),
        actualChatRootExists:
          benchDom.actualChatRootExists === true || Boolean(doc?.body),
        actualChatDetailPageReadyAttr: pickStr(
          doc?.body?.dataset?.chatDetailReady,
          benchDom.actualChatDetailPageReadyAttr,
          "—"
        ),
        actualBodyTextIncludesChatError:
          benchDom.actualBodyTextIncludesChatError === true ||
          CHAT_ERROR_TEXT_PATTERN.test(bodyText),
        benchDom,
      };
    } catch {
      return {
        actualChatErrorText: "—",
        actualChatErrorVisible: false,
        actualComposerDomExists: false,
        actualComposerVisible: false,
        actualMessageListExists: false,
        actualChatRootExists: false,
        actualChatDetailPageReadyAttr: "—",
        actualBodyTextIncludesChatError: false,
        benchDom: {},
      };
    }
  }

  function readNotifyDomActual(frameId, options) {
    try {
      const win = global.document?.getElementById(frameId)?.contentWindow;
      const doc = win?.document;
      const benchDom = win?.__tasuBenchNotifyDomDiag || {};
      const renderDiag = win?.__tasuBenchNotifyRenderDiag || {};
      if (options?.lightMode === true) {
        const cardCount = Number(
          benchDom.actualNotifyRowDomCount ?? renderDiag.domCardCount ?? renderDiag.rowsLength ?? 0
        );
        return {
          actualNotifyRowDomCount: cardCount,
          actualNotifyLatestRowText: pickStr(
            benchDom.actualNotifyLatestRowText,
            renderDiag.latestRowTitle,
            "—"
          ),
          actualNotifyLatestHref: pickStr(
            benchDom.actualNotifyLatestHref,
            renderDiag.latestRowHref,
            "—"
          ),
          actualNotifyErrorText: pickStr(benchDom.actualNotifyErrorText, "—"),
          actualNotifyErrorVisible: benchDom.actualNotifyErrorVisible === true,
          actualNotifyEmptyTextVisible:
            benchDom.actualNotifyEmptyTextVisible === true || cardCount < 1,
          actualNotifyEmptyText: pickStr(benchDom.actualNotifyEmptyText, "—"),
          benchDom,
        };
      }
      const cards = doc ? [...doc.querySelectorAll(".talk-notify-card")] : [];
      const firstCard = cards[0];
      const cta = firstCard?.querySelector(
        "[data-talk-notify-action], .talk-notify-card__minimal-action, .talk-notify-card__card-cta"
      );
      const emptyEl = doc?.querySelector(".talk-notify-empty-state__title");
      const errorEl = doc?.querySelector(
        ".talk-notify-error, [data-talk-notify-error], .talk-notify-load-error"
      );
      const href = pickStr(
        benchDom.actualNotifyLatestHref,
        cta?.getAttribute("href"),
        cta?.dataset?.href,
        firstCard?.querySelector("a[href]")?.getAttribute("href")
      );
      return {
        actualNotifyRowDomCount: Number(
          benchDom.actualNotifyRowDomCount ?? cards.length ?? 0
        ),
        actualNotifyLatestRowText: pickStr(
          benchDom.actualNotifyLatestRowText,
          firstCard?.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event")
            ?.textContent,
          "—"
        ),
        actualNotifyLatestHref: href || "—",
        actualNotifyErrorText: pickStr(
          benchDom.actualNotifyErrorText,
          errorEl?.textContent,
          "—"
        ),
        actualNotifyErrorVisible:
          benchDom.actualNotifyErrorVisible === true || isDomElementVisible(errorEl, win),
        actualNotifyEmptyTextVisible:
          benchDom.actualNotifyEmptyTextVisible === true ||
          isDomElementVisible(emptyEl, win),
        actualNotifyEmptyText: pickStr(
          benchDom.actualNotifyEmptyText,
          emptyEl?.textContent,
          "—"
        ),
        benchDom,
      };
    } catch {
      return {
        actualNotifyRowDomCount: 0,
        actualNotifyLatestRowText: "—",
        actualNotifyLatestHref: "—",
        actualNotifyErrorText: "—",
        actualNotifyErrorVisible: false,
        actualNotifyEmptyTextVisible: false,
        actualNotifyEmptyText: "—",
        benchDom: {},
      };
    }
  }

  function makeDiagDomFailure(code, expected, actual, diff, stage) {
    const meta = DIAG_DOM_CONSISTENCY_META[code] || NOTIFY_DISPLAY_LOAD_META[code] || {};
    const fix = FIX_MAP[code] || {};
    return {
      code,
      name: code,
      detail: `${DIAG_DOM_FALSE_POSITIVE_CAUSE}: ${diff}`,
      stage: pickStr(stage, "chat"),
      cause: pickStr(meta.cause, DIAG_DOM_FALSE_POSITIVE_CAUSE),
      expected: pickStr(expected, "—"),
      actual: pickStr(actual, "—"),
      diff: pickStr(diff, "NG"),
      targetFile: pickStr(meta.targetFile, fix.files?.[0], "—"),
      targetFunction: pickStr(meta.targetFunction, fix.fns?.[0], "—"),
      isDomConsistency: true,
    };
  }

  function buildDiagDomConsistencyDiagnostics(snapshot, ndl, options) {
    const d = ndl || buildNotifyDisplayLoadDiagnostics(snapshot, options);
    const light = options?.lightMode === true;
    const aChatDom = light ? {} : readChatDomActual("frame-a-chat");
    const bChatDom = light ? {} : readChatDomActual("frame-b-chat");
    const aNotifyDom = readNotifyDomActual("frame-a-notify", options);
    const bNotifyDom = readNotifyDomActual("frame-b-notify", options);
    return {
      aChatDom,
      bChatDom,
      aNotifyDom,
      bNotifyDom,
      diagChatLoadReady: d.aChatLoadReady,
      diagChatRoomResolved: d.aChatRoomResolved,
      diagNotifyRowsCount: d.actualANotificationRowsCount,
      diagNotifyRenderedInRows: d.isANotificationRenderedInRows,
    };
  }

  function evaluateDiagDomConsistencyFailures(snapshot, ddc, ndl) {
    const d = ndl || buildNotifyDisplayLoadDiagnostics(snapshot);
    const dom = ddc || buildDiagDomConsistencyDiagnostics(snapshot, d);
    const a = dom.aChatDom || {};
    const an = dom.aNotifyDom || {};
    const failures = [];
    const chatFrameOpen =
      d.postHire ||
      d.aChatDetailReached ||
      /chat-detail\.html/i.test(pickStr(d.actualAChatFrameSrc));
    const notifyFrameOpen = d.postHire || pickStr(d.expectedANotificationRecipient);

    if (chatFrameOpen) {
      if (d.aChatLoadReady === true && a.actualChatErrorVisible === true) {
        failures.push(
          makeDiagDomFailure(
            NG_CODES.CHAT_DIAG_OK_BUT_ERROR_DOM_VISIBLE,
            "aChatLoadReady=true かつ error DOM 非表示",
            `errorVisible=true text=${a.actualChatErrorText}`,
            `diag.aChatLoadReady=true vs dom.actualChatErrorVisible=true`,
            "chat"
          )
        );
      }
      if (d.aChatLoadReady === true && !a.actualComposerDomExists) {
        failures.push(
          makeDiagDomFailure(
            NG_CODES.CHAT_DIAG_OK_BUT_COMPOSER_MISSING_DOM,
            "aChatLoadReady=true かつ composer DOM 存在",
            `composerDomExists=${a.actualComposerDomExists}`,
            `diag.aChatLoadReady=true vs dom.actualComposerDomExists=false`,
            "chat"
          )
        );
      }
      if (d.aChatRoomResolved === true && a.actualBodyTextIncludesChatError === true) {
        failures.push(
          makeDiagDomFailure(
            NG_CODES.DIAGNOSTIC_FALSE_POSITIVE,
            "aChatRoomResolved=true かつ body に chat error 文言なし",
            `bodyIncludesChatError=true text=${a.actualChatErrorText}`,
            `diag.aChatRoomResolved=true vs dom.actualBodyTextIncludesChatError=true`,
            "chat"
          )
        );
      }
    }

    if (notifyFrameOpen) {
      if (d.actualANotificationRowsCount > 0 && an.actualNotifyRowDomCount === 0) {
        failures.push(
          makeDiagDomFailure(
            NG_CODES.NOTIFY_DIAG_OK_BUT_ROW_MISSING_DOM,
            `rowsCount=${d.actualANotificationRowsCount} かつ notifyRowDomCount>=1`,
            `domRowCount=${an.actualNotifyRowDomCount}`,
            `diag.rows=${d.actualANotificationRowsCount} vs dom.cards=0`,
            "notification"
          )
        );
      }
      if (
        (d.isANotificationRenderedInRows === true || d.actualANotificationRowsCount > 0) &&
        an.actualNotifyEmptyTextVisible === true &&
        an.actualNotifyRowDomCount === 0
      ) {
        failures.push(
          makeDiagDomFailure(
            NG_CODES.NOTIFY_DIAG_OK_BUT_ROW_MISSING_DOM,
            "通知カード DOM 表示",
            `emptyVisible=true text=${an.actualNotifyEmptyText}`,
            `diag.renderedInRows=${d.isANotificationRenderedInRows} vs dom.empty=true`,
            "notification"
          )
        );
      }
      if (d.isANotificationRenderedInRows === true && !pickStr(an.actualNotifyLatestHref, d.latestANotificationHref)) {
        failures.push(
          makeDiagDomFailure(
            NG_CODES.A_NOTIFICATION_HREF_MISSING,
            "notify card href 設定",
            `domHref=${an.actualNotifyLatestHref || "—"}`,
            `diag.renderedInRows=true vs dom.href empty`,
            "notification"
          )
        );
      }
      const notifyDiagOk =
        d.isANotificationRenderedInRows === true ||
        (d.actualANotificationRowsCount > 0 && !failures.some((f) => f.code === NG_CODES.NOTIFY_DIAG_OK_BUT_ROW_MISSING_DOM));
      if (notifyDiagOk && an.actualNotifyErrorVisible === true) {
        failures.push(
          makeDiagDomFailure(
            NG_CODES.NOTIFY_DIAG_OK_BUT_ERROR_DOM_VISIBLE,
            "通知 error DOM 非表示",
            `error=${an.actualNotifyErrorText}`,
            `notifyDiagOk vs dom.actualNotifyErrorVisible=true`,
            "notification"
          )
        );
      }
    }

    const seen = new Set();
    return failures.filter((f) => {
      if (seen.has(f.code)) return false;
      seen.add(f.code);
      return true;
    });
  }

  function readBenchRunMeta() {
    try {
      const meta = global.__tasuBenchRunMeta || {};
      return {
        currentRunId: pickStr(meta.currentRunId, "1"),
        lastResetAt: pickStr(meta.lastResetAt, "—"),
        resetToken: pickStr(meta.resetToken, "—"),
        staleStateDetected: meta.staleStateDetected === true,
        previousRunThreadId: pickStr(meta.previousRunThreadId),
        previousRunApplicationId: pickStr(meta.previousRunApplicationId),
        lastResetReason: pickStr(meta.lastResetReason),
        framesReloadedAfterReset: meta.framesReloadedAfterReset === true,
      };
    } catch {
      return {
        currentRunId: "1",
        lastResetAt: "—",
        resetToken: "—",
        staleStateDetected: false,
        previousRunThreadId: "",
        previousRunApplicationId: "",
        lastResetReason: "",
        framesReloadedAfterReset: false,
      };
    }
  }

  function readIframeBenchRunId(frameId) {
    try {
      const el = global.document?.getElementById(frameId);
      const href = pickStr(el?.src);
      if (!href || href === "about:blank") return "";
      const u = new URL(href, "http://localhost/");
      return pickStr(u.searchParams.get("benchRunId"));
    } catch {
      return "";
    }
  }

  function evaluateBenchStaleFailures(snapshot) {
    const meta = readBenchRunMeta();
    const failures = [];
    const currentRunId = pickStr(meta.currentRunId, "1");

    if (meta.staleStateDetected) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.BENCH_STALE_STATE_DETECTED,
          `previousThread=${meta.previousRunThreadId || "—"}`,
          "clean bench state",
          "stale",
          `runId=${currentRunId} resetToken=${meta.resetToken}`,
          "bench"
        )
      );
    }

    if (meta.lastResetAt && meta.lastResetAt !== "—") {
      const frameIds = ["frame-a-notify", "frame-a-chat", "frame-b-notify", "frame-b-chat"];
      const staleFrames = frameIds.filter((id) => {
        const run = readIframeBenchRunId(id);
        return run && currentRunId && run !== currentRunId;
      });
      if (staleFrames.length) {
        failures.push(
          makeNotifyDisplayLoadFailure(
            NG_CODES.BENCH_IFRAME_NOT_RELOADED_AFTER_RESET,
            `frames=${staleFrames.join(",")}`,
            `benchRunId=${currentRunId}`,
            staleFrames.map((id) => `${id}:${readIframeBenchRunId(id) || "—"}`).join(" "),
            `not reloaded after reset at ${meta.lastResetAt}`,
            "bench"
          )
        );
      }
    }

    const prevThread = pickStr(meta.previousRunThreadId);
    const activeThread = pickStr(snapshot?.threadId);
    const afterReset = pickStr(meta.lastResetAt) && meta.lastResetAt !== "—";
    if (afterReset && prevThread && global.TasuChatThreadStore?.threadExists?.(prevThread)) {
      failures.push(
        makeNotifyDisplayLoadFailure(
          NG_CODES.BENCH_OLD_THREAD_REUSED,
          prevThread,
          "thread removed",
          "exists",
          `old thread still in store after reset`,
          "bench"
        )
      );
    }
    if (afterReset && global.TasuChatThreadStore?.readAll) {
      const benchUsers = new Set(
        [pickStr(snapshot?.actorAId), pickStr(snapshot?.actorBId)].filter(Boolean)
      );
      const orphanChatThreads = (global.TasuChatThreadStore.readAll() || []).filter((t) => {
        const id = String(t?.id || "");
        if (!/^chat-/i.test(id)) return false;
        if (id === activeThread) return false;
        if (prevThread && id === prevThread) return false;
        const participants = Array.isArray(t.participantIds) ? t.participantIds.map(String) : [];
        return participants.some((p) => benchUsers.has(p));
      });
      orphanChatThreads.slice(0, 2).forEach((t) => {
        failures.push(
          makeNotifyDisplayLoadFailure(
            NG_CODES.BENCH_OLD_THREAD_REUSED,
            pickStr(t.id),
            "single active chat-* thread",
            "extra chat-* thread",
            `listing=${pickStr(t.listingId)} kind=${pickStr(t.threadKind)}`,
            "bench"
          )
        );
      });
    }

    const prevApp = pickStr(meta.previousRunApplicationId);
    if (prevApp && prevThread && global.TasuJobApplicationsStore?.findApplication) {
      const listingId = pickStr(
        snapshot?.thread?.listingId,
        global.TasuPlatformChatLiveFlow?.DETAIL_LISTING_BY_CATEGORY?.job
      );
      const app = listingId
        ? global.TasuJobApplicationsStore.findApplication(listingId, prevApp)
        : null;
      if (app && pickStr(app.thread_id) === prevThread) {
        failures.push(
          makeNotifyDisplayLoadFailure(
            NG_CODES.BENCH_OLD_THREAD_REUSED,
            `application=${prevApp} thread=${prevThread}`,
            "application without old thread",
            pickStr(app.thread_id),
            `application still references old thread`,
            "bench"
          )
        );
      }
    }

    const aId = pickStr(snapshot?.actorAId);
    const bId = pickStr(snapshot?.actorBId);
    if (global.TasuTalkNotifications?.getAll) {
      const staleRefs = [prevThread].filter(Boolean);
      const staleNotifies = (global.TasuTalkNotifications.getAll() || []).filter((n) => {
        const recipient = pickStr(n.recipientUserId);
        if (recipient !== aId && recipient !== bId) return false;
        const id = String(n.id || "");
        const href = pickStr(n.href, n.targetUrl);
        const threadId = pickStr(n.threadId, n.thread_id);
        const title = String(n.title || "");
        const referencesStale = staleRefs.some(
          (s) =>
            threadId === s ||
            id.includes(s) ||
            href.includes(s) ||
            href.includes(encodeURIComponent(s))
        );
        if (referencesStale) return true;
        if (/^platform-chat-review-received-/i.test(id) && referencesStale) return true;
        if (/^platform-chat-completion-/i.test(id) && referencesStale) return true;
        if (/レビューされました|やり取り完了/i.test(title) && referencesStale) return true;
        return false;
      });
      staleNotifies.slice(0, 3).forEach((staleNotify) => {
        failures.push(
          makeNotifyDisplayLoadFailure(
            NG_CODES.BENCH_OLD_NOTIFICATION_REUSED,
            pickStr(staleNotify.id),
            "no old-thread notify",
            pickStr(staleNotify.title),
            `href still references ${pickStr(staleNotify.threadId, prevThread)}`,
            "bench"
          )
        );
      });
    }

    return failures;
  }

  function buildBenchRunDiagnostics(snapshot) {
    const meta = readBenchRunMeta();
    return {
      ...meta,
      iframeRunIds: {
        aNotify: readIframeBenchRunId("frame-a-notify"),
        aChat: readIframeBenchRunId("frame-a-chat"),
        bNotify: readIframeBenchRunId("frame-b-notify"),
        bChat: readIframeBenchRunId("frame-b-chat"),
      },
      activeThreadId: pickStr(snapshot?.threadId),
    };
  }

  const BENCH_NG_BULK_COPY_MAX = 24000;
  const BENCH_NG_HISTORY_MAX = 32;

  function trimBenchGlobalCopyText(value, maxLen) {
    const text = pickStr(value);
    if (!text) return "";
    const cap = Number.isFinite(maxLen) ? maxLen : BENCH_NG_BULK_COPY_MAX;
    return text.length > cap ? `${text.slice(0, cap)}\n…(truncated)` : text;
  }

  function slimChatSideDiag(diag) {
    const d = diag && typeof diag === "object" ? diag : {};
    return {
      at: pickStr(d.at),
      currentUserId: pickStr(d.currentUserId),
      stage: pickStr(d.stage),
      roomStatus: pickStr(d.roomStatus),
      canRequestEnd: d.canRequestEnd === true,
      requestButtonVisible: d.requestButtonVisible === true,
      confirmEndButtonVisible: d.confirmEndButtonVisible === true,
      endButtonText: pickStr(d.endButtonText, d.actualButton),
      buttonHiddenReason: pickStr(d.buttonHiddenReason),
      hasAnyMessage: d.hasAnyMessage === true,
    };
  }

  function clearBenchDiagnosticCache() {
    try {
      delete global.__tasuBenchFlowDiag;
      delete global.__tasuBenchStageVerdicts;
      delete global.__tasuBenchThreadResolveDiag;
      delete global.__tasuBenchFocusDiag;
      delete global.__tasuJobHireFlowDiag;
      delete global.__tasuBenchCursorFixText;
      delete global.__tasuBenchSectionCopyTexts;
      delete global.__tasuBenchNgBlockCopyTexts;
      delete global.__tasuBenchNgBlocksBulkCopyText;
    } catch {
      /* ignore */
    }
  }

  function evaluateBenchDisplayFailures(snapshot, stages, options) {
    const light = options?.lightMode === true;
    const includePurchase = options?.includePurchaseRuntime !== false;
    const ndl =
      stages?.notifyDisplayLoad || buildNotifyDisplayLoadDiagnostics(snapshot, options);
    const ddc =
      stages?.diagDomConsistency || buildDiagDomConsistencyDiagnostics(snapshot, ndl, options);
    const crn = ndl.completionReviewNotify || buildCompletionReviewNotifyDiagnostics(snapshot);
    const staleFailures = light ? [] : evaluateBenchStaleFailures(snapshot);
    const purchaseRuntimeFailures = includePurchase
      ? [
          ...evaluatePurchaseRuntimeNotificationFailures(snapshot),
          ...evaluateProductShippingNotificationFailures(snapshot),
          ...evaluateProductReceiveConfirmUiFailures(snapshot),
          ...evaluateProductBankTransferFlowFailures(snapshot),
          ...evaluateProductBankTransferReceiveUiFailures(snapshot, options),
          ...evaluateProductCodFlowFailures(snapshot),
        ]
      : [];
    const panelHealthFailures = evaluateBenchPanelHealthFailures(snapshot, options);
    const ndlFailures = evaluateNotifyDisplayLoadFailures(snapshot, ndl);
    const crnFailures = evaluateCompletionReviewNotifyFailures(snapshot, crn);
    const domFailures = evaluateDiagDomConsistencyFailures(snapshot, ddc, ndl);
    const domCodes = new Set(domFailures.map((f) => f.code));
    const mergedCodes = new Set(domFailures.map((f) => f.code));
    const merged = [
      ...panelHealthFailures,
      ...purchaseRuntimeFailures,
      ...staleFailures,
      ...domFailures,
      ...crnFailures.filter((f) => !mergedCodes.has(f.code)),
      ...ndlFailures.filter((f) => !domCodes.has(f.code) && !mergedCodes.has(f.code)),
    ];
    staleFailures.forEach((f) => mergedCodes.add(f.code));
    crnFailures.forEach((f) => mergedCodes.add(f.code));
    purchaseRuntimeFailures.forEach((f) => mergedCodes.add(`${f.code}::${f.cause}::${f.related?.recipientUserId}`));
    return { failures: merged, ndl, ddc, completionReviewNotify: crn };
  }

  function resolveBenchSectionCopyMeta(panel) {
    const p = panel || {};
    let currentUrl = "—";
    try {
      currentUrl = pickStr(global.location?.href, "—");
    } catch {
      /* ignore */
    }
    return {
      category: pickStr(
        p.categoryLabel,
        p.category,
        p.snapshot?.categoryLabel,
        p.snapshot?.category,
        "—"
      ),
      stage: pickStr(p.flowStage, p.snapshot?.stage, p.focus, "—"),
      currentUrl,
      timestamp: new Date().toISOString(),
    };
  }

  function cmpToFieldRow(label, cmp) {
    if (!cmp) return { label, expected: "—", actual: "—", diff: "—" };
    return {
      label,
      expected: pickStr(cmp.expected, "—"),
      actual: pickStr(cmp.actual, "—"),
      diff: pickStr(cmp.diff, "—"),
    };
  }

  function enrichDisplayFailureForCopy(fail) {
    const f = fail || {};
    return {
      code: pickStr(f.code, "—"),
      stage: pickStr(f.stage, "—"),
      expected: pickStr(f.expected, "—"),
      actual: pickStr(f.actual, "—"),
      diff: pickStr(f.diff, "—"),
      rootCause: pickStr(f.cause, f.detail, "—"),
      fixTargetFile: pickStr(f.targetFile, "—"),
      fixTargetFunction: pickStr(f.targetFunction, "—"),
    };
  }

  function enrichUserConsistencyFailure(fail, uc) {
    const fix = FIX_MAP[fail.code] || {};
    const rootCause = NEXT_ACTION_HINTS[fail.code] || fail.detail;
    let expected = "—";
    let actual = "—";
    let diff = fail.detail;

    if (fail.code === NG_CODES.A_USER_MISMATCH) {
      const cmps = [uc.aNotifyCmp, uc.aTalkCmp, uc.aChatFrameCmp, uc.aChatDetailCmp];
      const bad = cmps.find((c) => c && !c.ok && !c.pending);
      if (bad) {
        expected = bad.expected;
        actual = bad.actual;
        diff = bad.diff;
      } else {
        expected = uc.expectedAUserId || "—";
      }
    } else if (fail.code === NG_CODES.B_USER_MISMATCH) {
      const cmps = [uc.bNotifyCmp, uc.bTalkCmp, uc.bChatFrameCmp, uc.bChatDetailCmp];
      const bad = cmps.find((c) => c && !c.ok && !c.pending);
      if (bad) {
        expected = bad.expected;
        actual = bad.actual;
        diff = bad.diff;
      } else {
        expected = uc.expectedBUserId || "—";
      }
    } else if (fail.code === NG_CODES.A_NOT_PARTICIPANT) {
      expected = uc.expectedAUserId || "—";
      actual = uc.isAInThreadParticipants == null ? "—" : String(uc.isAInThreadParticipants);
      diff = uc.aParticipantCmp?.diff || fail.detail;
    } else if (fail.code === NG_CODES.B_NOT_PARTICIPANT) {
      expected = uc.expectedBUserId || "—";
      actual = uc.isBInThreadParticipants == null ? "—" : String(uc.isBInThreadParticipants);
      diff = uc.bParticipantCmp?.diff || fail.detail;
    } else if (fail.code === NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH) {
      expected = uc.completionCmp?.expected || uc.expectedAUserId || "—";
      actual = uc.completionCmp?.actual || "—";
      diff = uc.completionCmp?.diff || fail.detail;
    } else if (fail.code === NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH) {
      expected = uc.reviewCmp?.expected || uc.expectedAUserId || "—";
      actual = uc.reviewCmp?.actual || "—";
      diff = uc.reviewCmp?.diff || fail.detail;
    }

    return {
      code: fail.code,
      stage: fail.stage,
      expected,
      actual,
      diff,
      rootCause,
      fixTargetFile: pickStr(fix.files?.[0], "—"),
      fixTargetFunction: pickStr(fix.fns?.[0], "—"),
    };
  }

  function formatBenchSectionCopyText(sectionName, meta, failures, fields, summary) {
    const lines = [
      "=== ベンチ診断セクションログ ===",
      `sectionName: ${sectionName}`,
      `category: ${meta.category}`,
      `stage: ${meta.stage}`,
      `timestamp: ${meta.timestamp}`,
      `currentUrl: ${meta.currentUrl}`,
      "",
      "failures:",
    ];
    if (!failures.length) {
      lines.push("(none)");
    } else {
      failures.forEach((f) => {
        lines.push(`- ${f.code}`);
        lines.push(`  stage: ${pickStr(f.stage, meta.stage)}`);
        lines.push(`  expected: ${pickStr(f.expected, "—")}`);
        lines.push(`  actual: ${pickStr(f.actual, "—")}`);
        lines.push(`  diff: ${pickStr(f.diff, "—")}`);
        lines.push(`  rootCause: ${pickStr(f.rootCause, "—")}`);
        lines.push(`  fixTargetFile: ${pickStr(f.fixTargetFile, "—")}`);
        lines.push(`  fixTargetFunction: ${pickStr(f.fixTargetFunction, "—")}`);
      });
    }
    lines.push("", "--- fields ---");
    if (!fields.length) {
      lines.push("(none)");
    } else {
      fields.forEach((row) => {
        lines.push(
          `${row.label}: expected=${row.expected} actual=${row.actual} diff=${row.diff}`
        );
      });
    }
    lines.push("", "--- summary ---");
    lines.push(`rootCause: ${pickStr(summary?.rootCause, "—")}`);
    lines.push(`fixTargetFile: ${pickStr(summary?.fixTargetFile, "—")}`);
    lines.push(`fixTargetFunction: ${pickStr(summary?.fixTargetFunction, "—")}`);
    return lines.join("\n");
  }

  function buildUserIdConsistencySectionCopyText(panel) {
    const p = panel || {};
    const snapshot = p.snapshot || {};
    const uc = p.stages?.userConsistency || buildUserIdConsistencyDiagnostics(snapshot);
    const meta = resolveBenchSectionCopyMeta(p);
    const sectionName = BENCH_CONSISTENCY_SECTION_NAMES[BENCH_CONSISTENCY_SECTION_KEYS.USER_ID];
    const failures = evaluateUserConsistencyFailures(snapshot, uc).map((f) =>
      enrichUserConsistencyFailure(f, uc)
    );
    const fields = [
      {
        label: "expectedAUserId",
        expected: uc.expectedAUserId || "—",
        actual: uc.expectedAUserId || "—",
        diff: "—",
      },
      cmpToFieldRow("actualANotifyFrameUserId", uc.aNotifyCmp),
      cmpToFieldRow("actualATalkHomeUserId", uc.aTalkCmp),
      cmpToFieldRow("actualAChatFrameUserId", uc.aChatFrameCmp),
      cmpToFieldRow("actualAChatDetailQueryUserId", uc.aChatDetailCmp),
      {
        label: "expectedBUserId",
        expected: uc.expectedBUserId || "—",
        actual: uc.expectedBUserId || "—",
        diff: "—",
      },
      cmpToFieldRow("actualBNotifyFrameUserId", uc.bNotifyCmp),
      cmpToFieldRow("actualBTalkHomeUserId", uc.bTalkCmp),
      cmpToFieldRow("actualBChatFrameUserId", uc.bChatFrameCmp),
      cmpToFieldRow("actualBChatDetailQueryUserId", uc.bChatDetailCmp),
      {
        label: "threadParticipants",
        expected: "includes A+B",
        actual: uc.threadParticipants || "—",
        diff: "—",
      },
      cmpToFieldRow("isAInThreadParticipants", uc.aParticipantCmp),
      cmpToFieldRow("isBInThreadParticipants", uc.bParticipantCmp),
      cmpToFieldRow("completionNotifyRecipient", uc.completionCmp),
      cmpToFieldRow("reviewNotifyRecipient", uc.reviewCmp),
    ];
    const first = failures[0];
    const summary = {
      rootCause: first?.rootCause || "OK（expected/actual 一致）",
      fixTargetFile: first?.fixTargetFile || "—",
      fixTargetFunction: first?.fixTargetFunction || "—",
    };
    return formatBenchSectionCopyText(sectionName, meta, failures, fields, summary);
  }

  function buildNotifyDisplayLoadSectionCopyText(panel) {
    const p = panel || {};
    const snapshot = p.snapshot || {};
    const ndl = p.stages?.notifyDisplayLoad || buildNotifyDisplayLoadDiagnostics(snapshot);
    const meta = resolveBenchSectionCopyMeta(p);
    const sectionName =
      BENCH_CONSISTENCY_SECTION_NAMES[BENCH_CONSISTENCY_SECTION_KEYS.NOTIFY_DISPLAY_LOAD];
    const failures = evaluateNotifyDisplayLoadFailures(snapshot, ndl).map(enrichDisplayFailureForCopy);
    const fields = [
      {
        label: "expectedANotificationRecipient",
        expected: ndl.expectedANotificationRecipient || "—",
        actual: ndl.expectedANotificationRecipient || "—",
        diff: "—",
      },
      {
        label: "actualANotificationStoreCount",
        expected: ">=1",
        actual: String(ndl.actualANotificationStoreCount),
        diff: ndl.isANotificationInStore ? "OK" : ndl.postHire ? "NG" : "—",
      },
      {
        label: "actualANotificationRowsCount",
        expected: ">=1",
        actual: String(ndl.actualANotificationRowsCount),
        diff: ndl.isANotificationRenderedInRows ? "OK" : ndl.isANotificationInStore ? "NG" : "—",
      },
      {
        label: "latestANotificationHref",
        expected: "valid href",
        actual: ndl.latestANotificationHref || "—",
        diff: ndl._aNotify?.hrefValid ? "OK" : ndl.isANotificationInStore ? "NG" : "—",
      },
      {
        label: "aNotificationRenderDiff",
        expected: "—",
        actual: ndl.aNotificationRenderDiff || "—",
        diff: "—",
      },
      {
        label: "expectedAChatHref",
        expected: "chat-detail+thread",
        actual: ndl.expectedAChatHref || "—",
        diff: ndl._aChat?.frameIsChatDetail ? "OK" : "NG",
      },
      {
        label: "actualAChatFrameSrc",
        expected: ndl.expectedAChatHref || "chat-detail",
        actual: ndl.actualAChatFrameSrc || "—",
        diff: ndl._aChat?.frameIsChatDetail ? "OK" : "NG",
      },
      {
        label: "actualAChatDetailUrl",
        expected: ndl.expectedAChatHref || "chat-detail",
        actual: ndl.actualAChatDetailUrl || "—",
        diff: ndl.aChatDetailReached ? "OK" : "NG",
      },
      {
        label: "aChatDetailReached",
        expected: "true",
        actual: String(ndl.aChatDetailReached),
        diff: ndl.aChatDetailReached ? "OK" : "NG",
      },
      {
        label: "aChatThreadResolved",
        expected: "true",
        actual: String(ndl.aChatThreadResolved),
        diff: ndl.aChatThreadResolved ? "OK" : ndl.aChatDetailReached ? "NG" : "—",
      },
      {
        label: "aChatRoomResolved",
        expected: "true",
        actual: String(ndl.aChatRoomResolved),
        diff: ndl.aChatRoomResolved ? "OK" : ndl.aChatThreadResolved ? "NG" : "—",
      },
      {
        label: "aComposerRendered",
        expected: "true",
        actual: String(ndl.aComposerRendered),
        diff: ndl.aComposerRendered ? "OK" : ndl.aChatLoadReady ? "NG" : "—",
      },
      {
        label: "aChatLoadReady",
        expected: "true",
        actual: String(ndl.aChatLoadReady),
        diff: ndl.aChatLoadReady ? "OK" : ndl.aChatRoomResolved ? "NG" : "—",
      },
      {
        label: "aChatLoadErrorReason",
        expected: "—",
        actual: ndl.aChatLoadErrorReason || "—",
        diff: "—",
      },
      {
        label: "actualBNotificationStoreCount",
        expected: ">=1",
        actual: String(ndl.actualBNotificationStoreCount),
        diff: ndl.isBNotificationInStore ? "OK" : ndl.postHire ? "NG" : "—",
      },
      {
        label: "actualBNotificationRowsCount",
        expected: ">=1",
        actual: String(ndl.actualBNotificationRowsCount),
        diff: ndl.isBNotificationRenderedInRows ? "OK" : ndl.isBNotificationInStore ? "NG" : "—",
      },
      {
        label: "bChatLoadReady",
        expected: "true",
        actual: String(ndl.bChatLoadReady),
        diff: ndl.bChatLoadReady ? "OK" : "—",
      },
    ];
    const first = failures[0];
    const summary = {
      rootCause: first?.rootCause || (ndl.postHire ? "OK（通知表示・chat-detail読込 一致）" : "— (採用後フロー未到達)"),
      fixTargetFile: first?.fixTargetFile || "—",
      fixTargetFunction: first?.fixTargetFunction || "—",
    };
    return formatBenchSectionCopyText(sectionName, meta, failures, fields, summary);
  }

  function buildDiagDomConsistencySectionCopyText(panel) {
    const p = panel || {};
    const snapshot = p.snapshot || {};
    const ndl = p.stages?.notifyDisplayLoad || buildNotifyDisplayLoadDiagnostics(snapshot);
    const ddc = p.stages?.diagDomConsistency || buildDiagDomConsistencyDiagnostics(snapshot, ndl);
    const a = ddc.aChatDom || {};
    const an = ddc.aNotifyDom || {};
    const meta = resolveBenchSectionCopyMeta(p);
    const sectionName = BENCH_CONSISTENCY_SECTION_NAMES[BENCH_CONSISTENCY_SECTION_KEYS.DIAG_DOM];
    const failures = evaluateDiagDomConsistencyFailures(snapshot, ddc, ndl).map(
      enrichDisplayFailureForCopy
    );
    const fields = [
      {
        label: "aChatLoadReady(diag)",
        expected: "true",
        actual: String(ndl.aChatLoadReady),
        diff: "—",
      },
      {
        label: "actualChatErrorVisible(dom)",
        expected: "false",
        actual: String(a.actualChatErrorVisible),
        diff:
          ndl.aChatLoadReady === true && a.actualChatErrorVisible === true ? "NG" : "OK",
      },
      {
        label: "actualChatErrorText(dom)",
        expected: "—",
        actual: a.actualChatErrorText || "—",
        diff: "—",
      },
      {
        label: "actualComposerDomExists(dom)",
        expected: "true",
        actual: String(a.actualComposerDomExists),
        diff:
          ndl.aChatLoadReady === true && !a.actualComposerDomExists ? "NG" : "OK",
      },
      {
        label: "actualComposerVisible(dom)",
        expected: "true",
        actual: String(a.actualComposerVisible),
        diff: "—",
      },
      {
        label: "actualBodyTextIncludesChatError(dom)",
        expected: "false",
        actual: String(a.actualBodyTextIncludesChatError),
        diff: a.actualBodyTextIncludesChatError ? "NG" : "OK",
      },
      {
        label: "actualANotificationRowsCount(diag)",
        expected: ">=1",
        actual: String(ndl.actualANotificationRowsCount),
        diff: "—",
      },
      {
        label: "actualNotifyRowDomCount(dom)",
        expected: String(ndl.actualANotificationRowsCount),
        actual: String(an.actualNotifyRowDomCount),
        diff:
          ndl.isANotificationRenderedInRows && an.actualNotifyRowDomCount < 1 ? "NG" : "OK",
      },
      {
        label: "actualNotifyLatestHref(dom)",
        expected: ndl.latestANotificationHref || "—",
        actual: an.actualNotifyLatestHref || "—",
        diff: "—",
      },
      {
        label: "actualNotifyErrorVisible(dom)",
        expected: "false",
        actual: String(an.actualNotifyErrorVisible),
        diff: an.actualNotifyErrorVisible ? "NG" : "OK",
      },
      {
        label: "actualNotifyEmptyTextVisible(dom)",
        expected: "false",
        actual: String(an.actualNotifyEmptyTextVisible),
        diff: an.actualNotifyEmptyTextVisible ? "NG" : "OK",
      },
    ];
    const first = failures[0];
    const summary = {
      rootCause: first?.rootCause || (ndl.postHire ? "OK（診断値と実DOM一致）" : "— (未到達)"),
      fixTargetFile: first?.fixTargetFile || "—",
      fixTargetFunction: first?.fixTargetFunction || "—",
    };
    return formatBenchSectionCopyText(sectionName, meta, failures, fields, summary);
  }

  function buildCompletionReviewNotifySectionCopyText(panel) {
    const p = panel || {};
    const snapshot = p.snapshot || {};
    const crn =
      p.stages?.notifyDisplayLoad?.completionReviewNotify ||
      p.stages?.completionReviewNotify ||
      buildCompletionReviewNotifyDiagnostics(snapshot);
    const meta = resolveBenchSectionCopyMeta(p);
    const sectionName =
      BENCH_CONSISTENCY_SECTION_NAMES[BENCH_CONSISTENCY_SECTION_KEYS.COMPLETION_REVIEW_NOTIFY];
    const failures = evaluateCompletionReviewNotifyFailures(snapshot, crn).map(
      enrichDisplayFailureForCopy
    );
    const fields = [
      {
        label: "completionNotifyCreated",
        expected: crn.expectCompletionNotifyForA ? "true" : "—",
        actual: String(crn.completionNotifyCreated),
        diff: crn.completionNotifyCreated ? "OK" : crn.expectCompletionNotifyForA ? "NG" : "—",
      },
      {
        label: "completionNotifyRecipient",
        expected: crn.completionNotifyExpectedRecipient,
        actual: crn.completionNotifyRecipient,
        diff:
          !crn.completionNotifyCreated || !crn.expectCompletionNotifyForA
            ? "—"
            : crn.completionNotifyRecipient === crn.completionNotifyExpectedRecipient
              ? "OK"
              : "NG",
      },
      {
        label: "completionNotifyExpectedRecipient",
        expected: crn.completionNotifyExpectedRecipient,
        actual: crn.completionNotifyExpectedRecipient,
        diff: "—",
      },
      {
        label: "completionNotifyStoreCountForA",
        expected: crn.expectCompletionNotifyForA ? ">=1" : "—",
        actual: String(crn.completionNotifyStoreCountForA),
        diff:
          crn.completionNotifyStoreCountForA > 0
            ? "OK"
            : crn.expectCompletionNotifyForA
              ? "NG"
              : "—",
      },
      {
        label: "completionNotifyRowsCountForA",
        expected: crn.expectCompletionNotifyForA ? ">=1" : "—",
        actual: String(crn.completionNotifyRowsCountForA),
        diff:
          crn.completionNotifyRowsCountForA > 0
            ? "OK"
            : crn.completionNotifyStoreCountForA > 0
              ? "NG"
              : "—",
      },
      {
        label: "completionNotifyHref",
        expected: "valid href",
        actual: crn.completionNotifyHref,
        diff: crn.completionNotifyHref && crn.completionNotifyHref !== "—" ? "OK" : "—",
      },
      {
        label: "completionNotifyDropReason",
        expected: "—",
        actual: crn.completionNotifyDropReason || "—",
        diff: "—",
      },
      {
        label: "reviewNotifyCreated",
        expected: crn.expectReviewNotifyForA ? "true" : "—",
        actual: String(crn.reviewNotifyCreated),
        diff: crn.reviewNotifyCreated ? "OK" : crn.expectReviewNotifyForA ? "NG" : "—",
      },
      {
        label: "reviewNotifyRecipient",
        expected: crn.reviewNotifyExpectedRecipient,
        actual: crn.reviewNotifyRecipient,
        diff:
          !crn.reviewNotifyCreated || !crn.expectReviewNotifyForA
            ? "—"
            : crn.reviewNotifyRecipient === crn.reviewNotifyExpectedRecipient
              ? "OK"
              : "NG",
      },
      {
        label: "reviewNotifyExpectedRecipient",
        expected: crn.reviewNotifyExpectedRecipient,
        actual: crn.reviewNotifyExpectedRecipient,
        diff: "—",
      },
      {
        label: "reviewNotifyStoreCountForA",
        expected: crn.expectReviewNotifyForA ? ">=1" : "—",
        actual: String(crn.reviewNotifyStoreCountForA),
        diff:
          crn.reviewNotifyStoreCountForA > 0 ? "OK" : crn.expectReviewNotifyForA ? "NG" : "—",
      },
      {
        label: "reviewNotifyRowsCountForA",
        expected: crn.expectReviewNotifyForA ? ">=1" : "—",
        actual: String(crn.reviewNotifyRowsCountForA),
        diff:
          crn.reviewNotifyRowsCountForA > 0
            ? "OK"
            : crn.reviewNotifyStoreCountForA > 0
              ? "NG"
              : "—",
      },
      {
        label: "reviewNotifyHref",
        expected: "valid href",
        actual: crn.reviewNotifyHref,
        diff: crn.reviewNotifyHref && crn.reviewNotifyHref !== "—" ? "OK" : "—",
      },
      {
        label: "reviewNotifyDropReason",
        expected: "—",
        actual: crn.reviewNotifyDropReason || "—",
        diff: "—",
      },
    ];
    const first = failures[0];
    const summary = {
      rootCause: first?.rootCause || (crn.evalContext ? "OK（完了・レビュー通知 一致）" : "— (未到達)"),
      fixTargetFile: first?.fixTargetFile || "—",
      fixTargetFunction: first?.fixTargetFunction || "—",
    };
    return formatBenchSectionCopyText(sectionName, meta, failures, fields, summary);
  }

  function buildAllConsistencySectionCopyTexts(panel) {
    return {
      [BENCH_CONSISTENCY_SECTION_KEYS.USER_ID]: buildUserIdConsistencySectionCopyText(panel),
      [BENCH_CONSISTENCY_SECTION_KEYS.NOTIFY_DISPLAY_LOAD]:
        buildNotifyDisplayLoadSectionCopyText(panel),
      [BENCH_CONSISTENCY_SECTION_KEYS.COMPLETION_REVIEW_NOTIFY]:
        buildCompletionReviewNotifySectionCopyText(panel),
      [BENCH_CONSISTENCY_SECTION_KEYS.DIAG_DOM]: buildDiagDomConsistencySectionCopyText(panel),
    };
  }

  function buildConsistencySectionCopyText(sectionKey, panel) {
    const copies = buildAllConsistencySectionCopyTexts(panel);
    return copies[pickStr(sectionKey)] || "";
  }

  function buildBenchNgCopyKey(sectionKey, code, index) {
    return `${pickStr(sectionKey)}::${pickStr(code, "unknown")}::${Number(index) || 0}`;
  }

  function resolveBenchNgCopyMeta(panel) {
    let currentUrl = "—";
    try {
      currentUrl = pickStr(global.location?.href, "—");
    } catch {
      /* ignore */
    }
    const p = panel || {};
    return {
      category: pickStr(p.categoryLabel, p.category, p.snapshot?.categoryLabel, p.snapshot?.category, "—"),
      stage: pickStr(p.flowStage, p.snapshot?.stage, p.focus, "—"),
      currentUrl,
      timestamp: new Date().toISOString(),
    };
  }

  function buildNgRelatedValues(fail, panel, sectionKey) {
    const code = pickStr(fail?.code);
    const ndl = panel?.stages?.notifyDisplayLoad || {};
    const ddc = panel?.stages?.diagDomConsistency || {};
    const snap = panel?.snapshot || {};
    const aChat = ddc.aChatDom || {};
    const aNotify = ddc.aNotifyDom || {};
    const related = {
      sectionKey: pickStr(sectionKey),
      detail: pickStr(fail?.detail),
      isDomConsistency: fail?.isDomConsistency === true,
      actorAId: pickStr(snap.actorAId),
      actorBId: pickStr(snap.actorBId),
      threadId: pickStr(snap.threadId),
      focus: pickStr(panel?.focus),
      primaryRootCause: pickStr(panel?.primaryRootCause),
    };
    if (fail?.related && typeof fail.related === "object") {
      Object.assign(related, fail.related);
    }

    if (
      code === NG_CODES.A_NOTIFICATION_ROWS_MISSING ||
      code === NG_CODES.A_NOTIFICATION_STORE_MISSING ||
      code === NG_CODES.A_NOTIFICATION_HREF_MISSING
    ) {
      Object.assign(related, {
        expectedANotificationRecipient: ndl.expectedANotificationRecipient,
        actualANotificationStoreCount: ndl.actualANotificationStoreCount,
        actualANotificationRowsCount: ndl.actualANotificationRowsCount,
        aNotificationRenderDiff: ndl.aNotificationRenderDiff,
        latestANotificationTitle: ndl.latestANotificationTitle,
        latestANotificationHref: ndl.latestANotificationHref,
        isANotificationInStore: ndl.isANotificationInStore,
        isANotificationRenderedInRows: ndl.isANotificationRenderedInRows,
        filterDropReason: pickStr(
          ndl._filterDropReason,
          ndl._aNotify?.renderDiag?.filterDropReason,
          ndl.aNotificationRenderDiff
        ),
        perNotificationFilterLogs: pickStr(
          ndl._aNotify?.renderDiag?.perNotificationFilterLogs?.length
            ? JSON.stringify(ndl._aNotify.renderDiag.perNotificationFilterLogs)
            : ""
        ),
      });
    }

    if (
      code === NG_CODES.A_CHAT_THREAD_UNRESOLVED ||
      code === NG_CODES.A_CHAT_ROOM_UNRESOLVED ||
      code === NG_CODES.A_CHAT_LOAD_READY_MISSING ||
      code === NG_CODES.A_CHAT_DETAIL_NOT_REACHED ||
      code === NG_CODES.A_CHAT_FRAME_SRC_MISSING ||
      code === NG_CODES.A_CHAT_COMPOSER_MISSING
    ) {
      Object.assign(related, {
        expectedAChatHref: ndl.expectedAChatHref,
        actualAChatFrameSrc: ndl.actualAChatFrameSrc,
        actualAChatDetailUrl: ndl.actualAChatDetailUrl,
        aChatDetailReached: ndl.aChatDetailReached,
        aChatThreadResolved: ndl.aChatThreadResolved,
        aChatRoomResolved: ndl.aChatRoomResolved,
        aChatLoadReady: ndl.aChatLoadReady,
        aComposerRendered: ndl.aComposerRendered,
        aChatLoadErrorReason: ndl.aChatLoadErrorReason,
        chatDetailLookupKey: pickStr(ndl._aChat?.loadDiag?.chatDetailLookupKey),
        ensureJobThreadForAccessOk: ndl._aChat?.loadDiag?.ensureJobThreadForAccessOk,
        ensureJobThreadForAccessReason: pickStr(ndl._aChat?.loadDiag?.ensureJobThreadForAccessReason),
      });
      if (
        code === NG_CODES.A_CHAT_THREAD_UNRESOLVED ||
        code === NG_CODES.THREAD_RESOLVE_DIAG_MISSING
      ) {
        const trace = readThreadResolveDiagFromFrame("frame-a-chat");
        related.threadResolveTraceName = BENCH_THREAD_RESOLVE_TRACE_NAME;
        Object.assign(related, trace);
      }
    }

    const crn = ndl.completionReviewNotify || {};
    if (
      code === NG_CODES.COMPLETION_NOTIFY_NOT_CREATED ||
      code === NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH ||
      code === NG_CODES.COMPLETION_NOTIFY_ROWS_MISSING
    ) {
      Object.assign(related, {
        completionNotifyCreated: crn.completionNotifyCreated,
        completionNotifyRecipient: crn.completionNotifyRecipient,
        completionNotifyExpectedRecipient: crn.completionNotifyExpectedRecipient,
        completionNotifyStoreCountForA: crn.completionNotifyStoreCountForA,
        completionNotifyRowsCountForA: crn.completionNotifyRowsCountForA,
        completionNotifyHref: crn.completionNotifyHref,
        completionNotifyDropReason: crn.completionNotifyDropReason,
      });
    }
    if (
      code === NG_CODES.REVIEW_NOTIFY_NOT_CREATED ||
      code === NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH ||
      code === NG_CODES.REVIEW_NOTIFY_ROWS_MISSING
    ) {
      Object.assign(related, {
        reviewNotifyCreated: crn.reviewNotifyCreated,
        reviewNotifyRecipient: crn.reviewNotifyRecipient,
        reviewNotifyExpectedRecipient: crn.reviewNotifyExpectedRecipient,
        reviewNotifyStoreCountForA: crn.reviewNotifyStoreCountForA,
        reviewNotifyRowsCountForA: crn.reviewNotifyRowsCountForA,
        reviewNotifyHref: crn.reviewNotifyHref,
        reviewNotifyDropReason: crn.reviewNotifyDropReason,
      });
    }

    if (
      code === NG_CODES.CHAT_DIAG_OK_BUT_ERROR_DOM_VISIBLE ||
      code === NG_CODES.CHAT_DIAG_OK_BUT_COMPOSER_MISSING_DOM ||
      code === NG_CODES.NOTIFY_DIAG_OK_BUT_ROW_MISSING_DOM ||
      code === NG_CODES.NOTIFY_DIAG_OK_BUT_ERROR_DOM_VISIBLE ||
      code === NG_CODES.DIAGNOSTIC_FALSE_POSITIVE
    ) {
      Object.assign(related, {
        diagAChatLoadReady: ndl.aChatLoadReady,
        actualChatErrorVisible: aChat.actualChatErrorVisible,
        actualChatErrorText: aChat.actualChatErrorText,
        actualComposerDomExists: aChat.actualComposerDomExists,
        actualComposerVisible: aChat.actualComposerVisible,
        actualBodyTextIncludesChatError: aChat.actualBodyTextIncludesChatError,
        diagNotifyRowsCount: ndl.actualANotificationRowsCount,
        actualNotifyRowDomCount: aNotify.actualNotifyRowDomCount,
        actualNotifyErrorVisible: aNotify.actualNotifyErrorVisible,
        actualNotifyEmptyTextVisible: aNotify.actualNotifyEmptyTextVisible,
      });
    }

    return related;
  }

  function formatBenchNgBlockCopyText(fail, panel, sectionKey, index) {
    const meta = resolveBenchNgCopyMeta(panel);
    const f = fail || {};
    const related = buildNgRelatedValues(f, panel, sectionKey);
    const lines = [
      "=== ベンチ診断NGブロック ===",
      `category: ${meta.category}`,
      `stage: ${meta.stage}`,
      `ngType: ${pickStr(f.code, "—")}`,
      `timestamp: ${meta.timestamp}`,
      `currentUrl: ${meta.currentUrl}`,
      "",
      `cause: ${pickStr(f.cause, f.detail, "—")}`,
      `expected: ${pickStr(f.expected, "—")}`,
      `actual: ${pickStr(f.actual, "—")}`,
      `diff: ${pickStr(f.diff, "—")}`,
      `fixTargetFile: ${pickStr(f.targetFile, "—")}`,
      `fixTargetFunction: ${pickStr(f.targetFunction, "—")}`,
      "",
      "--- relatedValues ---",
    ];
    Object.entries(related).forEach(([key, value]) => {
      if (value == null || value === "") return;
      lines.push(`${key}: ${String(value)}`);
    });
    return lines.join("\n");
  }

  function buildAllNgBlockCopyTexts(panel) {
    const texts = {};
    const snapshot = panel?.snapshot || {};
    const stages = panel?.stages || {};
    const { failures } = evaluateBenchDisplayFailures(snapshot, stages);
    const notifyFails = failures.filter((f) => !f.isDomConsistency);
    const domFails = failures.filter((f) => f.isDomConsistency);
    notifyFails.forEach((f, i) => {
      const key = buildBenchNgCopyKey(BENCH_NG_SECTION_KEYS.NOTIFY_DISPLAY_LOAD, f.code, i);
      texts[key] = formatBenchNgBlockCopyText(
        f,
        panel,
        BENCH_NG_SECTION_KEYS.NOTIFY_DISPLAY_LOAD,
        i
      );
    });
    domFails.forEach((f, i) => {
      const key = buildBenchNgCopyKey(BENCH_NG_SECTION_KEYS.DIAG_DOM, f.code, i);
      texts[key] = formatBenchNgBlockCopyText(f, panel, BENCH_NG_SECTION_KEYS.DIAG_DOM, i);
    });
    const keys = Object.keys(texts);
    if (keys.length > BENCH_NG_HISTORY_MAX) {
      for (const drop of keys.slice(BENCH_NG_HISTORY_MAX)) delete texts[drop];
    }
    return texts;
  }

  const COMPLETION_REVIEW_NG_CODES = new Set([
    NG_CODES.COMPLETION_NOTIFY_NOT_CREATED,
    NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH,
    NG_CODES.COMPLETION_NOTIFY_ROWS_MISSING,
    NG_CODES.REVIEW_NOTIFY_NOT_CREATED,
    NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH,
    NG_CODES.REVIEW_NOTIFY_ROWS_MISSING,
  ]);

  function buildNgDedupKey(fail) {
    const f = fail || {};
    if (f.code === NG_CODES.NOTIFICATION_MISSING) {
      return `${pickStr(f.code)}::${pickStr(f.cause)}::${pickStr(f.related?.recipientUserId, f.related?.side, "—")}`;
    }
    return `${pickStr(f.code, "—")}::${pickStr(f.targetFile, "—")}::${pickStr(f.targetFunction, "—")}`;
  }

  function collectDisplayedNgFailureEntries(panel) {
    const snapshot = panel?.snapshot || {};
    const stages = panel?.stages || {};
    const { failures } = evaluateBenchDisplayFailures(snapshot, stages);
    const entries = [];
    let seq = 0;
    failures
      .filter((f) => !f.isDomConsistency)
      .forEach((f) => {
        entries.push({
          fail: f,
          sectionKey: BENCH_NG_SECTION_KEYS.NOTIFY_DISPLAY_LOAD,
          seq: seq++,
        });
      });
    failures
      .filter((f) => COMPLETION_REVIEW_NG_CODES.has(f.code))
      .forEach((f) => {
        entries.push({
          fail: f,
          sectionKey: BENCH_NG_SECTION_KEYS.NOTIFY_DISPLAY_LOAD,
          seq: seq++,
        });
      });
    failures
      .filter((f) => f.isDomConsistency)
      .forEach((f) => {
        entries.push({
          fail: f,
          sectionKey: BENCH_NG_SECTION_KEYS.DIAG_DOM,
          seq: seq++,
        });
      });
    return entries;
  }

  function resolveNgCompletionCriteriaText(fail) {
    const done = CURSOR_FIX_TEMPLATES[pickStr(fail?.code)]?.done;
    if (Array.isArray(done) && done.length) {
      return done.map((d) => `- ${d}`).join("\n");
    }
    return "—";
  }

  function formatRelatedValuesForNgCopy(related) {
    const lines = [];
    Object.entries(related || {}).forEach(([key, value]) => {
      if (value == null || value === "") return;
      lines.push(`${key}: ${String(value)}`);
    });
    return lines.length ? lines.join("\n") : "—";
  }

  function formatNgBulkEntryBlock(index, entry, panel) {
    const f = entry.fail || {};
    const meta = resolveBenchNgCopyMeta(panel);
    const builtRelated = buildNgRelatedValues(f, panel, entry.sectionKey);
    const related = { ...(f.related || {}), ...builtRelated };
    return [
      `${index}.`,
      "ngType:",
      pickStr(f.code, "—"),
      "",
      "cause:",
      pickStr(f.cause, f.detail, "—"),
      "",
      "原因:",
      pickStr(f.cause, f.detail, "—"),
      "",
      "expected:",
      pickStr(f.expected, "—"),
      "",
      "actual:",
      pickStr(f.actual, "—"),
      "",
      "diff:",
      pickStr(f.diff, "—"),
      "",
      "fixTargetFile:",
      pickStr(f.targetFile, "—"),
      "",
      "fixTargetFunction:",
      pickStr(f.targetFunction, "—"),
      "",
      "修正対象:",
      pickStr(f.targetFile, "—"),
      "",
      "修正関数:",
      pickStr(f.targetFunction, "—"),
      "",
      "currentUrl:",
      meta.currentUrl,
      "",
      "timestamp:",
      meta.timestamp,
      "",
      "完了条件:",
      resolveNgCompletionCriteriaText(f),
      "",
      "relatedValues:",
      formatRelatedValuesForNgCopy(related),
    ].join("\n");
  }

  function buildAllNgBlocksBulkCopyText(panel) {
    const meta = resolveBenchNgCopyMeta(panel);
    const entries = collectDisplayedNgFailureEntries(panel);
    const deduped = new Map();
    entries.forEach((entry) => {
      const key = buildNgDedupKey(entry.fail);
      const prev = deduped.get(key);
      if (!prev || entry.seq > prev.seq) {
        deduped.set(key, entry);
      }
    });
    const sorted = Array.from(deduped.values())
      .sort((a, b) => {
        const fileCmp = pickStr(a.fail.targetFile, "—").localeCompare(
          pickStr(b.fail.targetFile, "—"),
          "ja"
        );
        if (fileCmp !== 0) return fileCmp;
        return a.seq - b.seq;
      })
      .slice(0, BENCH_NG_HISTORY_MAX);
    const header = [
      "=== ベンチ診断 NG一覧 ===",
      "",
      "currentUrl:",
      meta.currentUrl,
      "",
      "timestamp:",
      meta.timestamp,
      "",
      "category:",
      meta.category,
      "",
      "stage:",
      meta.stage,
      "",
      "NG count:",
      String(sorted.length),
      "",
      "--------------------",
      "",
    ].join("\n");
    if (!sorted.length) {
      return header.trim();
    }
    const body = sorted
      .map((entry, i) => `${formatNgBulkEntryBlock(i + 1, entry, panel)}\n\n--------------------`)
      .join("\n\n");
    return `${header}${body}`.trim();
  }

  function buildBenchNgBlockCopyText(ngCopyKey, panel) {
    const copies = buildAllNgBlockCopyTexts(panel);
    return copies[pickStr(ngCopyKey)] || "";
  }

  function formatBenchNgBlockHtml(fail, escapeHtml, ngCopyKey) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const f = fail || {};
    const key = pickStr(ngCopyKey);
    return (
      `<div class="bench-verdict__ng-block" data-bench-ng-code="${esc(f.code)}">` +
      `<div class="bench-verdict__ng-head">` +
      `<p class="bench-verdict__detail"><strong>${esc(f.code)}</strong></p>` +
      (key
        ? `<button type="button" class="bench-verdict__copy-btn bench-verdict__copy-btn--sub bench-verdict__copy-btn--ng" data-bench-ng-copy="${esc(key)}" aria-label="${esc(f.code)}のNGログをコピー">このNGをコピー</button>`
        : "") +
      `</div>` +
      `<ul class="bench-verdict__kv">` +
      `<li><dt>原因</dt><dd>${esc(f.cause)}</dd></li>` +
      `<li><dt>expected</dt><dd><code>${esc(f.expected)}</code></dd></li>` +
      `<li><dt>actual</dt><dd><code>${esc(f.actual)}</code></dd></li>` +
      `<li><dt>diff</dt><dd class="bench-verdict__status-ng">${esc(f.diff)}</dd></li>` +
      `<li><dt>修正対象ファイル</dt><dd>${esc(f.targetFile)}</dd></li>` +
      `<li><dt>修正対象関数</dt><dd>${esc(f.targetFunction)}</dd></li>` +
      `</ul></div>`
    );
  }

  function formatBenchSectionCopyHeader(title, sectionKey, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const key = pickStr(sectionKey);
    return (
      `<div class="bench-verdict__section-head">` +
      `<p class="bench-verdict__section-title">${esc(title)}</p>` +
      (key
        ? `<button type="button" class="bench-verdict__copy-btn bench-verdict__copy-btn--sub bench-verdict__copy-btn--section" data-bench-section-copy="${esc(key)}" aria-label="${esc(title)}のログをコピー">このログをコピー</button>`
        : "") +
      `</div>`
    );
  }

  function formatNotifyDisplayLoadField(label, expected, actual, diff, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const cls =
      diff === "OK" || String(diff).startsWith("OK")
        ? "bench-verdict__status-ok"
        : String(diff).startsWith("NG")
          ? "bench-verdict__status-ng"
          : "";
    return (
      `<li><dt>${esc(label)}</dt>` +
      `<dd class="${cls}">` +
      `actual=<strong>${esc(actual ?? "—")}</strong> ` +
      (expected != null ? `expected=<code>${esc(expected)}</code> ` : "") +
      `diff=<em>${esc(diff ?? "—")}</em>` +
      `</dd></li>`
    );
  }

  function formatCompletionReviewNotifyHtml(crn, failures, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const d = crn || {};
    const crnCodes = new Set([
      NG_CODES.COMPLETION_NOTIFY_NOT_CREATED,
      NG_CODES.COMPLETION_NOTIFY_RECIPIENT_MISMATCH,
      NG_CODES.COMPLETION_NOTIFY_ROWS_MISSING,
      NG_CODES.REVIEW_NOTIFY_NOT_CREATED,
      NG_CODES.REVIEW_NOTIFY_RECIPIENT_MISMATCH,
      NG_CODES.REVIEW_NOTIFY_ROWS_MISSING,
    ]);
    const fails = (failures || []).filter((f) => crnCodes.has(f.code));
    const verdictCls = fails.length ? "bench-verdict__status-ng" : "bench-verdict__status-ok";
    const verdictText = fails.length
      ? fails.map((f) => f.code).join(", ")
      : d.evalContext
        ? "OK（完了承認・レビュー通知 一致）"
        : "— (完了/レビューフロー未到達)";
    let ngHtml = "";
    if (fails.length) {
      ngHtml =
        `<p class="bench-verdict__section-title">NG 確定（原因 / expected / actual / diff / 修正先）</p>` +
        fails
          .map((f, i) =>
            formatBenchNgBlockHtml(
              f,
              BENCH_NG_SECTION_KEYS.NOTIFY_DISPLAY_LOAD,
              i,
              escapeHtml
            )
          )
          .join("");
    }
    const completionRecipientOk =
      d.completionNotifyRecipient &&
      d.completionNotifyRecipient === d.completionNotifyExpectedRecipient;
    const reviewRecipientOk =
      d.reviewNotifyRecipient && d.reviewNotifyRecipient === d.reviewNotifyExpectedRecipient;
    return (
      `<section class="bench-verdict__section" aria-label="完了承認・レビュー通知 整合性">` +
      formatBenchSectionCopyHeader(
        "完了承認・レビュー通知 整合性（A=掲載者）",
        BENCH_CONSISTENCY_SECTION_KEYS.COMPLETION_REVIEW_NOTIFY,
        escapeHtml
      ) +
      `<p class="bench-verdict__detail">判定: <span class="${verdictCls}">${esc(verdictText)}</span>` +
      (d.evalContext ? "" : ` <span class="bench-verdict__status-skip">(evalContext=false)</span>`) +
      `</p>` +
      `<p class="bench-verdict__section-title">完了承認通知（B承認 → A）</p>` +
      `<ul class="bench-verdict__kv">` +
      formatNotifyDisplayLoadField(
        "completionNotifyCreated",
        d.expectCompletionNotifyForA ? "true" : "—",
        String(d.completionNotifyCreated),
        d.completionNotifyCreated ? "OK" : d.expectCompletionNotifyForA ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "completionNotifyRecipient",
        d.completionNotifyExpectedRecipient,
        d.completionNotifyRecipient,
        completionRecipientOk ? "OK" : d.completionNotifyCreated ? "NG" : "—",
        escapeHtml
      ) +
      `<li><dt>completionNotifyExpectedRecipient</dt><dd><code>${esc(d.completionNotifyExpectedRecipient)}</code></dd></li>` +
      formatNotifyDisplayLoadField(
        "completionNotifyStoreCountForA",
        d.expectCompletionNotifyForA ? ">=1" : "—",
        String(d.completionNotifyStoreCountForA),
        d.completionNotifyStoreCountForA > 0 ? "OK" : d.expectCompletionNotifyForA ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "completionNotifyRowsCountForA",
        d.expectCompletionNotifyForA ? ">=1" : "—",
        String(d.completionNotifyRowsCountForA),
        d.completionNotifyRowsCountForA > 0
          ? "OK"
          : d.completionNotifyStoreCountForA > 0
            ? "NG rows=0"
            : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "completionNotifyHref",
        "valid href",
        d.completionNotifyHref,
        d.completionNotifyHref && d.completionNotifyHref !== "—" ? "OK" : "—",
        escapeHtml
      ) +
      `<li><dt>completionNotifyDropReason</dt><dd>${esc(d.completionNotifyDropReason || "—")}</dd></li>` +
      `</ul>` +
      `<p class="bench-verdict__section-title">レビュー通知（Bレビュー → A）</p>` +
      `<ul class="bench-verdict__kv">` +
      formatNotifyDisplayLoadField(
        "reviewNotifyCreated",
        d.expectReviewNotifyForA ? "true" : "—",
        String(d.reviewNotifyCreated),
        d.reviewNotifyCreated ? "OK" : d.expectReviewNotifyForA ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "reviewNotifyRecipient",
        d.reviewNotifyExpectedRecipient,
        d.reviewNotifyRecipient,
        reviewRecipientOk ? "OK" : d.reviewNotifyCreated ? "NG" : "—",
        escapeHtml
      ) +
      `<li><dt>reviewNotifyExpectedRecipient</dt><dd><code>${esc(d.reviewNotifyExpectedRecipient)}</code></dd></li>` +
      formatNotifyDisplayLoadField(
        "reviewNotifyStoreCountForA",
        d.expectReviewNotifyForA ? ">=1" : "—",
        String(d.reviewNotifyStoreCountForA),
        d.reviewNotifyStoreCountForA > 0 ? "OK" : d.expectReviewNotifyForA ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "reviewNotifyRowsCountForA",
        d.expectReviewNotifyForA ? ">=1" : "—",
        String(d.reviewNotifyRowsCountForA),
        d.reviewNotifyRowsCountForA > 0
          ? "OK"
          : d.reviewNotifyStoreCountForA > 0
            ? "NG rows=0"
            : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "reviewNotifyHref",
        "valid href",
        d.reviewNotifyHref,
        d.reviewNotifyHref && d.reviewNotifyHref !== "—" ? "OK" : "—",
        escapeHtml
      ) +
      `<li><dt>reviewNotifyDropReason</dt><dd>${esc(d.reviewNotifyDropReason || "—")}</dd></li>` +
      `</ul>` +
      ngHtml +
      `</section>`
    );
  }

  function readBenchPreviewScrollDiag() {
    try {
      return global.__tasuBenchPreviewScrollDiag || null;
    } catch {
      return null;
    }
  }

  function formatBenchPreviewScrollHtml(scrollDiag, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const d = scrollDiag || readBenchPreviewScrollDiag() || {};
    const frames = d.frames || {};
    const frameRows = ["frame-a-notify", "frame-a-chat", "frame-b-notify", "frame-b-chat"]
      .map((id) => {
        const row = frames[id] || {};
        return (
          `<li><dt>${esc(id)} scrollTop</dt><dd>${esc(String(row.scrollTop ?? "—"))}` +
          (row.isUserScrolling ? ` <span class="bench-verdict__status-ok">(scrolling)</span>` : "") +
          `</dd></li>`
        );
      })
      .join("");
    const resetCls = d.scrollResetDetected ? "bench-verdict__status-ng" : "bench-verdict__status-ok";
    return (
      `<section class="bench-verdict__section" aria-label="previewスクロール診断">` +
      `<p class="bench-verdict__section-title">preview iframe スクロール診断</p>` +
      `<ul class="bench-verdict__kv">` +
      `<li><dt>previewScrollTopBefore</dt><dd>${esc(String(d.previewScrollTopBefore ?? "—"))}</dd></li>` +
      `<li><dt>previewScrollTopAfter</dt><dd>${esc(String(d.previewScrollTopAfter ?? "—"))}</dd></li>` +
      `<li><dt>scrollResetDetected</dt><dd class="${resetCls}">${esc(String(d.scrollResetDetected === true))}</dd></li>` +
      `<li><dt>lastScrollResetReason</dt><dd>${esc(d.lastScrollResetReason || "—")}</dd></li>` +
      `<li><dt>lastFrameSrcSetReason</dt><dd>${esc(d.lastFrameSrcSetReason || "—")}</dd></li>` +
      `<li><dt>lastHeightSyncReason</dt><dd>${esc(d.lastHeightSyncReason || "—")}</dd></li>` +
      `<li><dt>lastDiagRenderReason</dt><dd>${esc(d.lastDiagRenderReason || "—")}</dd></li>` +
      `<li><dt>isUserScrollingPreview</dt><dd class="${d.isUserScrollingPreview ? "bench-verdict__status-ok" : ""}">${esc(String(d.isUserScrollingPreview === true))}</dd></li>` +
      frameRows +
      `</ul></section>`
    );
  }

  function formatChatInitDiagHtml(sideLabel, chatFields, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const c = chatFields || {};
    if (c.chatLoadReady) return "";
    const trace = (c.initTrace || []).slice(-16);
    const traceLines = trace.map((t) => {
      const bits = [t.step];
      if (t.failStep) bits.push(`failStep=${t.failStep}`);
      if (t.failReason) bits.push(`failReason=${t.failReason}`);
      if (t.error) bits.push(`error=${t.error}`);
      if (t.roomId && t.roomId !== "—") bits.push(`roomId=${t.roomId}`);
      return bits.join(" | ");
    });
    const traceHtml = traceLines.length
      ? `<li><dt>initTrace</dt><dd><pre class="bench-verdict__trace">${esc(traceLines.join("\n"))}</pre></dd></li>`
      : "";
    return (
      `<p class="bench-verdict__section-title">${esc(sideLabel)} chat-detail init 診断 (chatLoadReady=false)</p>` +
      `<ul class="bench-verdict__kv">` +
      formatNotifyDisplayLoadField("failStep", "—", c.failStep, c.failStep !== "—" ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("failReason", "—", c.failReason, c.failReason !== "—" ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("initLastStep", "init:complete", c.initLastStep, c.initLastStep === "init:complete" ? "OK" : "NG", escapeHtml) +
      formatNotifyDisplayLoadField("initExitKind", "—", c.initExitKind, c.initExitKind !== "—" ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("initStepCount", ">0", String(c.initStepCount || 0), (c.initStepCount || 0) > 0 ? "OK" : "NG", escapeHtml) +
      formatNotifyDisplayLoadField("scriptPipelinePhase", "main_script_loaded", pickStr(c.chatDetailScriptPipelinePhase), c.chatDetailScriptPipelinePhase === "main_script_loaded" ? "OK" : "NG", escapeHtml) +
      `<li><dt>threadId</dt><dd><code>${esc(c.threadId || "—")}</code></dd></li>` +
      `<li><dt>listingId</dt><dd><code>${esc(c.listingId || "—")}</code></dd></li>` +
      `<li><dt>roomId</dt><dd><code>${esc(c.roomId || "—")}</code></dd></li>` +
      `<li><dt>participantId</dt><dd><code>${esc(c.participantId || "—")}</code></dd></li>` +
      `<li><dt>demoProfile</dt><dd><code>${esc(c.demoProfile || "—")}</code></dd></li>` +
      `<li><dt>threadKind</dt><dd><code>${esc(c.threadKind || "—")}</code></dd></li>` +
      traceHtml +
      `</ul>`
    );
  }

  function formatNotifyDisplayLoadHtml(notifyDisplayLoad, failures, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const d = notifyDisplayLoad || {};
    const fails = (failures || []).filter((f) => !f.isDomConsistency);
    const verdictCls = fails.length ? "bench-verdict__status-ng" : "bench-verdict__status-ok";
    const verdictText = fails.length
      ? fails.map((f) => f.code).join(", ")
      : d.postHire
        ? "OK（通知表示・chat-detail読込 一致）"
        : "— (採用後フロー未到達)";
    let ngHtml = "";
    if (fails.length) {
      ngHtml =
        `<p class="bench-verdict__section-title">NG 確定（原因 / expected / actual / diff / 修正先）</p>` +
        fails
          .map((f, i) =>
            formatBenchNgBlockHtml(
              f,
              escapeHtml,
              buildBenchNgCopyKey(BENCH_NG_SECTION_KEYS.NOTIFY_DISPLAY_LOAD, f.code, i)
            )
          )
          .join("");
    }
    const br = d.benchRun || readBenchRunMeta();
    const iframeRuns = br.iframeRunIds || {};
    return (
      `<section class="bench-verdict__section" aria-label="通知表示・chat-detail読込整合性">` +
      formatBenchSectionCopyHeader(
        "通知表示・chat-detail読込 整合性",
        BENCH_CONSISTENCY_SECTION_KEYS.NOTIFY_DISPLAY_LOAD,
        escapeHtml
      ) +
      `<p class="bench-verdict__section-title">ベンチ run / reset</p>` +
      `<ul class="bench-verdict__kv">` +
      formatNotifyDisplayLoadField("currentRunId", "—", String(br.currentRunId || "—"), "—", escapeHtml) +
      formatNotifyDisplayLoadField("lastResetAt", "—", br.lastResetAt || "—", "—", escapeHtml) +
      formatNotifyDisplayLoadField("staleStateDetected", "false", String(br.staleStateDetected === true), br.staleStateDetected ? "NG" : "OK", escapeHtml) +
      formatNotifyDisplayLoadField("iframe.aChat.benchRunId", String(br.currentRunId || "—"), iframeRuns.aChat || "—", iframeRuns.aChat === String(br.currentRunId) ? "OK" : br.lastResetAt !== "—" ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("previousRunThreadId", "—", br.previousRunThreadId || "—", "—", escapeHtml) +
      `</ul>` +
      `<p class="bench-verdict__detail">判定: <span class="${verdictCls}">${esc(verdictText)}</span>` +
      (d.postHire ? "" : ` <span class="bench-verdict__status-skip">(postHire=false)</span>`) +
      `</p>` +
      `<p class="bench-verdict__section-title">A 通知</p>` +
      `<ul class="bench-verdict__kv">` +
      `<li><dt>expectedANotificationRecipient</dt><dd><code>${esc(d.expectedANotificationRecipient)}</code></dd></li>` +
      formatNotifyDisplayLoadField(
        "actualANotificationStoreCount",
        ">=1",
        String(d.actualANotificationStoreCount),
        d.isANotificationInStore ? "OK" : d.postHire ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "actualANotificationRowsCount",
        ">=1",
        String(d.actualANotificationRowsCount),
        d.isANotificationRenderedInRows ? "OK" : d.isANotificationInStore ? "NG rows=0" : "—",
        escapeHtml
      ) +
      `<li><dt>latestANotificationType</dt><dd>${esc(d.latestANotificationType)}</dd></li>` +
      `<li><dt>latestANotificationTitle</dt><dd>${esc(d.latestANotificationTitle)}</dd></li>` +
      formatNotifyDisplayLoadField(
        "latestANotificationHref",
        "valid href",
        d.latestANotificationHref,
        d._aNotify?.hrefValid ? "OK" : d.isANotificationInStore ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "isANotificationInStore",
        "true",
        String(d.isANotificationInStore),
        d.isANotificationInStore ? "OK" : d.postHire ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "isANotificationRenderedInRows",
        "true",
        String(d.isANotificationRenderedInRows),
        d.isANotificationRenderedInRows ? "OK" : d.isANotificationInStore ? "NG" : "—",
        escapeHtml
      ) +
      `<li><dt>aNotificationRenderDiff</dt><dd>${esc(d.aNotificationRenderDiff)}</dd></li>` +
      `</ul>` +
      `<p class="bench-verdict__section-title">B 通知</p>` +
      `<ul class="bench-verdict__kv">` +
      formatNotifyDisplayLoadField(
        "actualBNotificationStoreCount",
        ">=1",
        String(d.actualBNotificationStoreCount),
        d.isBNotificationInStore ? "OK" : d.postHire ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "actualBNotificationRowsCount",
        ">=1",
        String(d.actualBNotificationRowsCount),
        d.isBNotificationRenderedInRows ? "OK" : d.isBNotificationInStore ? "NG rows=0" : "—",
        escapeHtml
      ) +
      `<li><dt>latestBNotificationType</dt><dd>${esc(d.latestBNotificationType)}</dd></li>` +
      `<li><dt>latestBNotificationTitle</dt><dd>${esc(d.latestBNotificationTitle)}</dd></li>` +
      formatNotifyDisplayLoadField(
        "latestBNotificationHref",
        "valid href",
        d.latestBNotificationHref,
        d._bNotify?.hrefValid ? "OK" : d.isBNotificationInStore ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "isBNotificationInStore",
        "true",
        String(d.isBNotificationInStore),
        d.isBNotificationInStore ? "OK" : d.postHire ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField(
        "isBNotificationRenderedInRows",
        "true",
        String(d.isBNotificationRenderedInRows),
        d.isBNotificationRenderedInRows ? "OK" : d.isBNotificationInStore ? "NG" : "—",
        escapeHtml
      ) +
      `<li><dt>bNotificationRenderDiff</dt><dd>${esc(d.bNotificationRenderDiff)}</dd></li>` +
      `</ul>` +
      `<p class="bench-verdict__section-title">A chat-detail</p>` +
      `<ul class="bench-verdict__kv">` +
      formatNotifyDisplayLoadField("expectedAChatHref", "chat-detail+thread", d.expectedAChatHref, d._aChat?.frameIsChatDetail ? "OK" : "NG", escapeHtml) +
      formatNotifyDisplayLoadField("actualAChatFrameSrc", d.expectedAChatHref, d.actualAChatFrameSrc, d._aChat?.frameIsChatDetail ? "OK" : "NG", escapeHtml) +
      formatNotifyDisplayLoadField("actualAChatDetailUrl", d.expectedAChatHref, d.actualAChatDetailUrl, d.aChatDetailReached ? "OK" : "NG", escapeHtml) +
      formatNotifyDisplayLoadField("aChatDetailReached", "true", String(d.aChatDetailReached), d.aChatDetailReached ? "OK" : "NG", escapeHtml) +
      formatNotifyDisplayLoadField("chatDetailHtmlReached", "true", String(d.chatDetailHtmlReached), d.chatDetailHtmlReached ? "OK" : d.aChatDetailReached ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("chatDetailScriptTagSrc", "chat-detail.js", esc(d.chatDetailScriptTagSrc), /chat-detail\.js/i.test(String(d.chatDetailScriptTagSrc || "")) ? "OK" : d.aChatDetailReached ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("chatDetailScriptLoaded", "true", String(d.chatDetailScriptLoaded), d.chatDetailScriptLoaded ? "OK" : d.aChatDetailReached ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField(
        "chatDetailScriptVersion",
        EXPECTED_CHAT_DETAIL_SCRIPT_VERSION,
        esc(d.chatDetailScriptVersion),
        d.chatDetailScriptLoaded && d.chatDetailScriptVersion === EXPECTED_CHAT_DETAIL_SCRIPT_VERSION ? "OK" : d.aChatDetailReached ? "NG" : "—",
        escapeHtml
      ) +
      formatNotifyDisplayLoadField("chatDetailDiagWindowKeys", "—", esc(d.chatDetailDiagWindowKeys), d.chatDetailScriptLoaded ? "OK" : d.aChatDetailReached ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("chatDetailScriptLoadError", "—", esc(d.chatDetailScriptLoadError), d.chatDetailScriptLoadError !== "—" ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("aChatDetailInitStarted", "true", String(d.aChatDetailInitStarted), d.aChatDetailInitStarted ? "OK" : d.aChatDetailReached ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("aChatThreadResolved", "true", String(d.aChatThreadResolved), d.aChatThreadResolved ? "OK" : d.aChatDetailReached ? "NG" : "—", escapeHtml) +
      (() => {
        const trd = readThreadResolveDiagFromFrame("frame-a-chat");
        if (!d.aChatDetailReached || d.aChatThreadResolved) return "";
        return (
          `<p class="bench-verdict__section-title">${esc(BENCH_THREAD_RESOLVE_TRACE_NAME)}</p>` +
          `<ul class="bench-verdict__kv">` +
          formatNotifyDisplayLoadField("phase", "—", trd.phase, trd.phase !== "—" ? "OK" : "NG", escapeHtml) +
          formatNotifyDisplayLoadField("failReason", "—", trd.failReason, trd.failReason !== "—" ? "NG" : "—", escapeHtml) +
          formatNotifyDisplayLoadField("failStep", "—", trd.failStep, trd.failStep !== "—" ? "NG" : "—", escapeHtml) +
          formatNotifyDisplayLoadField("urlThreadId", "—", trd.urlThreadId, "—", escapeHtml) +
          formatNotifyDisplayLoadField("queryListingId", "—", trd.queryListingId, "—", escapeHtml) +
          formatNotifyDisplayLoadField("queryApplicationId", "—", trd.queryApplicationId, "—", escapeHtml) +
          formatNotifyDisplayLoadField("queryUserId", "—", trd.queryUserId, "—", escapeHtml) +
          formatNotifyDisplayLoadField("ensureCalled", "true", trd.ensureCalled, trd.ensureCalled === "true" ? "OK" : "—", escapeHtml) +
          formatNotifyDisplayLoadField("applicationId", "—", trd.applicationId, "—", escapeHtml) +
          formatNotifyDisplayLoadField("applicationThreadIdBefore", "—", trd.applicationThreadIdBefore, "—", escapeHtml) +
          formatNotifyDisplayLoadField("threadExistsByUrlThreadId", "true", trd.threadExistsByUrlThreadId, trd.threadExistsByUrlThreadId === "true" ? "OK" : "NG", escapeHtml) +
          formatNotifyDisplayLoadField("restoreCalled", "true", trd.restoreCalled, trd.restoreCalled === "true" ? "OK" : "NG", escapeHtml) +
          formatNotifyDisplayLoadField("restoreResultThreadId", "urlThreadId", trd.restoreResultThreadId, trd.restoreResultThreadId === trd.urlThreadId ? "OK" : "NG", escapeHtml) +
          formatNotifyDisplayLoadField("resolvedThreadId", "urlThreadId", trd.resolvedThreadId, trd.resolvedThreadId === trd.urlThreadId ? "OK" : "NG", escapeHtml) +
          `</ul>`
        );
      })() +
      formatNotifyDisplayLoadField("aChatRoomResolved", "true", String(d.aChatRoomResolved), d.aChatRoomResolved ? "OK" : d.aChatThreadResolved ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("aComposerRendered", "true", String(d.aComposerRendered), d.aComposerRendered ? "OK" : d.aChatLoadReady ? "NG" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("aChatLoadReady", "true", String(d.aChatLoadReady), d.aChatLoadReady ? "OK" : d.aChatRoomResolved ? "NG" : "—", escapeHtml) +
      `<li><dt>aChatLoadErrorReason</dt><dd class="${d.aChatLoadErrorReason && d.aChatLoadErrorReason !== "—" ? "bench-verdict__status-ng" : ""}">${esc(d.aChatLoadErrorReason)}</dd></li>` +
      `</ul>` +
      formatChatInitDiagHtml("A", d._aChat, escapeHtml) +
      `<p class="bench-verdict__section-title">B chat-detail</p>` +
      `<ul class="bench-verdict__kv">` +
      formatNotifyDisplayLoadField("expectedBChatHref", "chat-detail+thread", d.expectedBChatHref, d._bChat?.frameIsChatDetail ? "OK" : "NG", escapeHtml) +
      formatNotifyDisplayLoadField("actualBChatFrameSrc", d.expectedBChatHref, d.actualBChatFrameSrc, d._bChat?.frameIsChatDetail ? "OK" : "NG", escapeHtml) +
      formatNotifyDisplayLoadField("actualBChatDetailUrl", d.expectedBChatHref, d.actualBChatDetailUrl, d.bChatDetailReached ? "OK" : "NG", escapeHtml) +
      formatNotifyDisplayLoadField("bChatDetailReached", "true", String(d.bChatDetailReached), d.bChatDetailReached ? "OK" : "NG", escapeHtml) +
      formatNotifyDisplayLoadField("bChatDetailInitStarted", "true", String(d.bChatDetailInitStarted), d.bChatDetailInitStarted ? "OK" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("bChatThreadResolved", "true", String(d.bChatThreadResolved), d.bChatThreadResolved ? "OK" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("bChatRoomResolved", "true", String(d.bChatRoomResolved), d.bChatRoomResolved ? "OK" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("bComposerRendered", "true", String(d.bComposerRendered), d.bComposerRendered ? "OK" : "—", escapeHtml) +
      formatNotifyDisplayLoadField("bChatLoadReady", "true", String(d.bChatLoadReady), d.bChatLoadReady ? "OK" : "—", escapeHtml) +
      `<li><dt>bChatLoadErrorReason</dt><dd>${esc(d.bChatLoadErrorReason)}</dd></li>` +
      `</ul>` +
      formatChatInitDiagHtml("B", d._bChat, escapeHtml) +
      ngHtml +
      `</section>`
    );
  }

  function formatDiagDomConsistencyHtml(ddc, ndl, failures, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const d = ddc || {};
    const diag = ndl || {};
    const a = d.aChatDom || {};
    const an = d.aNotifyDom || {};
    const fails = failures || [];
    const verdictCls = fails.length ? "bench-verdict__status-ng" : "bench-verdict__status-ok";
    const verdictText = fails.length
      ? fails.map((f) => f.code).join(", ")
      : diag.postHire
        ? "OK（診断値と実DOM一致）"
        : "— (未到達)";
    const ngHtml = fails.length
      ? `<p class="bench-verdict__section-title">NG 確定（診断 vs 実DOM）</p>` +
        fails
          .map((f, i) =>
            formatBenchNgBlockHtml(
              f,
              escapeHtml,
              buildBenchNgCopyKey(BENCH_NG_SECTION_KEYS.DIAG_DOM, f.code, i)
            )
          )
          .join("")
      : "";
    const row = (label, diagVal, domVal) => {
      const match = String(diagVal) === String(domVal) || (diagVal === true && domVal === true);
      const cls = match ? "bench-verdict__status-ok" : diag.postHire ? "bench-verdict__status-ng" : "";
      return (
        `<li><dt>${esc(label)}</dt>` +
        `<dd class="${cls}">diag=<code>${esc(String(diagVal))}</code> dom=<strong>${esc(String(domVal))}</strong></dd></li>`
      );
    };
    return (
      `<section class="bench-verdict__section" aria-label="診断結果・実DOM一致チェック">` +
      formatBenchSectionCopyHeader(
        "診断結果・実DOM一致チェック",
        BENCH_CONSISTENCY_SECTION_KEYS.DIAG_DOM,
        escapeHtml
      ) +
      `<p class="bench-verdict__detail">判定: <span class="${verdictCls}">${esc(verdictText)}</span></p>` +
      `<p class="bench-verdict__section-title">A chat-detail 実DOM</p>` +
      `<ul class="bench-verdict__kv">` +
      row("aChatLoadReady vs errorVisible", diag.aChatLoadReady, a.actualChatErrorVisible) +
      `<li><dt>actualChatErrorText</dt><dd>${esc(a.actualChatErrorText)}</dd></li>` +
      `<li><dt>actualChatErrorVisible</dt><dd class="${a.actualChatErrorVisible ? "bench-verdict__status-ng" : "bench-verdict__status-ok"}">${esc(String(a.actualChatErrorVisible))}</dd></li>` +
      `<li><dt>actualComposerDomExists</dt><dd>${esc(String(a.actualComposerDomExists))}</dd></li>` +
      `<li><dt>actualComposerVisible</dt><dd>${esc(String(a.actualComposerVisible))}</dd></li>` +
      `<li><dt>actualMessageListExists</dt><dd>${esc(String(a.actualMessageListExists))}</dd></li>` +
      `<li><dt>actualChatRootExists</dt><dd>${esc(String(a.actualChatRootExists))}</dd></li>` +
      `<li><dt>actualChatDetailPageReadyAttr</dt><dd>${esc(a.actualChatDetailPageReadyAttr)}</dd></li>` +
      `<li><dt>actualBodyTextIncludesChatError</dt><dd class="${a.actualBodyTextIncludesChatError ? "bench-verdict__status-ng" : "bench-verdict__status-ok"}">${esc(String(a.actualBodyTextIncludesChatError))}</dd></li>` +
      `</ul>` +
      `<p class="bench-verdict__section-title">A 通知 iframe 実DOM</p>` +
      `<ul class="bench-verdict__kv">` +
      row("rowsCount vs domRowCount", diag.actualANotificationRowsCount, an.actualNotifyRowDomCount) +
      `<li><dt>actualNotifyRowDomCount</dt><dd>${esc(String(an.actualNotifyRowDomCount))}</dd></li>` +
      `<li><dt>actualNotifyLatestRowText</dt><dd>${esc(an.actualNotifyLatestRowText)}</dd></li>` +
      `<li><dt>actualNotifyLatestHref</dt><dd>${esc(an.actualNotifyLatestHref)}</dd></li>` +
      `<li><dt>actualNotifyErrorText</dt><dd>${esc(an.actualNotifyErrorText)}</dd></li>` +
      `<li><dt>actualNotifyErrorVisible</dt><dd class="${an.actualNotifyErrorVisible ? "bench-verdict__status-ng" : ""}">${esc(String(an.actualNotifyErrorVisible))}</dd></li>` +
      `<li><dt>actualNotifyEmptyTextVisible</dt><dd class="${an.actualNotifyEmptyTextVisible ? "bench-verdict__status-ng" : ""}">${esc(String(an.actualNotifyEmptyTextVisible))}</dd></li>` +
      `</ul>` +
      ngHtml +
      `</section>`
    );
  }

  function readNotifyIframe(frameId) {
    try {
      const doc = global.document?.getElementById(frameId)?.contentWindow?.document;
      const diag = global.document?.getElementById(frameId)?.contentWindow?.__tasuBenchNotifyRenderDiag || {};
      if (!doc) return { cardCount: 0, empty: true, ctaVisible: false, diag };
      const cards = doc.querySelectorAll(".talk-notify-card");
      const cta = doc.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action, .talk-notify-card__action");
      const empty = doc.querySelector(".talk-notify-empty-state__title");
      const titleEl = doc.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event");
      const ctaRect = cta?.getBoundingClientRect?.();
      const ctaVisible = Boolean(
        cta &&
          !cta.hidden &&
          ctaRect &&
          ctaRect.height > 4 &&
          ctaRect.width > 4 &&
          global.getComputedStyle(cta).visibility !== "hidden" &&
          global.getComputedStyle(cta).display !== "none"
      );
      return {
        cardCount: cards.length,
        empty: Boolean(empty && cards.length < 1),
        title: pickStr(titleEl?.textContent),
        ctaLabel: pickStr(cta?.textContent),
        ctaVisible,
        diag,
      };
    } catch {
      return { cardCount: 0, empty: true, ctaVisible: false, diag: {} };
    }
  }

  function readChatSide(frameId, sideLabel) {
    try {
      const el = global.document?.getElementById(frameId);
      const win = el?.contentWindow;
      const doc = win?.document;
      const href = pickStr(win?.location?.href, el?.src);
      const diag = win?.__tasuJobFlowDiag || win?.__tasuBenchFlowDiag || {};
      const loadDiag = win?.__tasuChatDetailLoadDiag || {};
      const composerBtn = doc?.getElementById("chatJobEndBarBtn");
      const completeBtn = doc?.getElementById("chatCompleteBtn");
      const debugEl = doc?.getElementById("chatJobEndDebug");
      const composerVisible = Boolean(
        composerBtn &&
          (composerBtn.classList.contains("chat-job-end-bar__btn--visible") ||
            (!composerBtn.hidden && pickStr(composerBtn.textContent)))
      );
      const topVisible = Boolean(completeBtn && !completeBtn.hidden && pickStr(completeBtn.textContent));
      const buttonText = pickStr(
        composerVisible ? composerBtn?.textContent : "",
        topVisible ? completeBtn?.textContent : ""
      );
      const buttonVisible = composerVisible || topVisible;
      const chatInput = doc?.getElementById("chatInput");
      const statusNoticeEl = doc?.getElementById("chatRoomStatusNotice");
      const shippingCardEl = doc?.querySelector("[data-platform-shipping-card]");
      return {
        side: sideLabel,
        frameId,
        chatHref: href,
        isChatDetail: /chat-detail\.html/i.test(href),
        chatOpened: /chat-detail\.html/i.test(href),
        chatLoadReady:
          loadDiag.chatDetailLoadOk === true || doc?.body?.dataset?.chatDetailReady === "true",
        chatLoadError: pickStr(loadDiag.chatDetailLoadErrorReason, loadDiag.chatDetailLoadFailedReason),
        chatLoadDiag: {
          currentUrl: pickStr(loadDiag.currentUrl),
          queryThread: pickStr(loadDiag.chatDetailQueryThread),
          queryRoomId: pickStr(loadDiag.chatDetailQueryRoomId),
          listingId: pickStr(loadDiag.chatDetailListingId, loadDiag.listingId),
          applicationId: pickStr(loadDiag.chatDetailApplicationId, loadDiag.applicationId),
          resolvedThreadId: pickStr(loadDiag.chatDetailResolvedThreadId),
          threadExists: loadDiag.chatDetailThreadExists === true,
          roomExists: loadDiag.chatDetailRoomExists === true,
          ensureJobThreadOk: loadDiag.ensureJobThreadForAccessOk === true,
          ensureJobThreadReason: pickStr(loadDiag.ensureJobThreadForAccessReason),
        },
        currentUserId: pickStr(diag.currentUserId, loadDiag.currentUserId),
        composerEnabled: chatInput ? !chatInput.disabled : false,
        composerVisible: Boolean(chatInput && !chatInput.hidden),
        completionButtonVisible: buttonVisible,
        actualCompletionButton: normalizeButtonText(buttonText) || "none",
        requestButtonVisible: diag.requestButtonVisible === true || composerVisible,
        diagInjected: Boolean(debugEl) || Boolean(diag.at),
        jobEndDebugText: pickStr(debugEl?.textContent).slice(0, 400),
        diag: slimChatSideDiag(diag),
        reviewCtaVisible: Boolean(
          doc?.querySelector("[data-platform-job-review-open], .chat-review-btn, [data-platform-review-open]")
        ),
        reviewVisible: Boolean(doc?.querySelector("[data-platform-job-review-prompt], [data-platform-review-prompt]")),
        payoutInfoVisible: Boolean(doc?.querySelector("[data-platform-payout-info], .chat-payout-info")),
        contactInfoVisible: Boolean(doc?.querySelector("[data-platform-contact-info], .chat-contact-info")),
        noConnectPaymentInstructionVisible: Boolean(
          doc?.querySelector("[data-platform-manual-transfer], .chat-manual-transfer")
        ),
        statusNoticeText: pickStr(statusNoticeEl?.textContent),
        statusNoticeVisible: Boolean(statusNoticeEl && !statusNoticeEl.hidden),
        shippingCardVisible: Boolean(shippingCardEl),
      };
    } catch (err) {
      return { side: sideLabel, frameId, error: String(err?.message || err) };
    }
  }

  function readNotifications(threadId, actorAId, actorBId, config, ctx) {
    let rows = [];
    try {
      rows = JSON.parse(global.localStorage?.getItem("tasful_talk_notifications") || "[]");
    } catch {
      rows = [];
    }
    const tid = pickStr(threadId);
    const related = tid ? rows.filter((n) => String(n.threadId) === tid) : rows;
    const target = config?.benchNotifyTarget || {};
    const titleMatch = target.titleMatch;
    const findFor = (uid) => {
      if (!uid) return null;
      return (
        rows.find((n) => String(n.recipientUserId) === uid && titleMatches(n.title, titleMatch)) || null
      );
    };
    const targetSide = config?.benchNotifyTarget?.side === "A" ? "A" : "B";
    const expTarget =
      titleMatch instanceof RegExp
        ? String(titleMatch)
        : pickStr(titleMatch, config?.expectedNotifications?.hiredB?.title);
    const expA =
      targetSide === "A"
        ? expTarget
        : pickStr(config?.expectedNotifications?.applyA?.title, config?.expectedNotifications?.requestA?.title, "—");
    const expB =
      targetSide === "B"
        ? expTarget
        : pickStr(config?.expectedNotifications?.hiredB?.title, config?.expectedNotifications?.startedB?.title, "—");
    const completion = config?.expectedNotifications?.completionAB;
    const completionPattern = completion?.title || /完了/;
    return {
      rows,
      related,
      expectedNotificationA: expA,
      expectedNotificationB: expB,
      actualNotificationA: findFor(actorAId),
      actualNotificationB: findFor(actorBId),
      notificationExists: Boolean(findFor(actorAId) || findFor(actorBId) || ctx?.hiredRow),
      recipientMatches:
        !ctx?.hiredRow || pickStr(ctx.hiredRow.recipientUserId) === pickStr(ctx?.userId),
      completionA: related.find(
        (n) => String(n.recipientUserId) === actorAId && titleMatches(n.title, completionPattern)
      ),
      completionB: related.find(
        (n) => String(n.recipientUserId) === actorBId && titleMatches(n.title, completionPattern)
      ),
      reviewA: related.find(
        (n) =>
          String(n.recipientUserId) === actorAId &&
          /レビュー|評価/.test(String(n.title || ""))
      ),
      reviewB: related.find(
        (n) =>
          String(n.recipientUserId) === actorBId &&
          /レビュー|評価/.test(String(n.title || ""))
      ),
      completionApprovedA: related.find(
        (n) =>
          String(n.recipientUserId) === actorAId &&
          /承認され|完了が承認/.test(String(n.title || ""))
      ),
      completionApprovedB: related.find(
        (n) =>
          String(n.recipientUserId) === actorBId &&
          /承認され|完了が承認/.test(String(n.title || ""))
      ),
      completionApprovedNotifyDiag: global.__tasuCompletionApprovedNotifyDiag || null,
      reviewNotifyDiag: global.__tasuReviewNotifyDiag || null,
    };
  }

  function collectSnapshot(ctx) {
    const Config = global.TasuPlatformChatCategoryFlowConfig;
    const profile = ctx?.profile || {};
    const config = Config?.getCategoryFlowConfig?.(profile, { connect: profile.connect }) || {};
    const sides = ctx?.sides || {};
    const actorAId = pickStr(sides.A?.userId, config.actorA?.userId);
    const actorBId = pickStr(sides.B?.userId, config.actorB?.userId);
    const threadId = pickStr(ctx?.threadId, ctx?.cta?.threadId, ctx?.thread?.id);
    const thread =
      ctx?.thread && typeof ctx.thread === "object"
        ? ctx.thread
        : threadId && global.TasuChatThreadStore?.readAll
          ? (global.TasuChatThreadStore.readAll() || []).find((t) => String(t.id) === threadId)
          : null;
    const roomStatus = pickStr(thread?.roomStatus, thread?.status, ctx?.roomStatus);
    const jobStatus = pickStr(thread?.jobStatus);
    const dealStatus = pickStr(thread?.dealStatus);
    const builderStatus = pickStr(thread?.builderProjectStatus, thread?.projectStatus);
    const stage =
      Config?.resolveFlowStage?.(roomStatus, jobStatus, roomStatus, config) || "active";
    const stageExpect = Config?.getStageExpectations?.(config, stage) || {};
    const notifs = readNotifications(threadId, actorAId, actorBId, config, ctx);
    const sideA = readChatSide("frame-a-chat", "A");
    const sideB = readChatSide("frame-b-chat", "B");
    const notifyA = readNotifyIframe("frame-a-notify");
    const notifyB = readNotifyIframe("frame-b-notify");
    const targetSide = config.benchNotifyTarget?.side === "A" ? "A" : "B";
    const targetNotify = targetSide === "A" ? notifyA : notifyB;
    const cta = ctx?.cta || {};
    return {
      config,
      category: config.category,
      categoryLabel: config.label,
      stage,
      stageExpect,
      threadId,
      thread,
      roomStatus,
      jobStatus,
      dealStatus,
      builderStatus,
      actorAId,
      actorBId,
      sideA,
      sideB,
      notifs,
      notifyA,
      notifyB,
      targetNotify,
      targetSide,
      notifyDiag: ctx?.notifyDiag || ctx?.diag || {},
      cta,
      jobEnd: ctx?.jobEnd || null,
      ctx: {
        threadId: pickStr(ctx?.threadId, ctx?.cta?.threadId, ctx?.thread?.id),
        userId: pickStr(ctx?.userId),
        diagFocus: pickStr(ctx?.diagFocus),
        hiredRow: ctx?.hiredRow
          ? {
              recipientUserId: pickStr(ctx.hiredRow.recipientUserId),
              title: pickStr(ctx.hiredRow.title),
              href: pickStr(ctx.hiredRow.href, ctx.hiredRow.targetUrl),
              actionLabel: pickStr(ctx.hiredRow.actionLabel),
            }
          : null,
        profile: ctx?.profile
          ? { id: pickStr(ctx.profile.id), connect: ctx.profile.connect === true }
          : null,
      },
    };
  }

  function buildStageDiagnostics(snapshot, options) {
    const exp = snapshot.stageExpect || {};
    const notifs = snapshot.notifs || {};
    const cta = snapshot.cta || {};
    const targetNotify = snapshot.targetNotify || {};
    const targetRow = snapshot.ctx?.hiredRow;

    const notification = {
      expectedNotificationA: notifs.expectedNotificationA,
      expectedNotificationB: notifs.expectedNotificationB,
      actualNotificationA: pickStr(notifs.actualNotificationA?.title, "—"),
      actualNotificationB: pickStr(notifs.actualNotificationB?.title, targetRow?.title, "—"),
      notificationExists: notifs.notificationExists,
      recipientMatches: notifs.recipientMatches,
      notificationDomVisible: targetNotify.cardCount > 0 && !targetNotify.empty,
      targetSide: snapshot.targetSide,
      iframeCardCount: targetNotify.cardCount,
      ctaDomVisible: targetNotify.ctaVisible,
    };

    const ctaStage = {
      expectedCtaLabel: pickStr(
        snapshot.config?.expectedCta?.hiredB,
        snapshot.config?.expectedCta?.chat,
        targetNotify.ctaLabel
      ),
      actualCtaLabel: pickStr(targetNotify.ctaLabel, targetRow?.actionLabel, "—"),
      ctaHref: pickStr(cta.href, targetRow?.href, targetRow?.targetUrl),
      ctaThreadId: pickStr(cta.threadId, snapshot.threadId),
      threadExists: cta.threadExists === true || Boolean(snapshot.thread),
      roomExists: cta.roomExists === true || Boolean(snapshot.thread),
      chatLookupResult: pickStr(cta.chatLookup, cta.chatReady ? "ready" : "—"),
      ctaVisible: targetNotify.ctaVisible,
    };

    const chat = {
      chatOpenedA: snapshot.sideA.chatOpened === true,
      chatOpenedB: snapshot.sideB.chatOpened === true,
      chatLoadReadyA: snapshot.sideA.chatLoadReady === true,
      chatLoadReadyB: snapshot.sideB.chatLoadReady === true,
      messageAtoB: snapshot.sideA.diag?.hasAnyMessage === true,
      messageBtoA: snapshot.sideB.diag?.hasAnyMessage === true,
      composerEnabledA: snapshot.sideA.composerEnabled,
      composerEnabledB: snapshot.sideB.composerEnabled,
      composerVisibleA: snapshot.sideA.composerVisible,
      composerVisibleB: snapshot.sideB.composerVisible,
    };

    const completion = {
      expectedCompletionActor: pickStr(exp.expectedCompletionActor, "—"),
      expectedCompletionButtonA: pickStr(exp.expectedButtonA, "none"),
      expectedCompletionButtonB: pickStr(exp.expectedButtonB, "none"),
      actualCompletionButtonA: pickStr(snapshot.sideA.actualCompletionButton, "none"),
      actualCompletionButtonB: pickStr(snapshot.sideB.actualCompletionButton, "none"),
      completionButtonVisibleA: snapshot.sideA.completionButtonVisible,
      completionButtonVisibleB: snapshot.sideB.completionButtonVisible,
      completionStatus: pickStr(snapshot.thread?.completionStatus, snapshot.roomStatus),
      roomStatus: snapshot.roomStatus,
      jobStatus: snapshot.jobStatus,
      dealStatus: snapshot.dealStatus,
      builderStatus: snapshot.builderStatus,
    };

    const review = {
      completionApprovedNotifyCreated: Boolean(
        notifs.completionApprovedNotifyDiag?.completionApprovedNotifyCreated
      ),
      completionApprovedNotifyRecipient: pickStr(
        notifs.completionApprovedNotifyDiag?.completionApprovedNotifyRecipient,
        notifs.completionApprovedA?.recipientUserId,
        "—"
      ),
      reviewNotifyCreated: Boolean(notifs.reviewNotifyDiag?.reviewNotifyCreated),
      reviewNotifyRecipient: pickStr(
        notifs.reviewNotifyDiag?.reviewNotifyRecipient,
        notifs.reviewA?.recipientUserId,
        "—"
      ),
      reviewNotificationA: Boolean(notifs.reviewA || notifs.completionA),
      reviewNotificationB: Boolean(notifs.reviewB || notifs.completionB),
      reviewTargetA: pickStr(notifs.reviewA?.reviewTargetUserId, notifs.completionA?.reviewTargetUserId, "—"),
      reviewTargetB: pickStr(notifs.reviewB?.reviewTargetUserId, notifs.completionB?.reviewTargetUserId, "—"),
      reviewCtaVisibleA: snapshot.sideA.reviewCtaVisible || snapshot.sideA.reviewVisible,
      reviewCtaVisibleB: snapshot.sideB.reviewCtaVisible || snapshot.sideB.reviewVisible,
      reviewSubmittedA: snapshot.sideA.diag?.reviewSubmitted === true,
      reviewSubmittedB: snapshot.sideB.diag?.reviewSubmitted === true,
      duplicateReviewBlocked: false,
    };

    const categoryExtra = {};
    const cat = snapshot.category;
    if (cat === "purchase_no_connect") {
      categoryExtra.payoutInfoVisible = snapshot.sideB.payoutInfoVisible || snapshot.sideA.payoutInfoVisible;
      categoryExtra.contactInfoVisible = snapshot.sideB.contactInfoVisible || snapshot.sideA.contactInfoVisible;
      categoryExtra.noConnectPaymentInstructionVisible =
        snapshot.sideB.noConnectPaymentInstructionVisible || snapshot.sideA.noConnectPaymentInstructionVisible;
    }
    if (cat === "purchase_connect") {
      categoryExtra.stripePaymentStatus = pickStr(snapshot.thread?.stripePaymentStatus, "—");
      categoryExtra.connectAccountStatus = pickStr(snapshot.thread?.connectAccountStatus, "—");
      categoryExtra.transferStatus = pickStr(snapshot.thread?.transferStatus, "—");
      categoryExtra.payoutStatus = pickStr(snapshot.thread?.payoutStatus, "—");
    }
    if (cat === "builder") {
      categoryExtra.sitePhotosUploaded = pickStr(snapshot.thread?.sitePhotosUploaded, "—");
      categoryExtra.reportPdfGenerated = pickStr(snapshot.thread?.reportPdfGenerated, "—");
      categoryExtra.completionReportVisible = Boolean(snapshot.thread?.completionReportVisible);
      categoryExtra.approvalButtonVisible = completion.completionButtonVisibleA;
      categoryExtra.builderProjectStatus = snapshot.builderStatus;
    }

    const userConsistency = buildUserIdConsistencyDiagnostics(snapshot);
    const notifyDisplayLoad = buildNotifyDisplayLoadDiagnostics(snapshot, options);
    const diagDomConsistency = buildDiagDomConsistencyDiagnostics(
      snapshot,
      notifyDisplayLoad,
      options
    );

    return {
      notification,
      cta: ctaStage,
      chat,
      completion,
      review,
      categoryExtra,
      userConsistency,
      notifyDisplayLoad,
      diagDomConsistency,
    };
  }

  function evaluateSideButton(sideKey, snapshot) {
    const side = sideKey === "A" ? snapshot.sideA : snapshot.sideB;
    const actor = sideKey === "A" ? snapshot.config.actorA : snapshot.config.actorB;
    const expKey = sideKey === "A" ? "expectedButtonA" : "expectedButtonB";
    const expected = pickStr(snapshot.stageExpect?.[expKey], "none");
    const actual = pickStr(side.actualCompletionButton, "none");
    const visible = side.completionButtonVisible === true;

    if (expected === "none") {
      if (!visible || actual === "none") {
        const note =
          sideKey === "B" && snapshot.stage === "active" && snapshot.stageExpect?.bButtonHiddenOk
            ? `${sideKey} active 非表示は正常`
            : sideKey === "A" && snapshot.stage === "active"
              ? `${sideKey} active 非表示は正常`
              : "";
        return { ok: true, code: NG_CODES.OK, expected, actual, visible, note };
      }
      if (snapshot.stage === "active" && sideKey === "B" && /終了を依頼する/.test(actual)) {
        return {
          ok: false,
          code: NG_CODES.ROLE_MISMATCH,
          expected,
          actual,
          visible,
          note: `${actor?.label || "B"}に終了依頼ボタンが出ている`,
        };
      }
      return {
        ok: false,
        code: NG_CODES.WRONG_TEXT,
        expected,
        actual,
        visible,
        note: `${actor?.label || sideKey}に不要なボタン`,
      };
    }

    if (!side.isChatDetail) {
      return {
        ok: false,
        code: NG_CODES.CHAT_LOAD_FAILED,
        expected,
        actual,
        visible,
        note: `${sideKey} chat-detail 未読込`,
      };
    }
    if (!side.diagInjected && snapshot.config.category === "job") {
      return {
        ok: false,
        code: NG_CODES.DIAG_MISSING,
        expected,
        actual,
        visible,
        note: `${sideKey} JOB END DEBUG 未注入`,
      };
    }
    if (!visible || !buttonMatches(expected, actual)) {
      const code =
        visible && actual !== "none" ? NG_CODES.WRONG_TEXT : NG_CODES.EXPECTED_BUTTON_MISSING;
      return { ok: false, code, expected, actual: actual || "none", visible };
    }
    return { ok: true, code: NG_CODES.OK, expected, actual, visible };
  }

  function pickPrimaryFail(checks) {
    const failed = checks.filter((c) => !c.ok);
    if (!failed.length) return null;
    for (const code of NG_PRIORITY) {
      const hit = failed.find((c) => c.code === code);
      if (hit) return hit;
    }
    return failed[0];
  }

  function buildVerdict(snapshot) {
    const stages = buildStageDiagnostics(snapshot);
    const checks = [];
    const push = (name, ok, code, detail, stage) =>
      checks.push({ name, ok, code: ok ? NG_CODES.OK : code, detail, stage });

    const aBtn = evaluateSideButton("A", snapshot);
    const bBtn = evaluateSideButton("B", snapshot);
    const ucFailures = evaluateUserConsistencyFailures(snapshot, stages.userConsistency);
    ucFailures.forEach((fail) => {
      push(fail.name, false, fail.code, fail.detail, fail.stage);
    });
    if (!ucFailures.length) {
      push("A/B userId整合", true, NG_CODES.OK, "expected/actual 一致", "notification");
    }
    const { failures: displayFailures } = evaluateBenchDisplayFailures(snapshot, stages);
    displayFailures.forEach((fail) => {
      push(
        fail.code,
        false,
        fail.code,
        `${fail.cause} | expected=${fail.expected} actual=${fail.actual} diff=${fail.diff}`,
        fail.stage
      );
    });
    if (!displayFailures.length && stages.notifyDisplayLoad?.postHire) {
      push("通知表示・chat読込・DOM一致", true, NG_CODES.OK, "診断/実DOM 一致", "chat");
    }

    if (!stages.notification.notificationExists && snapshot.ctx?.hiredRow == null) {
      const expN =
        snapshot.targetSide === "A"
          ? stages.notification.expectedNotificationA
          : stages.notification.expectedNotificationB;
      push(
        "通知生成",
        false,
        NG_CODES.NOTIFICATION_MISSING,
        `${snapshot.targetSide || "B"}向け通知なし（expected=${expN}）`,
        "notification"
      );
    } else {
      push("通知生成", true, NG_CODES.OK, "storage hit", "notification");
    }

    if (stages.notification.notificationExists && !stages.notification.recipientMatches) {
      push("recipient一致", false, NG_CODES.RECIPIENT_MISMATCH, "recipientUserId mismatch", "notification");
    } else if (stages.notification.notificationExists) {
      push("recipient一致", true, NG_CODES.OK, "OK", "notification");
    }

    if (stages.notification.notificationExists && !stages.notification.notificationDomVisible) {
      push(
        "通知DOM",
        false,
        NG_CODES.NOTIFICATION_DOM_MISSING,
        `iframe cards=${stages.notification.iframeCardCount}`,
        "notification"
      );
    } else if (stages.notification.notificationExists) {
      push("通知DOM", true, NG_CODES.OK, "visible", "notification");
    }

    if (stages.cta.ctaHref && !stages.cta.threadExists) {
      push("thread存在", false, NG_CODES.THREAD_MISSING, stages.cta.ctaThreadId, "cta");
    } else if (stages.cta.ctaThreadId) {
      push("thread存在", true, NG_CODES.OK, stages.cta.ctaThreadId, "cta");
    }

    if (stages.cta.ctaHref && stages.cta.threadExists && !stages.cta.roomExists) {
      push("room存在", false, NG_CODES.ROOM_MISSING, stages.cta.ctaThreadId, "cta");
    } else if (stages.cta.ctaThreadId) {
      push("room存在", true, NG_CODES.OK, "ok", "cta");
    }

    if (stages.notification.notificationDomVisible && !stages.cta.ctaVisible && stages.cta.ctaHref) {
      push("CTA DOM", false, NG_CODES.CTA_MISSING, stages.cta.actualCtaLabel, "cta");
    } else if (stages.cta.ctaHref) {
      push("CTA DOM", true, NG_CODES.OK, stages.cta.actualCtaLabel, "cta");
    }

    if (snapshot.sideA.chatOpened && !snapshot.sideA.chatLoadReady) {
      push("Aチャット読込", false, NG_CODES.CHAT_LOAD_FAILED, snapshot.sideA.chatLoadError || "not ready", "chat");
    } else if (snapshot.sideA.chatOpened) {
      push("Aチャット読込", true, NG_CODES.OK, "ready", "chat");
    }
    if (snapshot.sideB.chatOpened && !snapshot.sideB.chatLoadReady) {
      push("Bチャット読込", false, NG_CODES.CHAT_LOAD_FAILED, snapshot.sideB.chatLoadError || "not ready", "chat");
    } else if (snapshot.sideB.chatOpened) {
      push("Bチャット読込", true, NG_CODES.OK, "ready", "chat");
    }

    push(
      "A完了ボタン",
      aBtn.ok,
      aBtn.code,
      `expected=${aBtn.expected} actual=${aBtn.actual} visible=${aBtn.visible}${aBtn.note ? ` (${aBtn.note})` : ""}`,
      "completion"
    );
    push(
      "B完了ボタン",
      bBtn.ok,
      bBtn.code,
      `expected=${bBtn.expected} actual=${bBtn.actual} visible=${bBtn.visible}${bBtn.note ? ` (${bBtn.note})` : ""}`,
      "completion"
    );

    if (snapshot.stage === "completed" || snapshot.stage === "closed") {
      if (!stages.review.reviewCtaVisibleA && stages.completion.expectedCompletionButtonA !== "none") {
        push("AレビューCTA", false, NG_CODES.REVIEW_NOTIFICATION_MISSING, "review CTA not visible", "review");
      }
      if (!stages.review.reviewCtaVisibleB && stages.completion.expectedCompletionButtonB !== "none") {
        push("BレビューCTA", false, NG_CODES.REVIEW_NOTIFICATION_MISSING, "review CTA not visible", "review");
      }
    }

    const primaryFail = pickPrimaryFail(checks);
    const code = primaryFail?.code || NG_CODES.OK;
    const fix = FIX_MAP[code] || FIX_MAP[NG_CODES.EXPECTED_BUTTON_MISSING];

    let finalNg = "なし（OK）";
    if (primaryFail) {
      if (primaryFail.name === "A完了ボタン" && !aBtn.ok) {
        finalNg = `A${snapshot.config.actorA?.label || "掲載者"}の「${aBtn.expected}」が未表示`;
      } else if (primaryFail.name === "B完了ボタン" && !bBtn.ok) {
        if (bBtn.expected === "none") {
          finalNg = `B${snapshot.config.actorB?.label || "応募者"}に不要なボタンが表示されている`;
        } else {
          finalNg = `B${snapshot.config.actorB?.label || "応募者"}の「${bBtn.expected}」が未表示`;
        }
      } else if (primaryFail.code === NG_CODES.NOTIFICATION_MISSING) {
        finalNg = primaryFail.detail || "期待通知が未生成";
      } else {
        finalNg = primaryFail.detail || primaryFail.name;
      }
    }

    const uc = stages.userConsistency || {};
    const evidence = [
      `expectedAUserId=${uc.expectedAUserId || "—"}`,
      `actualANotifyFrameUserId=${uc.actualANotifyFrameUserId || "—"} (${uc.aNotifyCmp?.diff || "—"})`,
      `actualATalkHomeUserId=${uc.actualATalkHomeUserId || "—"} (${uc.aTalkCmp?.diff || "—"})`,
      `actualAChatFrameUserId=${uc.actualAChatFrameUserId || "—"} (${uc.aChatFrameCmp?.diff || "—"})`,
      `actualAChatDetailQueryUserId=${uc.actualAChatDetailQueryUserId || "—"} (${uc.aChatDetailCmp?.diff || "—"})`,
      `expectedBUserId=${uc.expectedBUserId || "—"}`,
      `actualBNotifyFrameUserId=${uc.actualBNotifyFrameUserId || "—"} (${uc.bNotifyCmp?.diff || "—"})`,
      `actualBTalkHomeUserId=${uc.actualBTalkHomeUserId || "—"} (${uc.bTalkCmp?.diff || "—"})`,
      `actualBChatFrameUserId=${uc.actualBChatFrameUserId || "—"} (${uc.bChatFrameCmp?.diff || "—"})`,
      `actualBChatDetailQueryUserId=${uc.actualBChatDetailQueryUserId || "—"} (${uc.bChatDetailCmp?.diff || "—"})`,
      `threadParticipants=${uc.threadParticipants || "—"}`,
      `isAInThreadParticipants=${uc.isAInThreadParticipants == null ? "—" : uc.isAInThreadParticipants} (${uc.aParticipantCmp?.diff || "—"})`,
      `isBInThreadParticipants=${uc.isBInThreadParticipants == null ? "—" : uc.isBInThreadParticipants} (${uc.bParticipantCmp?.diff || "—"})`,
      `completionNotifyRecipient=${uc.completionNotifyRecipient || "—"} (${uc.completionCmp?.diff || "—"})`,
      `reviewNotifyRecipient=${uc.reviewNotifyRecipient || "—"} (${uc.reviewCmp?.diff || "—"})`,
      ...(stages.notifyDisplayLoad
        ? [
            `aNotificationRenderDiff=${stages.notifyDisplayLoad.aNotificationRenderDiff}`,
            `aChatLoadReady=${stages.notifyDisplayLoad.aChatLoadReady}`,
            `aChatLoadErrorReason=${stages.notifyDisplayLoad.aChatLoadErrorReason}`,
            `actualAChatFrameSrc=${stages.notifyDisplayLoad.actualAChatFrameSrc}`,
          ]
        : []),
      `A expectedButton=${aBtn.expected}`,
      `A actualButton=${aBtn.actual}`,
      `A visible=${aBtn.visible}`,
      `A roomStatus=${snapshot.roomStatus}`,
      `A hasAnyMessage=${snapshot.sideA.diag?.hasAnyMessage === true}`,
      `B expectedButton=${bBtn.expected}`,
      `B actualButton=${bBtn.actual}`,
      `B visible=${bBtn.visible}`,
      bBtn.expected === "none" && snapshot.stage === "active" ? "B active button none は正常" : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      ok: !primaryFail,
      category: snapshot.category,
      categoryLabel: snapshot.categoryLabel,
      stage: snapshot.stage,
      finalNg,
      code,
      fixFiles: fix?.files || [],
      fixFns: fix?.fns || [],
      checks,
      aBtn,
      bBtn,
      evidence,
      stages,
      snapshot,
    };
  }

  function formatUserConsistencyRow(label, cmp, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const c = cmp || {};
    const cls =
      c.ok === true && !c.pending
        ? "bench-verdict__status-ok"
        : c.pending
          ? ""
          : "bench-verdict__status-ng";
    return (
      `<li><dt>${esc(label)}</dt>` +
      `<dd class="${cls}">` +
      `actual=<strong>${esc(c.actual || "—")}</strong> ` +
      `expected=<code>${esc(c.expected || "—")}</code> ` +
      `diff=<em>${esc(c.diff || "—")}</em>` +
      `</dd></li>`
    );
  }

  function formatUserConsistencyHtml(userConsistency, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const uc = userConsistency || {};
    const failures = [];
    if (uc.aNotifyCmp && !uc.aNotifyCmp.ok && !uc.aNotifyCmp.pending) failures.push("a_user_mismatch(notify)");
    if (uc.aTalkCmp && !uc.aTalkCmp.ok && !uc.aTalkCmp.pending) failures.push("a_user_mismatch(talk-home)");
    if (uc.aChatFrameCmp && !uc.aChatFrameCmp.ok && !uc.aChatFrameCmp.pending) failures.push("a_user_mismatch(chat-frame)");
    if (uc.aChatDetailCmp && !uc.aChatDetailCmp.ok && !uc.aChatDetailCmp.pending) {
      failures.push("a_user_mismatch(chat-detail)");
    }
    if (uc.bNotifyCmp && !uc.bNotifyCmp.ok && !uc.bNotifyCmp.pending) failures.push("b_user_mismatch(notify)");
    if (uc.bTalkCmp && !uc.bTalkCmp.ok && !uc.bTalkCmp.pending) failures.push("b_user_mismatch(talk-home)");
    if (uc.bChatFrameCmp && !uc.bChatFrameCmp.ok && !uc.bChatFrameCmp.pending) failures.push("b_user_mismatch(chat-frame)");
    if (uc.bChatDetailCmp && !uc.bChatDetailCmp.ok && !uc.bChatDetailCmp.pending) {
      failures.push("b_user_mismatch(chat-detail)");
    }
    if (uc.aParticipantCmp && !uc.aParticipantCmp.ok && !uc.aParticipantCmp.pending) {
      failures.push("a_not_participant");
    }
    if (uc.bParticipantCmp && !uc.bParticipantCmp.ok && !uc.bParticipantCmp.pending) {
      failures.push("b_not_participant");
    }
    if (uc.completionCmp && !uc.completionCmp.ok && !uc.completionCmp.pending) {
      failures.push("completion_notify_recipient_mismatch");
    }
    if (uc.reviewCmp && !uc.reviewCmp.ok && !uc.reviewCmp.pending) {
      failures.push("review_notify_recipient_mismatch");
    }
    const verdictCls = failures.length ? "bench-verdict__status-ng" : "bench-verdict__status-ok";
    const verdictText = failures.length ? failures.join(", ") : "OK（expected/actual 一致）";
    return (
      `<section class="bench-verdict__section" aria-label="A/B userId整合性">` +
      formatBenchSectionCopyHeader(
        "A/B userId 整合性（expected / actual / diff）",
        BENCH_CONSISTENCY_SECTION_KEYS.USER_ID,
        escapeHtml
      ) +
      `<p class="bench-verdict__detail">判定: <span class="${verdictCls}">${esc(verdictText)}</span></p>` +
      `<p class="bench-verdict__section-title">A 掲載者 (poster)</p>` +
      `<ul class="bench-verdict__kv">` +
      `<li><dt>expectedAUserId</dt><dd><code>${esc(uc.expectedAUserId || "—")}</code></dd></li>` +
      formatUserConsistencyRow("actualANotifyFrameUserId", uc.aNotifyCmp, escapeHtml) +
      formatUserConsistencyRow("actualATalkHomeUserId", uc.aTalkCmp, escapeHtml) +
      formatUserConsistencyRow("actualAChatFrameUserId", uc.aChatFrameCmp, escapeHtml) +
      formatUserConsistencyRow("actualAChatDetailQueryUserId", uc.aChatDetailCmp, escapeHtml) +
      `</ul>` +
      `<p class="bench-verdict__section-title">B 応募者 (applicant)</p>` +
      `<ul class="bench-verdict__kv">` +
      `<li><dt>expectedBUserId</dt><dd><code>${esc(uc.expectedBUserId || "—")}</code></dd></li>` +
      formatUserConsistencyRow("actualBNotifyFrameUserId", uc.bNotifyCmp, escapeHtml) +
      formatUserConsistencyRow("actualBTalkHomeUserId", uc.bTalkCmp, escapeHtml) +
      formatUserConsistencyRow("actualBChatFrameUserId", uc.bChatFrameCmp, escapeHtml) +
      formatUserConsistencyRow("actualBChatDetailQueryUserId", uc.bChatDetailCmp, escapeHtml) +
      `</ul>` +
      `<p class="bench-verdict__section-title">thread / 完了・レビュー通知 recipient</p>` +
      `<ul class="bench-verdict__kv">` +
      `<li><dt>threadParticipants</dt><dd>${esc(uc.threadParticipants || "—")}</dd></li>` +
      formatUserConsistencyRow("isAInThreadParticipants", uc.aParticipantCmp, escapeHtml) +
      formatUserConsistencyRow("isBInThreadParticipants", uc.bParticipantCmp, escapeHtml) +
      formatUserConsistencyRow("completionNotifyRecipient", uc.completionCmp, escapeHtml) +
      formatUserConsistencyRow("reviewNotifyRecipient", uc.reviewCmp, escapeHtml) +
      `<li><dt>isCompletionNotifyForA</dt><dd class="${uc.isCompletionNotifyForA === true ? "bench-verdict__status-ok" : uc.isCompletionNotifyForA === false ? "bench-verdict__status-ng" : ""}">${uc.isCompletionNotifyForA == null ? "—" : String(uc.isCompletionNotifyForA)}</dd></li>` +
      `<li><dt>isReviewNotifyForA</dt><dd class="${uc.isReviewNotifyForA === true ? "bench-verdict__status-ok" : uc.isReviewNotifyForA === false ? "bench-verdict__status-ng" : ""}">${uc.isReviewNotifyForA == null ? "—" : String(uc.isReviewNotifyForA)}</dd></li>` +
      `</ul>` +
      `</section>`
    );
  }

  function formatVerdictHtml(verdict, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const ok = verdict.ok;
    const fixFile = verdict.fixFiles?.[0] || "—";
    const fixFn = verdict.fixFns?.[0] || "—";
    return (
      `<section class="bench-verdict__section bench-verdict__section--primary" aria-label="共通フロー判定">` +
      `<p class="bench-verdict__section-title">共通フロー判定（期待 vs 実状態）</p>` +
      `<ul class="bench-verdict__kv">` +
      `<li><dt>カテゴリ</dt><dd>${esc(verdict.categoryLabel || verdict.category)}</dd></li>` +
      `<li><dt>現在ステージ</dt><dd>${esc(verdict.stage)}</dd></li>` +
      `<li><dt>最終NG</dt><dd class="${ok ? "bench-verdict__status-ok" : "bench-verdict__status-ng"}">${esc(verdict.finalNg)}</dd></li>` +
      `<li><dt>分類</dt><dd>${esc(verdict.code)}</dd></li>` +
      `<li><dt>修正対象</dt><dd>${esc(fixFile)}</dd></li>` +
      `<li><dt>修正関数</dt><dd>${esc(fixFn)}</dd></li>` +
      `</ul>` +
      `<p class="bench-verdict__section-title">根拠</p>` +
      `<pre class="bench-verdict__track">${esc(verdict.evidence || "")}</pre>` +
      `</section>`
    );
  }

  function formatStagesHtml(verdict, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const s = verdict.stages || {};
    const kv = (pairs) =>
      `<ul class="bench-verdict__kv">${pairs
        .map(([k, v, ok]) => {
          const cls =
            ok === true ? "bench-verdict__status-ok" : ok === false ? "bench-verdict__status-ng" : "";
          return `<li><dt>${esc(k)}</dt><dd class="${cls}">${esc(String(v ?? "—"))}</dd></li>`;
        })
        .join("")}</ul>`;

    const notif = s.notification || {};
    const cta = s.cta || {};
    const chat = s.chat || {};
    const comp = s.completion || {};
    const review = s.review || {};
    const extra = s.categoryExtra || {};
    const userConsistency = s.userConsistency || verdict?.stages?.userConsistency || {};
    const notifyDisplayLoad = s.notifyDisplayLoad || verdict?.stages?.notifyDisplayLoad || {};
    const diagDomConsistency = s.diagDomConsistency || verdict?.stages?.diagDomConsistency || {};
    const { failures: displayFailures } = evaluateBenchDisplayFailures(verdict?.snapshot || {}, {
      notifyDisplayLoad,
      diagDomConsistency,
    });

    let extraHtml = "";
    const extraKeys = Object.keys(extra);
    if (extraKeys.length) {
      extraHtml =
        `<section class="bench-verdict__section" aria-label="カテゴリ別診断">` +
        `<p class="bench-verdict__section-title">カテゴリ別診断（${esc(verdict.categoryLabel)}）</p>` +
        kv(extraKeys.map((k) => [k, extra[k], null])) +
        `</section>`;
    }

    const completionReviewNotify =
      notifyDisplayLoad.completionReviewNotify ||
      buildCompletionReviewNotifyDiagnostics(verdict?.snapshot || {});

    return (
      formatVerdictHtml(verdict, escapeHtml) +
      formatUserConsistencyHtml(userConsistency, escapeHtml) +
      formatNotifyDisplayLoadHtml(notifyDisplayLoad, displayFailures, escapeHtml) +
      formatCompletionReviewNotifyHtml(completionReviewNotify, displayFailures, escapeHtml) +
      formatDiagDomConsistencyHtml(diagDomConsistency, notifyDisplayLoad, displayFailures.filter((f) => f.isDomConsistency), escapeHtml) +
      `<section class="bench-verdict__section" aria-label="notification診断">` +
      `<p class="bench-verdict__section-title">notification</p>` +
      kv([
        ["expectedNotificationA", notif.expectedNotificationA, null],
        ["expectedNotificationB", notif.expectedNotificationB, null],
        ["actualNotificationA", notif.actualNotificationA, null],
        ["actualNotificationB", notif.actualNotificationB, null],
        ["notificationExists", notif.notificationExists, notif.notificationExists],
        ["recipientMatches", notif.recipientMatches, notif.recipientMatches],
        ["notificationDomVisible", notif.notificationDomVisible, notif.notificationDomVisible],
      ]) +
      `</section>` +
      `<section class="bench-verdict__section" aria-label="CTA診断">` +
      `<p class="bench-verdict__section-title">CTA</p>` +
      kv([
        ["expectedCtaLabel", cta.expectedCtaLabel, null],
        ["actualCtaLabel", cta.actualCtaLabel, null],
        ["ctaHref", cta.ctaHref, null],
        ["ctaThreadId", cta.ctaThreadId, null],
        ["threadExists", cta.threadExists, cta.threadExists],
        ["roomExists", cta.roomExists, cta.roomExists],
        ["chatLookupResult", cta.chatLookupResult, null],
        ["ctaDomVisible", cta.ctaVisible, cta.ctaVisible],
      ]) +
      `</section>` +
      `<section class="bench-verdict__section" aria-label="chat診断">` +
      `<p class="bench-verdict__section-title">chat</p>` +
      kv([
        ["chatOpenedA", chat.chatOpenedA, chat.chatOpenedA],
        ["chatOpenedB", chat.chatOpenedB, chat.chatOpenedB],
        ["chatLoadReadyA", chat.chatLoadReadyA, chat.chatLoadReadyA],
        ["chatLoadReadyB", chat.chatLoadReadyB, chat.chatLoadReadyB],
        ["messageAtoB", chat.messageAtoB, chat.messageAtoB],
        ["messageBtoA", chat.messageBtoA, chat.messageBtoA],
        ["composerEnabledA", chat.composerEnabledA, null],
        ["composerEnabledB", chat.composerEnabledB, null],
        ["composerVisibleA", chat.composerVisibleA, chat.composerVisibleA],
        ["composerVisibleB", chat.composerVisibleB, chat.composerVisibleB],
      ]) +
      `</section>` +
      `<section class="bench-verdict__section" aria-label="completion診断">` +
      `<p class="bench-verdict__section-title">completion / close</p>` +
      kv([
        ["expectedCompletionActor", comp.expectedCompletionActor, null],
        ["expectedCompletionButtonA", comp.expectedCompletionButtonA, null],
        ["expectedCompletionButtonB", comp.expectedCompletionButtonB, null],
        ["actualCompletionButtonA", comp.actualCompletionButtonA, null],
        ["actualCompletionButtonB", comp.actualCompletionButtonB, null],
        ["completionButtonVisibleA", comp.completionButtonVisibleA, comp.completionButtonVisibleA],
        ["completionButtonVisibleB", comp.completionButtonVisibleB, comp.completionButtonVisibleB],
        ["completionStatus", comp.completionStatus, null],
        ["roomStatus", comp.roomStatus, null],
        ["jobStatus", comp.jobStatus, null],
        ["dealStatus", comp.dealStatus, null],
        ["builderStatus", comp.builderStatus, null],
      ]) +
      `</section>` +
      `<section class="bench-verdict__section" aria-label="review診断">` +
      `<p class="bench-verdict__section-title">review</p>` +
      kv([
        ["completionApprovedNotifyCreated", review.completionApprovedNotifyCreated, review.completionApprovedNotifyCreated],
        ["completionApprovedNotifyRecipient", review.completionApprovedNotifyRecipient, null],
        ["reviewNotifyCreated", review.reviewNotifyCreated, review.reviewNotifyCreated],
        ["reviewNotifyRecipient", review.reviewNotifyRecipient, null],
        ["reviewNotificationA", review.reviewNotificationA, review.reviewNotificationA],
        ["reviewNotificationB", review.reviewNotificationB, review.reviewNotificationB],
        ["reviewTargetA", review.reviewTargetA, null],
        ["reviewTargetB", review.reviewTargetB, null],
        ["reviewCtaVisibleA", review.reviewCtaVisibleA, review.reviewCtaVisibleA],
        ["reviewCtaVisibleB", review.reviewCtaVisibleB, review.reviewCtaVisibleB],
        ["reviewSubmittedA", review.reviewSubmittedA, null],
        ["reviewSubmittedB", review.reviewSubmittedB, null],
        ["duplicateReviewBlocked", review.duplicateReviewBlocked, null],
      ]) +
      `</section>` +
      extraHtml
    );
  }

  function formatSideDebugHtml(side, title, escapeHtml) {
    const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s ?? "");
    const d = side?.diag || {};
    return (
      `<section class="bench-verdict__section" aria-label="${esc(title)}">` +
      `<p class="bench-verdict__section-title">${esc(title)}</p>` +
      `<ul class="bench-verdict__kv">` +
      `<li><dt>chat URL</dt><dd>${esc(side?.chatHref || "—")}</dd></li>` +
      `<li><dt>isChatDetail</dt><dd>${side?.isChatDetail ? "yes" : "no"}</dd></li>` +
      `<li><dt>currentUserId</dt><dd>${esc(side?.currentUserId || d.currentUserId || "—")}</dd></li>` +
      `<li><dt>actualButton</dt><dd>${esc(side?.actualCompletionButton || "none")}</dd></li>` +
      `<li><dt>buttonVisible</dt><dd>${side?.completionButtonVisible ? "yes" : "no"}</dd></li>` +
      `<li><dt>canRequestEnd</dt><dd>${d.canRequestEnd ? "yes" : "no"}</dd></li>` +
      `<li><dt>requestEndButtonVisible</dt><dd>${d.requestEndButtonVisible ? "yes" : "no"}</dd></li>` +
      `<li><dt>requestButtonVisible</dt><dd>${d.requestButtonVisible ? "yes" : "no"}</dd></li>` +
      `<li><dt>chatJobEndBarExists</dt><dd>${d.chatJobEndBarExists ?? (side?.diagInjected ? "yes" : "no")}</dd></li>` +
      `<li><dt>buttonHiddenReason</dt><dd>${esc(d.buttonHiddenReason || "—")}</dd></li>` +
      `</ul>` +
      `<pre class="bench-verdict__track">${esc(side?.jobEndDebugText || "(DEBUG 未注入)")}</pre>` +
      `</section>`
    );
  }

  function refreshChatFrameDebug() {
    ["frame-a-chat", "frame-b-chat"].forEach((frameId) => {
      try {
        const win = global.document?.getElementById(frameId)?.contentWindow;
        win?.__tasuRefreshJobEndDebug?.();
        win?.TasuChatDetailUi?.refreshBenchJobEndDebug?.();
      } catch {
        /* ignore */
      }
    });
  }

  function analyze(ctx) {
    refreshChatFrameDebug();
    const snapshot = collectSnapshot(ctx);
    const verdict = buildVerdict(snapshot);
    try {
      global.__tasuBenchFlowDiag = {
        snapshot: {
          category: snapshot.category,
          stage: snapshot.stage,
          threadId: snapshot.threadId,
          actorAId: snapshot.actorAId,
          actorBId: snapshot.actorBId,
        },
        verdict,
        stages: verdict.stages,
        at: new Date().toISOString(),
      };
    } catch {
      /* ignore */
    }
    return verdict;
  }

  global.TasuPlatformChatBenchFlowDiag = {
    NG_CODES,
    FIX_MAP,
    NG_PRIORITY,
    STAGE_ORDER,
    VALID_DIAG_FOCUS,
    collectSnapshot,
    buildStageDiagnostics,
    buildStageVerdicts,
    resolvePrimaryFocus,
    buildVerdict,
    analyze,
    analyzeStageVerdicts,
    generateCursorFixInstruction,
    buildCursorTargetOnlyCopyText,
    buildFullStageDiagCopyText,
    BENCH_CONSISTENCY_SECTION_KEYS,
    BENCH_CONSISTENCY_SECTION_NAMES,
    BENCH_NG_SECTION_KEYS,
    buildConsistencySectionCopyText,
    buildAllConsistencySectionCopyTexts,
    buildBenchNgBlockCopyText,
    buildAllNgBlockCopyTexts,
    buildAllNgBlocksBulkCopyText,
    buildBenchNgCopyKey,
    formatBenchNgBlockHtml,
    formatBenchSectionCopyHeader,
    CURSOR_FIX_TEMPLATES,
    NOTIFY_DISPLAY_LOAD_META,
    buildNotifyDisplayLoadDiagnostics,
    buildCompletionReviewNotifyDiagnostics,
    evaluateCompletionReviewNotifyFailures,
    evaluateNotifyDisplayLoadFailures,
    evaluateBenchDisplayFailures,
    evaluatePurchaseRuntimeNotificationFailures,
    evaluateProductShippingNotificationFailures,
    evaluateProductReceiveConfirmUiFailures,
    evaluateProductBankTransferFlowFailures,
    evaluateProductBankTransferReceiveUiFailures,
    evaluateBenchPanelHealthFailures,
    evaluateProductCodFlowFailures,
    isProductOrShopPurchaseEvalContext,
    resolveBenchPurchasePaymentMethod,
    isPurchaseRuntimeNotifyEvalContext,
    BENCH_NOTIFY_CAUSE,
    PRODUCT_SHIPPING_CAUSE,
    PRODUCT_RECEIVE_CAUSE,
    BANK_TRANSFER_CAUSE,
    BANK_TRANSFER_RECEIVE_CAUSE,
    COD_CAUSE,
    evaluateBenchStaleFailures,
    readBenchRunMeta,
    buildBenchRunDiagnostics,
    clearBenchDiagnosticCache,
    formatCompletionReviewNotifyHtml,
    buildCompletionReviewNotifySectionCopyText,
    evaluateDiagDomConsistencyFailures,
    buildDiagDomConsistencyDiagnostics,
    formatNotifyDisplayLoadHtml,
    formatBenchPreviewScrollHtml,
    readBenchPreviewScrollDiag,
    formatDiagDomConsistencyHtml,
    DIAG_DOM_CONSISTENCY_META,
    buildUserIdConsistencyDiagnostics,
    evaluateUserConsistencyFailures,
    formatUserConsistencyHtml,
    formatVerdictHtml,
    formatStagesHtml,
    formatStageVerdictsPanelHtml,
    formatOneStageVerdictHtml,
    formatSideDebugHtml,
    refreshChatFrameDebug,
    evaluateSideButton,
    buttonMatches,
    titleMatches,
  };
})(typeof window !== "undefined" ? window : globalThis);
