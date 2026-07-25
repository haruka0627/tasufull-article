/** 追加トピック — 網羅性優先（後から整理・統合・削除可） */

/** @type {import('./platform-qa-catalog-topics.mjs').QaTopicSpec[]} */
export const QA_EXTENDED_TOPIC_SPECS = [
  // Platform 深掘り
  { key: "email-change", category: "account", service: "platform", persona: "intermediate", title: "メールアドレス変更", summary: "登録メールアドレスを変更できます。", questions: ["メールアドレスを変えたい", "登録メールの変更", "メール変更の手順", "連絡先メール更新", "email change"], keywords: ["メール変更", "email", "アドレス変更"], relatedSlugs: ["profile-edit", "email-verify"] },
  { key: "phone-verify", category: "account", service: "platform", persona: "intermediate", title: "電話番号認証", summary: "SMS認証で本人確認を行う場合があります。", questions: ["電話番号認証", "SMS認証", "携帯番号登録", "電話確認", "phone verify"], keywords: ["電話", "SMS", "認証", "phone"], relatedSlugs: ["signup", "security"] },
  { key: "dashboard-use", category: "platform", service: "platform", persona: "beginner", title: "ダッシュボードの見方", summary: "マイページ・ダッシュボードから各種操作ができます。", questions: ["ダッシュボードとは", "マイページの使い方", "管理画面の見方", "dashboard", "ホーム画面の説明"], keywords: ["ダッシュボード", "マイページ", "dashboard"], relatedSlugs: ["beginner", "profile-edit"] },
  { key: "market-browse", category: "search", service: "platform", persona: "beginner", title: "マーケット閲覧", summary: "掲載一覧からサービスを探せます。", questions: ["マーケットの見方", "一覧から探す", "カテゴリ一覧", "market browse", "掲載を眺める"], keywords: ["マーケット", "一覧", "market", "閲覧"], relatedSlugs: ["beginner", "search-filter"] },
  { key: "shop-store", category: "listing", service: "platform", persona: "vendor", title: "店舗・販売掲載", summary: "店舗・販売向けの掲載が可能です。", questions: ["店舗掲載", "店舗登録", "shop store", "実店舗を載せる", "小売の掲載"], keywords: ["店舗", "販売", "shop", "store"], relatedSlugs: ["business-listing", "listing-request"] },
  { key: "worker-profile", category: "listing", service: "platform", persona: "worker", title: "ワーカープロフィール", summary: "ワーカーとしてプロフィールを公開できます。", questions: ["ワーカー登録", "ワーカープロフィール", "仕事を受けたい", "worker profile", "スキルワーカー"], keywords: ["ワーカー", "worker", "フリーランス"], relatedSlugs: ["skill-listing", "apply"] },
  { key: "escrow-payment", category: "trading", service: "platform", persona: "intermediate", title: "エスクロー・安心決済", summary: "プラットフォーム経由の決済で記録を残せます。", questions: ["エスクローとは", "安心決済", "支払いの保留", "escrow", "中間決済"], keywords: ["エスクロー", "決済", "escrow", "安心"], relatedSlugs: ["direct-trading", "payment-method"] },
  { key: "cancel-order", category: "apply", service: "platform", persona: "individual", title: "キャンセル・辞退", summary: "応募や依頼のキャンセル手順を確認してください。", questions: ["応募をキャンセル", "依頼を取り消す", "キャンセル料", "辞退の方法", "cancel"], keywords: ["キャンセル", "辞退", "cancel", "取り消し"], relatedSlugs: ["apply", "trouble-support"] },
  { key: "refund-policy", category: "pricing", service: "platform", persona: "individual", title: "返金・払い戻し", summary: "返金ポリシーは案件・プランにより異なります。", questions: ["返金してもらえる？", "払い戻し", "refund", "返金申請", "キャンセル返金"], keywords: ["返金", "払い戻し", "refund"], relatedSlugs: ["pricing", "trouble-support"] },
  { key: "seller-rank", category: "platform", service: "platform", persona: "vendor", title: "出品者ランク", summary: "実績に応じたランク表示があります。", questions: ["出品者ランク", "信頼スコア", "ランクの上げ方", "seller rank", "評価ランク"], keywords: ["ランク", "信頼", "rank", "スコア"], relatedSlugs: ["review-rating", "listing-request"] },
  { key: "featured-listing", category: "listing", service: "platform", persona: "vendor", title: "PR・上位掲載", summary: "PR掲載オプションで露出を高められます。", questions: ["PR掲載", "上位表示", "featured", "広告掲載", "露出を増やす"], keywords: ["PR", "上位掲載", "featured", "広告"], relatedSlugs: ["pricing", "listing-request"] },
  { key: "business-directory", category: "listing", service: "platform", persona: "business", title: "ビジネスディレクトリ", summary: "事業者情報をディレクトリ形式で掲載できます。", questions: ["ビジネスディレクトリ", "業者名鑑", "business directory", "事業者検索", "B2Bディレクトリ"], keywords: ["ディレクトリ", "directory", "事業者名鑑"], relatedSlugs: ["business-directory-beginner", "business-directory-q2"] },
  { key: "anpi-platform", category: "trouble", service: "platform", persona: "business", title: "安否・緊急連絡", summary: "緊急時の連絡手段をご確認ください。", questions: ["安否確認", "緊急連絡", "災害時", "ANPI", "緊急時の使い方"], keywords: ["安否", "緊急", "ANPI", "災害"], relatedSlugs: ["talk-anpi", "trouble-support"] },

  // TASFUL AI 拡張
  { key: "ai-chat-history", category: "ai", service: "tasful-ai", persona: "ai-user", title: "AI会話履歴", summary: "過去のAI相談履歴を確認できます。", questions: ["会話履歴", "チャット履歴の削除", "過去の質問を見る", "history", "履歴の保存期間"], keywords: ["履歴", "history", "会話", "チャット"], relatedSlugs: ["ai-workspace-start", "ai-privacy"] },
  { key: "ai-export", category: "ai", service: "tasful-ai", persona: "advanced", title: "AI回答のエクスポート", summary: "回答内容をコピー・保存できます。", questions: ["回答をコピー", "エクスポート", "保存する", "export", "テキスト出力"], keywords: ["エクスポート", "コピー", "export"], relatedSlugs: ["ai-workspace-start"] },
  { key: "ai-web-search", category: "ai", service: "tasful-ai", persona: "ai-user", title: "AI Web検索", summary: "Web検索を組み合わせた回答がある場合があります。", questions: ["Web検索", "ネット検索", "web search", "最新情報", "外部検索"], keywords: ["Web検索", "web search", "ネット"], relatedSlugs: ["ai-search-mode", "ai-workspace-start"] },
  { key: "ai-billing", category: "ai", service: "tasful-ai", persona: "intermediate", title: "AI課金・クレジット", summary: "AI利用量に応じた課金があります。", questions: ["AIクレジット", "AI課金", "従量課金", "ai billing", "トークン消費"], keywords: ["クレジット", "課金", "billing", "トークン"], relatedSlugs: ["ai-usage-limit", "ai-pro-plan"] },
  { key: "ai-settings", category: "ai", service: "tasful-ai", persona: "intermediate", title: "AI設定", summary: "Workspace設定から挙動を調整できます。", questions: ["AI設定", "設定画面", "preferences", "カスタマイズ", "デフォルトモデル"], keywords: ["設定", "settings", "preferences"], relatedSlugs: ["ai-model-select", "ai-workspace-start"] },
  { key: "ai-error", category: "ai", service: "tasful-ai", persona: "beginner", title: "AIエラー・障害", summary: "エラー時は時間をおいて再試行してください。", questions: ["AIが動かない", "エラーが出る", "応答がない", "ai error", "503エラー"], keywords: ["エラー", "障害", "error", "動かない"], relatedSlugs: ["trouble-support", "ai-usage-limit"] },
  { key: "ai-qa-search", category: "ai", service: "tasful-ai", persona: "ai-user", title: "AIのQ&A検索", summary: "AIはQ&Aデータを検索して表示します。", questions: ["AIはQ&Aを検索？", "ヘルプが出る条件", "QA検索", "SSOT", "AI回答の出所"], keywords: ["Q&A検索", "SSOT", "ヘルプ検索"], relatedSlugs: ["ai-qa-hit", "faq"] },

  // TLV 拡張
  { key: "tlv-follow", category: "tlv", service: "tlv", persona: "viewer", title: "フォロー・通知", summary: "配信者をフォローして通知を受け取れます。", questions: ["フォローする", "配信通知", "follow", "お気に入り配信者", "フォロー解除"], keywords: ["フォロー", "follow", "通知"], relatedSlugs: ["tlv-watch", "notification-settings"] },
  { key: "tlv-quality", category: "tlv", service: "tlv", persona: "viewer", title: "画質・再生品質", summary: "回線状況に応じて画質が調整されます。", questions: ["画質を上げたい", "カクつく", "buffering", "HD視聴", "画質設定"], keywords: ["画質", "品質", "HD", "buffering"], relatedSlugs: ["tlv-watch"] },
  { key: "tlv-schedule", category: "tlv", service: "tlv", persona: "streamer", title: "配信予定・スケジュール", summary: "配信予定を告知できます。", questions: ["配信予定", "スケジュール", "schedule", "配信告知", "次回配信"], keywords: ["予定", "スケジュール", "schedule"], relatedSlugs: ["tlv-stream"] },
  { key: "tlv-moderator", category: "tlv", service: "tlv", persona: "streamer", title: "モデレーター", summary: "配信のモデレーター機能があります。", questions: ["モデレーター", "moderator", "コメント管理", "BAN", "配信モデ"], keywords: ["モデレーター", "moderator", "モデ"], relatedSlugs: ["tlv-chat", "tlv-rules"] },
  { key: "tlv-cohost", category: "tlv", service: "tlv", persona: "streamer", title: "コラボ配信", summary: "複数人での配信が可能な場合があります。", questions: ["コラボ配信", "ゲスト招待", "cohost", "対談配信", "二人配信"], keywords: ["コラボ", "cohost", "ゲスト"], relatedSlugs: ["tlv-stream"] },

  // Talk 拡張
  { key: "talk-push", category: "talk", service: "talk", persona: "intermediate", title: "プッシュ通知", summary: "ブラウザプッシュで通知を受け取れます。", questions: ["プッシュ通知", "web push", "通知が来ない", "プッシュ許可", "push設定"], keywords: ["プッシュ", "push", "通知"], relatedSlugs: ["talk-notification", "notification-settings"] },
  { key: "talk-group", category: "talk", service: "talk", persona: "business", title: "グループ・チーム", summary: "チーム単位でTalkルームを運用できます。", questions: ["グループ作成", "チームトーク", "group chat", "メンバー招待", "チーム管理"], keywords: ["グループ", "チーム", "group"], relatedSlugs: ["talk-room", "talk-enterprise"] },
  { key: "talk-read-receipt", category: "talk", service: "talk", persona: "intermediate", title: "既読・未読", summary: "メッセージの既読状態を確認できます。", questions: ["既読", "未読", "read receipt", "既読がつかない", "既読確認"], keywords: ["既読", "未読", "read"], relatedSlugs: ["talk-room", "message-chat"] },
  { key: "talk-search", category: "talk", service: "talk", persona: "intermediate", title: "Talk内検索", summary: "過去メッセージを検索できます。", questions: ["メッセージ検索", "トーク検索", "search messages", "過去ログ", "キーワード検索"], keywords: ["検索", "search", "ログ"], relatedSlugs: ["talk-room"] },

  // Material 拡張
  { key: "material-format", category: "material", service: "material", persona: "creator", title: "対応ファイル形式", summary: "画像・動画等の形式制限があります。", questions: ["対応形式", "ファイル形式", "PNG JPEG", "format", "容量制限"], keywords: ["形式", "format", "ファイル", "容量"], relatedSlugs: ["material-upload"] },
  { key: "material-collection", category: "material", service: "material", persona: "material-user", title: "コレクション", summary: "素材をコレクションにまとめられます。", questions: ["コレクション", "フォルダ", "collection", "素材整理", "お気に入り素材"], keywords: ["コレクション", "collection", "フォルダ"], relatedSlugs: ["material-search", "favorites"] },
  { key: "material-report", category: "material", service: "material", persona: "material-user", title: "素材の通報", summary: "不適切な素材は通報できます。", questions: ["素材を通報", "著作権侵害", "report material", "違反素材"], keywords: ["通報", "著作権", "report"], relatedSlugs: ["report-user", "material-license"] },

  // セキュリティ・法務
  { key: "account-hack", category: "security", service: "platform", persona: "intermediate", title: "乗っ取り・不正ログイン", summary: "不審なログインはすぐにパスワード変更してください。", questions: ["乗っ取られた", "不正ログイン", "ハッキング", "account hack", "身に覚えのないログイン"], keywords: ["乗っ取り", "不正", "hack", "セキュリティ"], relatedSlugs: ["password-reset", "two-factor"] },
  { key: "spam-report", category: "security", service: "platform", persona: "beginner", title: "スパム・迷惑", summary: "スパム行為は通報・ブロックできます。", questions: ["スパム", "迷惑メッセージ", "spam", "業者スパム", "勧誘"], keywords: ["スパム", "spam", "迷惑"], relatedSlugs: ["report-user", "talk-block"] },
  { key: "gdpr-export", category: "legal", service: "platform", persona: "advanced", title: "データポータビリティ", summary: "個人データの開示・削除請求について。", questions: ["GDPR", "データ開示", "個人データ請求", "data portability", "削除請求"], keywords: ["GDPR", "データ", "開示", "ポータビリティ"], relatedSlugs: ["data-export", "privacy-policy"] },
  { key: "commercial-use", category: "legal", service: "platform", persona: "business", title: "商用利用", summary: "商用利用の可否は各掲載・素材の条件によります。", questions: ["商用利用", "business use", "法人利用", "商用OK？", "事業利用"], keywords: ["商用", "business", "法人"], relatedSlugs: ["terms-of-service", "material-license"] },
  { key: "copyright", category: "legal", service: "platform", persona: "creator", title: "著作権・知的財産", summary: "掲載コンテンツの権利は投稿者に帰属します。", questions: ["著作権", "copyright", "知的財産", "コンテンツ権利", "無断転載"], keywords: ["著作権", "copyright", "IP"], relatedSlugs: ["terms-of-service", "material-license"] },
];

/** 質問の言い換えテンプレ（各トピックの質問に追加生成） */
export const QA_QUESTION_REPHRASES = [
  (q) => `${q.replace(/[？?]$/, "")}を教えてください`,
  (q) => `${q.replace(/[？?]$/, "")}について知りたい`,
  (q) => `【初心者】${q}`,
  (q) => `【法人】${q}`,
  (q) => `【詳しく】${q}`,
  (q) => `English: ${q}`,
];
