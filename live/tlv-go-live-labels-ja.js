/**
 * TLV Go Live Japanese-first UI strings.
 * Reuses TasuShortVideoI18n (tasful.shortVideo.uiLocale). Does not create a TLV-only locale store.
 * Go Live selector is ja-JP + en only. Browser language never auto-switches to English.
 */
(function (global) {
  "use strict";

  var I18n = global.TasuShortVideoI18n || null;
  var PREFIX = "golive.";
  var DEFAULT_LOCALE = "ja-JP";
  var GOLIVE_LOCALES = [
    { code: "ja-JP", label: "日本語" },
    { code: "en", label: "English" },
  ];

  var JA = {
    "golive.pageTitle": "TASFUL TLV | 配信スタジオ",
    "golive.goLiveStudio": "配信スタジオ",
    "golive.goLiveSubtitle": "配信設定を整えて、TASFULの視聴者とリアルタイムでつながります。",
    "golive.scheduleLive": "配信を予約",
    "golive.startLive": "配信開始",
    "golive.startLiveNow": "今すぐ配信開始",
    "golive.endLive": "配信終了",
    "golive.livePreview": "プレビュー",
    "golive.live": "LIVE",
    "golive.stableConnection": "接続良好",
    "golive.reconnecting": "再接続中",
    "golive.connectionWeak": "接続が不安定",
    "golive.streamHealth": "配信状態",
    "golive.streamDetails": "配信詳細",
    "golive.streamTitle": "配信タイトル",
    "golive.description": "説明",
    "golive.category": "カテゴリ",
    "golive.visibility": "公開範囲",
    "golive.thumbnail": "サムネイル",
    "golive.tags": "タグ",
    "golive.streamTimeline": "配信スケジュール",
    "golive.estimatedDuration": "予定時間",
    "golive.scheduledStart": "開始予定",
    "golive.cameraDevice": "カメラ",
    "golive.microphoneDevice": "マイク",
    "golive.audioOutput": "音声出力",
    "golive.cameraFeed": "カメラ",
    "golive.micFeed": "マイク",
    "golive.autoQuality": "自動画質",
    "golive.noiseCancel": "ノイズ抑制",
    "golive.echoCancel": "エコー抑制",
    "golive.scenes": "シーン",
    "golive.audio": "音声",
    "golive.chat": "チャット",
    "golive.liveNav": "配信",
    "golive.watchingN": "視聴中 {n}人",
    "golive.editLayout": "レイアウト編集",
    "golive.editLayoutOn": "レイアウト編集: ON",
    "golive.editLayoutOff": "レイアウト編集: OFF",
    "golive.addSource": "ソース追加",
    "golive.templates": "テンプレート",
    "golive.hide": "非表示",
    "golive.show": "表示",
    "golive.bringForward": "前面へ",
    "golive.sendBackward": "背面へ",
    "golive.reconnectScreen": "画面を再接続",
    "golive.replaceScreen": "画面を差し替え",
    "golive.removeSource": "ソース削除",
    "golive.resetLayout": "レイアウト初期化",
    "golive.camera": "カメラ",
    "golive.screenGame": "画面 / ゲーム",
    "golive.text": "テキスト",
    "golive.image": "画像",
    "golive.logo": "ロゴ",
    "golive.comments": "コメント",
    "golive.navStudio": "スタジオ",
    "golive.navAnalytics": "分析",
    "golive.navAudience": "視聴者",
    "golive.navAssets": "素材",
    "golive.navSettings": "設定",
    "golive.navSupport": "サポート",
    "golive.navLogout": "ログアウト",
    "golive.searchPlaceholder": "スタジオ内を検索",
    "golive.currentLocalTime": "現在時刻",
    "golive.studioReady": "準備完了",
    "golive.localeAria": "UI言語",
    "golive.camUltra": "カメラ",
    "golive.sceneOutputCap": "シーン出力 / 端末上限",
    "golive.previewExpand": "プレビューを拡大",
    "golive.telemetry": "リアルタイム計測",
    "golive.healthExcellent": "良好",
    "golive.aiAssistant": "配信アシスタント",
    "golive.aiRecommend": "おすすめ: カテゴリを「クリエイティブ」にするとリーチが伸びやすいです。",
    "golive.improveTitle": "タイトルを整える",
    "golive.generateDescription": "説明を作る",
    "golive.recommendCategory": "カテゴリ提案",
    "golive.generateTags": "タグを作る",
    "golive.checkQuality": "品質を確認",
    "golive.liveControls": "配信操作",
    "golive.catTechnology": "テクノロジー",
    "golive.catArt": "アート・創作",
    "golive.catGaming": "ゲーム",
    "golive.visPublic": "公開",
    "golive.visFollowers": "フォロワー",
    "golive.visPrivate": "非公開",
    "golive.uploadThumbnail": "サムネイルを追加（1920×1080）",
    "golive.addTag": "+ タグを追加",
    "golive.estimatedReach": "想定リーチ",
    "golive.potentialViewers": "想定視聴者",
    "golive.effects": "エフェクト",
    "golive.effectOff": "エフェクトOFF",
    "golive.beautyCandidates": "Beauty候補",
    "golive.beauty": "カメラ調整",
    "golive.cameraAdjustReset": "リセット",
    "golive.brightness": "明るさ",
    "golive.smoothing": "なめらかさ",
    "golive.skinTone": "色味",
    "golive.intensity": "強さ",
    "golive.vtuber": "VTuber",
    "golive.vtuberOff": "OFF",
    "golive.vtuberBasic": "Basic",
    "golive.userVrm": "自分のVRM",
    "golive.loadPresetVrm": "TLVプリセットVRMを読み込む",
    "golive.licenseAuthorNone": "利用条件 / 作者: —",
    "golive.vroidHub": "VRoid Hub",
    "golive.disconnect": "連携を解除",
    "golive.connectVroidHub": "VRoid Hubと連携",
    "golive.loginToConnect": "TASFULにログインして接続",
    "golive.myModels": "マイモデル",
    "golive.favorites": "お気に入り",
    "golive.trackingOn": "トラッキング ON",
    "golive.trackingOff": "トラッキング OFF",
    "golive.mirrorOn": "ミラー ON",
    "golive.mirrorOff": "ミラー OFF",
    "golive.camPlusAvatar": "カメラ+アバター",
    "golive.avatarOnly": "アバターのみ",
    "golive.cameraOnly": "カメラのみ",
    "golive.qualityNote": "解像度 / FPS / ビットレートは未配線のため操作できません（シーン出力は端末プロファイルで自動制御）。",
    "golive.resolution": "解像度",
    "golive.fps": "FPS",
    "golive.bitrateNotWired": "ビットレート（未配線）",
    "golive.resolutionDisabled": "解像度（未配線）",
    "golive.fpsDisabled": "FPS（未配線）",
    "golive.autoProfile": "自動（プロファイル）",
    "golive.emptyCamera": "カメラなし / 権限待ち",
    "golive.emptyMic": "マイクなし / 権限待ち",
    "golive.emptyOutput": "出力なし",
    "golive.sinkUnsupported": "このブラウザは音声出力の切替に対応していません",
    "golive.previewClickToStart": "タップしてプレビュー開始",
    "golive.statusInit": "デバイスと配信の準備をしています…",
    "golive.statusAuthNeedLogin": "ログインが必要です",
    "golive.statusPermOk": "権限OK。プレビューを準備できます",
    "golive.statusPermDenied": "カメラ / マイクの使用が拒否されました",
    "golive.statusMediaUnsupported": "この環境ではカメラ / マイクを使えません",
    "golive.statusNoCamera": "カメラが見つかりません",
    "golive.statusPreviewReady": "プレビュー準備完了",
    "golive.statusPreviewFail": "プレビューを開始できません",
    "golive.statusCamSwitchFail": "カメラを切り替えられませんでした",
    "golive.statusMicSwitchFail": "マイクを切り替えられませんでした",
    "golive.statusOutSwitchFail": "音声出力を切り替えられませんでした",
    "golive.statusStopping": "配信を終了しています…",
    "golive.statusStopFail": "配信を終了できませんでした",
    "golive.statusStopped": "配信を終了しました。プレビューは続けられます",
    "golive.statusStarting": "配信を開始しています…",
    "golive.statusLiveStarted": "配信を開始しました",
    "golive.statusTitleRequired": "配信タイトルを入力してください",
    "golive.statusTitleTooLong": "タイトルは120文字以内です",
    "golive.statusCancelled": "キャンセルしました",
    "golive.statusVtuberStarting": "VTuber を起動しています…",
    "golive.statusVtuberStopping": "VTuber を停止しています…",
    "golive.statusVtuberOn": "VTuber ON",
    "golive.statusVtuberOff": "VTuber OFF",
    "golive.statusVtuberFail": "VTuber を起動できませんでした",
    "golive.statusVrmLoaded": "VRM を読み込みました",
    "golive.statusVrmFail": "VRM を読み込めませんでした",
    "golive.statusPresetLoaded": "プリセットVRM を読み込みました",
    "golive.statusBeautyOn": "カメラ調整 ON",
    "golive.statusBeautyOff": "カメラ調整 OFF",
    "golive.statusEffectsLocked": "エフェクトは現在利用できません",
    "golive.statusEffectOn": "エフェクト ON",
    "golive.statusEffectsOff": "エフェクト OFF",
    "golive.statusThumbType": "サムネイルは PNG / JPEG / WebP のみです",
    "golive.statusThumbSize": "サムネイルは 5MB 以下にしてください",
    "golive.statusThumbLocal": "サムネイルは端末プレビューのみです",
    "golive.confirmStartLive": "配信を開始しますか？\n\nタイトル: {title}",
    "golive.previewExpandOff": "プレビュー拡大を解除しました",
    "golive.vtuberStatusOff": "OFF",
    "golive.licenseLineEmpty": "利用条件 / 作者: —",
    "golive.licenseBy": "作者 {name}",
    "golive.licenseCommercial": "商用: {value}",
    "golive.licenseIncomplete": "メタデータ不足",
    "golive.licenseNoAutoOk": "商用利用は自動では許可しません",
    "golive.hubNotConfigured": "VRoid Hub はまだ接続できません",
    "golive.hubNeedLogin": "TASFUL にログインすると VRoid Hub と連携できます",
    "golive.hubDisconnected": "未連携",
    "golive.hubConnecting": "連携中…",
    "golive.hubConnected": "連携中",
    "golive.hubConnectedAs": "連携中: {name}",
    "golive.hubLoadingModels": "モデルを読み込み中…",
    "golive.hubError": "モデル一覧を取得できませんでした。自分のVRMは使えます",
    "golive.hubEmpty": "モデルがありません",
    "golive.hubMoving": "VRoid Hub へ移動します…",
    "golive.hubLoginRedirect": "TASFUL ログインへ移動します…",
    "golive.hubFetchingVrm": "VRM を取得中…",
    "golive.hubLoaded": "VRoid Hub のモデルを読み込みました",
    "golive.hubLicenseBlocked": "このモデルの利用条件では配信できません",
    "golive.hubConfirmLicense": "作者の利用条件を確認し、このモデルを TLV LIVE で使いますか？ TASFUL は条件を上書きしません。",
    "golive.hubConfirmStart": "最新の作者利用条件を確認し、このモデルで配信を開始しますか？ TASFUL は条件を上書きしません。",
    "golive.hubUse": "使う",
    "golive.hubUseConfirm": "条件を確認して使う",
    "golive.hubStateDisconnected": "未連携",
    "golive.hubStateConnected": "連携中",
    "golive.hubStateConnecting": "連携中…",
    "golive.hubStateError": "エラー",
    "golive.hubStateEmpty": "なし",
    "golive.hubStateLoading": "読み込み中",
    "golive.hubStateReady": "準備完了",
    "golive.licenseUnknown": "利用条件: 不明",
    "golive.licenseAvatar": "アバター",
    "golive.licensePersonal": "個人商用",
    "golive.licenseCorporate": "法人商用",
    "golive.licenseCredit": "クレジット",
    "golive.licenseMod": "改変",
    "golive.licenseRedistrib": "再配布",
    "golive.eligEligible": "利用可能",
    "golive.eligConfirm": "要確認",
    "golive.eligIneligible": "利用不可",
    "golive.eligUnknown": "不明（自動では許可しません）",
    "golive.code.permission": "配信の権限がありません",
    "golive.code.auth": "ログインが必要です",
    "golive.code.cancelled": "キャンセルしました",
    "golive.code.validation": "入力内容を確認してください",
    "golive.code.publish_input": "配信映像の準備ができていません",
    "golive.code.no_media": "カメラの準備ができていません",
    "golive.code.livekit_exception": "配信を開始できませんでした",
    "golive.code.livekit_failed": "配信を開始できませんでした",
    "golive.code.BLOCKED_LIVEKIT_CREDENTIALS": "配信サーバーの準備ができていません",
    "golive.code.LICENSE_INELIGIBLE": "このモデルの利用条件では配信できません",
    "golive.code.LICENSE_UNKNOWN": "利用条件を確認できません",
    "golive.code.LICENSE_CONFIRMATION_REQUIRED": "利用条件の確認が必要です",
    "golive.code.UNKNOWN_FAIL_CLOSED": "利用条件を確認できません",
    "golive.code.media": "プレビュー（カメラ / マイク）の準備ができていません",
    "golive.code.no_config": "配信の準備ができていません",
    "golive.code.no_create_api": "配信の準備ができていません",
    "golive.code.no_bridge": "配信の準備ができていません",
    "golive.code.no_broadcast": "配信レコードがありません",
    "golive.code.exception": "処理に失敗しました",
    "golive.code.NETWORK_ERROR": "通信に失敗しました",
    "golive.code.runtime_missing": "モデルを読み込めませんでした",
    "golive.code.VRM_LOAD_FAILURE": "VRM を読み込めませんでした",
    "golive.code.VRM_DOWNLOAD_FAILED": "モデルを取得できませんでした",
    "golive.code.unknown": "処理に失敗しました",
  };

  var EN = {
    "golive.pageTitle": "TASFUL TLV | Go Live Studio",
    "golive.goLiveStudio": "Go Live Studio",
    "golive.goLiveSubtitle": "Set up your stream and connect with TASFUL viewers in real time.",
    "golive.scheduleLive": "Schedule Live",
    "golive.startLive": "Start Live",
    "golive.startLiveNow": "Start Live Now",
    "golive.endLive": "End Live",
    "golive.livePreview": "Preview",
    "golive.live": "LIVE",
    "golive.stableConnection": "Stable connection",
    "golive.reconnecting": "Reconnecting",
    "golive.connectionWeak": "Unstable connection",
    "golive.streamHealth": "Stream health",
    "golive.streamDetails": "Stream details",
    "golive.streamTitle": "Stream title",
    "golive.description": "Description",
    "golive.category": "Category",
    "golive.visibility": "Visibility",
    "golive.thumbnail": "Thumbnail",
    "golive.tags": "Tags",
    "golive.streamTimeline": "Stream timeline",
    "golive.estimatedDuration": "Estimated duration",
    "golive.scheduledStart": "Scheduled start",
    "golive.cameraDevice": "Camera",
    "golive.microphoneDevice": "Microphone",
    "golive.audioOutput": "Audio output",
    "golive.cameraFeed": "Camera",
    "golive.micFeed": "Microphone",
    "golive.autoQuality": "Auto quality",
    "golive.noiseCancel": "Noise cancel",
    "golive.echoCancel": "Echo cancel",
    "golive.scenes": "Scenes",
    "golive.audio": "Audio",
    "golive.chat": "Chat",
    "golive.liveNav": "Live",
    "golive.watchingN": "Watching {n}",
    "golive.editLayout": "Edit layout",
    "golive.editLayoutOn": "Edit layout: ON",
    "golive.editLayoutOff": "Edit layout: OFF",
    "golive.addSource": "Add source",
    "golive.templates": "Templates",
    "golive.hide": "Hide",
    "golive.show": "Show",
    "golive.bringForward": "Bring forward",
    "golive.sendBackward": "Send backward",
    "golive.reconnectScreen": "Reconnect screen",
    "golive.replaceScreen": "Replace screen",
    "golive.removeSource": "Remove source",
    "golive.resetLayout": "Reset layout",
    "golive.camera": "Camera",
    "golive.screenGame": "Screen / Game",
    "golive.text": "Text",
    "golive.image": "Image",
    "golive.logo": "Logo",
    "golive.comments": "Comments",
    "golive.navStudio": "Studio",
    "golive.navAnalytics": "Analytics",
    "golive.navAudience": "Audience",
    "golive.navAssets": "Assets",
    "golive.navSettings": "Settings",
    "golive.navSupport": "Support",
    "golive.navLogout": "Logout",
    "golive.searchPlaceholder": "Search Studio",
    "golive.currentLocalTime": "Local time",
    "golive.studioReady": "Studio ready",
    "golive.localeAria": "UI language",
    "golive.camUltra": "Camera",
    "golive.sceneOutputCap": "Scene output / device cap",
    "golive.previewExpand": "Expand preview",
    "golive.telemetry": "Real-time telemetry",
    "golive.healthExcellent": "Excellent",
    "golive.aiAssistant": "Stream assistant",
    "golive.aiRecommend": "Tip: Creative category often reaches more viewers.",
    "golive.improveTitle": "Improve title",
    "golive.generateDescription": "Generate description",
    "golive.recommendCategory": "Recommend category",
    "golive.generateTags": "Generate tags",
    "golive.checkQuality": "Check quality",
    "golive.liveControls": "Live controls",
    "golive.catTechnology": "Technology",
    "golive.catArt": "Art & Creative",
    "golive.catGaming": "Gaming",
    "golive.visPublic": "Public",
    "golive.visFollowers": "Followers",
    "golive.visPrivate": "Private",
    "golive.uploadThumbnail": "Upload thumbnail (1920×1080)",
    "golive.addTag": "+ Add tag",
    "golive.estimatedReach": "Estimated reach",
    "golive.potentialViewers": "Potential viewers",
    "golive.effects": "Effects",
    "golive.effectOff": "Effect OFF",
    "golive.beautyCandidates": "Beauty candidates",
    "golive.beauty": "Camera Adjust",
    "golive.cameraAdjustReset": "Reset",
    "golive.brightness": "Brightness",
    "golive.smoothing": "Smoothing",
    "golive.skinTone": "Skin tone",
    "golive.intensity": "Intensity",
    "golive.vtuber": "VTuber",
    "golive.vtuberOff": "OFF",
    "golive.vtuberBasic": "Basic",
    "golive.userVrm": "My VRM",
    "golive.loadPresetVrm": "Load TLV preset VRM",
    "golive.licenseAuthorNone": "License / author: —",
    "golive.vroidHub": "VRoid Hub",
    "golive.disconnect": "Disconnect",
    "golive.connectVroidHub": "Connect VRoid Hub",
    "golive.loginToConnect": "Sign in to TASFUL to connect",
    "golive.myModels": "My Models",
    "golive.favorites": "Favorites",
    "golive.trackingOn": "Tracking ON",
    "golive.trackingOff": "Tracking OFF",
    "golive.mirrorOn": "Mirror ON",
    "golive.mirrorOff": "Mirror OFF",
    "golive.camPlusAvatar": "Cam + Avatar",
    "golive.avatarOnly": "Avatar only",
    "golive.cameraOnly": "Camera only",
    "golive.qualityNote": "Resolution / FPS / bitrate controls are not wired (scene output follows the device profile).",
    "golive.resolution": "Resolution",
    "golive.fps": "FPS",
    "golive.bitrateNotWired": "Bitrate (not wired)",
    "golive.resolutionDisabled": "Resolution (not wired)",
    "golive.fpsDisabled": "FPS (not wired)",
    "golive.autoProfile": "Auto (profile)",
    "golive.emptyCamera": "No camera / waiting for permission",
    "golive.emptyMic": "No microphone / waiting for permission",
    "golive.emptyOutput": "No output",
    "golive.sinkUnsupported": "This browser cannot switch audio output",
    "golive.previewClickToStart": "Tap to start preview",
    "golive.statusInit": "Preparing devices and live APIs…",
    "golive.statusAuthNeedLogin": "Sign in required",
    "golive.statusPermOk": "Permission OK. Preview is ready",
    "golive.statusPermDenied": "Camera / microphone permission was denied",
    "golive.statusMediaUnsupported": "Camera / microphone is not supported here",
    "golive.statusNoCamera": "No camera found",
    "golive.statusPreviewReady": "Preview ready",
    "golive.statusPreviewFail": "Could not start preview",
    "golive.statusCamSwitchFail": "Could not switch camera",
    "golive.statusMicSwitchFail": "Could not switch microphone",
    "golive.statusOutSwitchFail": "Could not switch audio output",
    "golive.statusStopping": "Ending live…",
    "golive.statusStopFail": "Could not end live",
    "golive.statusStopped": "Live ended. Preview can continue",
    "golive.statusStarting": "Starting live…",
    "golive.statusLiveStarted": "Live started",
    "golive.statusTitleRequired": "Enter a stream title",
    "golive.statusTitleTooLong": "Title must be 120 characters or fewer",
    "golive.statusCancelled": "Cancelled",
    "golive.statusVtuberStarting": "Starting VTuber…",
    "golive.statusVtuberStopping": "Stopping VTuber…",
    "golive.statusVtuberOn": "VTuber ON",
    "golive.statusVtuberOff": "VTuber OFF",
    "golive.statusVtuberFail": "Could not start VTuber",
    "golive.statusVrmLoaded": "VRM loaded",
    "golive.statusVrmFail": "Could not load VRM",
    "golive.statusPresetLoaded": "Preset VRM loaded",
    "golive.statusBeautyOn": "Camera Adjust ON",
    "golive.statusBeautyOff": "Camera Adjust OFF",
    "golive.statusEffectsLocked": "Effects are not available yet",
    "golive.statusEffectOn": "Effect ON",
    "golive.statusEffectsOff": "Effects OFF",
    "golive.statusThumbType": "Thumbnail must be PNG / JPEG / WebP",
    "golive.statusThumbSize": "Thumbnail must be 5MB or smaller",
    "golive.statusThumbLocal": "Thumbnail is local preview only",
    "golive.confirmStartLive": "Start live?\n\nTitle: {title}",
    "golive.previewExpandOff": "Preview expand off",
    "golive.vtuberStatusOff": "OFF",
    "golive.licenseLineEmpty": "License / author: —",
    "golive.licenseBy": "by {name}",
    "golive.licenseCommercial": "commercial: {value}",
    "golive.licenseIncomplete": "metadata incomplete",
    "golive.licenseNoAutoOk": "no automatic commercial OK",
    "golive.hubNotConfigured": "VRoid Hub is not available yet",
    "golive.hubNeedLogin": "Sign in to TASFUL to connect VRoid Hub",
    "golive.hubDisconnected": "Not connected",
    "golive.hubConnecting": "Connecting…",
    "golive.hubConnected": "Connected",
    "golive.hubConnectedAs": "Connected: {name}",
    "golive.hubLoadingModels": "Loading models…",
    "golive.hubError": "Could not load models. Your own VRM still works",
    "golive.hubEmpty": "No models",
    "golive.hubMoving": "Opening VRoid Hub…",
    "golive.hubLoginRedirect": "Opening TASFUL sign-in…",
    "golive.hubFetchingVrm": "Fetching VRM…",
    "golive.hubLoaded": "VRoid Hub model loaded",
    "golive.hubLicenseBlocked": "This model's license cannot be used for live",
    "golive.hubConfirmLicense": "Confirm the author's terms and use this model on TLV LIVE? TASFUL does not override the terms.",
    "golive.hubConfirmStart": "Confirm the latest author terms and start live with this model? TASFUL does not override the terms.",
    "golive.hubUse": "Use",
    "golive.hubUseConfirm": "Confirm and use",
    "golive.hubStateDisconnected": "Not connected",
    "golive.hubStateConnected": "Connected",
    "golive.hubStateConnecting": "Connecting…",
    "golive.hubStateError": "Error",
    "golive.hubStateEmpty": "Empty",
    "golive.hubStateLoading": "Loading",
    "golive.hubStateReady": "Ready",
    "golive.licenseUnknown": "License: unknown",
    "golive.licenseAvatar": "Avatar",
    "golive.licensePersonal": "Personal commercial",
    "golive.licenseCorporate": "Corporate commercial",
    "golive.licenseCredit": "Credit",
    "golive.licenseMod": "Modification",
    "golive.licenseRedistrib": "Redistribution",
    "golive.eligEligible": "Eligible",
    "golive.eligConfirm": "Needs confirmation",
    "golive.eligIneligible": "Not eligible",
    "golive.eligUnknown": "Unknown (not auto-allowed)",
    "golive.code.permission": "You don't have permission to go live",
    "golive.code.auth": "Sign in required",
    "golive.code.cancelled": "Cancelled",
    "golive.code.validation": "Check the form and try again",
    "golive.code.publish_input": "Live video is not ready",
    "golive.code.no_media": "Camera is not ready",
    "golive.code.livekit_exception": "Could not start live",
    "golive.code.livekit_failed": "Could not start live",
    "golive.code.BLOCKED_LIVEKIT_CREDENTIALS": "The live server is not ready",
    "golive.code.LICENSE_INELIGIBLE": "This model's license cannot be used for live",
    "golive.code.LICENSE_UNKNOWN": "Could not verify the license",
    "golive.code.LICENSE_CONFIRMATION_REQUIRED": "License confirmation is required",
    "golive.code.UNKNOWN_FAIL_CLOSED": "Could not verify the license",
    "golive.code.media": "Preview (camera / microphone) is not ready",
    "golive.code.no_config": "Live is not ready",
    "golive.code.no_create_api": "Live is not ready",
    "golive.code.no_bridge": "Live is not ready",
    "golive.code.no_broadcast": "No live record",
    "golive.code.exception": "Something went wrong",
    "golive.code.NETWORK_ERROR": "Network error",
    "golive.code.runtime_missing": "Could not load the model",
    "golive.code.VRM_LOAD_FAILURE": "Could not load VRM",
    "golive.code.VRM_DOWNLOAD_FAILED": "Could not fetch the model",
    "golive.code.unknown": "Something went wrong",
  };

  var LABELS = {};
  Object.keys(JA).forEach(function (full) {
    if (full.indexOf(PREFIX) === 0) LABELS[full.slice(PREFIX.length)] = JA[full];
  });

  if (I18n && typeof I18n.registerDict === "function") {
    I18n.registerDict("ja-JP", JA);
    I18n.registerDict("en", EN);
  }

  function interpolate(s, vars) {
    if (s == null) return s;
    if (!vars || typeof vars !== "object") return String(s);
    Object.keys(vars).forEach(function (k) {
      s = String(s).split("{" + k + "}").join(String(vars[k]));
    });
    return String(s);
  }

  function dictFor(loc) {
    return loc === "en" ? EN : JA;
  }

  /**
   * Display locale for Go Live.
   * Stored ja-JP / en → use it.
   * Stored ko-KR / zh-TW (shared TASFUL key) → display ja-JP without overwriting storage.
   * Missing storage → Japanese default. Do not auto-detect from the browser.
   */
  function getDisplayLocale() {
    var stored = "";
    try {
      stored = I18n && typeof I18n.getStoredLocale === "function" ? I18n.getStoredLocale() : DEFAULT_LOCALE;
    } catch (_) {
      stored = DEFAULT_LOCALE;
    }
    if (stored === "en") return "en";
    return DEFAULT_LOCALE;
  }

  function fullKey(key) {
    var k = String(key || "");
    if (k.indexOf(PREFIX) === 0) return k;
    if (k.indexOf("code.") === 0) return PREFIX + k;
    return PREFIX + k;
  }

  function lookup(key, loc) {
    var fk = fullKey(key);
    var dict = dictFor(loc);
    if (dict[fk] != null) return dict[fk];
    if (I18n && typeof I18n.t === "function") {
      var fromEngine = I18n.t(fk, loc);
      if (fromEngine && fromEngine !== fk) return fromEngine;
    }
    if (JA[fk] != null) return JA[fk];
    var short = fk.slice(PREFIX.length);
    if (LABELS[short] != null) return LABELS[short];
    return null;
  }

  function t(key, vars) {
    var s = lookup(key, getDisplayLocale());
    if (s == null) return key;
    return interpolate(s, vars);
  }

  function looksTechnical(s) {
    var raw = String(s || "");
    if (!raw) return false;
    return /UNKNOWN_FAIL_CLOSED|BLOCKED_LIVEKIT|LICENSE_INELIGIBLE|REQUIRES_HIGHER_EDITION|MATERIAL_REQUIRED|NETWORK_ERROR|livekit_exception|publish_input|Formal Publish/i.test(
      raw
    );
  }

  function userMessage(code, fallback) {
    var mapped = lookup("code." + String(code || ""), getDisplayLocale());
    if (mapped) return mapped;
    if (fallback && !looksTechnical(fallback)) return String(fallback);
    return t("code.unknown");
  }

  function fillLocaleSelect(sel) {
    if (!sel) return;
    sel.innerHTML = "";
    GOLIVE_LOCALES.forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = item.code;
      opt.textContent = item.label;
      sel.appendChild(opt);
    });
  }

  function applyAria(root, loc) {
    root = root || document;
    root.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      if (!key) return;
      var s = lookup(key, loc);
      if (s) el.setAttribute("aria-label", interpolate(s));
    });
  }

  function applyStaticDom(root) {
    root = root || document;
    var loc = getDisplayLocale();
    if (I18n && typeof I18n.apply === "function" && root.querySelectorAll) {
      try {
        I18n.apply(root, loc);
      } catch (_) {}
    }
    applyAria(root, loc);
    try {
      if (root.querySelector) {
        var titleEl = root.querySelector("title");
        if (titleEl) titleEl.textContent = t("pageTitle");
      }
      if (root === document || root.documentElement) {
        document.documentElement.lang = loc === "en" ? "en" : "ja";
        document.documentElement.setAttribute("data-ui-locale", loc);
        document.title = t("pageTitle");
      }
    } catch (_) {}
    var sel = (root.querySelector && root.querySelector("[data-sv-ui-locale]")) || document.querySelector("[data-sv-ui-locale]");
    if (sel) {
      sel.value = loc;
      sel.setAttribute("aria-label", t("localeAria"));
    }
    return loc;
  }

  function applyLocale(requested, persist) {
    var next = requested === "en" ? "en" : DEFAULT_LOCALE;
    if (persist !== false && I18n && typeof I18n.setStoredLocale === "function") {
      I18n.setStoredLocale(next);
    }
    applyStaticDom(document);
    try {
      document.dispatchEvent(new CustomEvent("tasful:ui-locale-change", { detail: { locale: next, surface: "golive" } }));
    } catch (_) {}
    return next;
  }

  var selectorWired = false;
  function initLocaleSelector() {
    var sel = document.querySelector("[data-sv-ui-locale]");
    fillLocaleSelect(sel);
    applyStaticDom(document);
    if (sel && !selectorWired) {
      selectorWired = true;
      sel.addEventListener("change", function () {
        applyLocale(sel.value, true);
      });
    }
  }

  function boot() {
    initLocaleSelector();
  }

  global.TasuTlvGoLiveLabelsJa = {
    LABELS: LABELS,
    JA: JA,
    EN: EN,
    GOLIVE_LOCALES: GOLIVE_LOCALES,
    DEFAULT_LOCALE: DEFAULT_LOCALE,
    STORAGE_KEY: (I18n && I18n.STORAGE_KEY) || "tasful.shortVideo.uiLocale",
    t: t,
    userMessage: userMessage,
    getDisplayLocale: getDisplayLocale,
    applyStaticDom: applyStaticDom,
    applyLocale: applyLocale,
    initLocaleSelector: initLocaleSelector,
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
