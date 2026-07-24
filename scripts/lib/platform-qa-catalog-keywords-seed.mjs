/**
 * Search keywords — Q&A本体とは分離管理（slug 単位）
 * 後から追加・削除・統合しやすいよう、記事データとは別ファイルで出力する
 */
export const QA_KEYWORDS_BY_SLUG = {
  signup: {
    keywords: ["会員登録", "新規登録", "アカウント作成", "signup", "登録方法", "無料登録", "ユーザー登録"],
    aliases: ["会員登録のやり方", "アカウントを作る", "新規アカウント", "サインアップ"],
    synonyms: ["sign up", "register", "初回登録", "アカウント開設"],
  },
  "account-delete": {
    keywords: ["退会", "解約", "アカウント削除", "削除", "アカウント停止", "close account", "退会手続き"],
    aliases: ["会員退会", "アカウントを消す", "利用停止", "アカウント解約"],
    synonyms: ["delete account", "cancel membership", "アカウント退会", "解約方法"],
  },
  "password-reset": {
    keywords: ["パスワード", "再設定", "忘れた", "リセット", "password reset", "ログインできない"],
    aliases: ["パスワード変更", "PW忘れ", "パスワード再発行", "パスワードを忘れた場合"],
    synonyms: ["pass reset", "forgot password", "パスワードリカバリ"],
  },
  login: {
    keywords: [
      "ログイン",
      "login",
      "Google",
      "LINE",
      "メール",
      "サインイン",
      "Googleでログイン",
      "LINEでログイン",
      "OAuth",
      "SNS",
    ],
    aliases: ["ログイン画面", "Googleでログイン", "LINEでログイン", "ログイン方法"],
    synonyms: ["log in", "signin", "ソーシャルログイン", "外部ログイン"],
  },
  "login-fail": {
    keywords: ["ログインできない", "ログイン失敗", "ログインエラー", "login error", "認証エラー"],
    aliases: ["サインインできない", "ログイン障害"],
    synonyms: ["cannot login", "login failed"],
  },
  pricing: {
    keywords: ["料金", "価格", "手数料", "費用", "pricing", "プラン", "無料", "有料"],
    aliases: ["いくらかかる", "利用料", "コスト", "月額"],
    synonyms: ["price", "fee", "cost", "課金"],
  },
  faq: {
    keywords: ["FAQ", "よくある質問", "Q&A", "ヘルプ", "困った", "質問一覧"],
    aliases: ["初めての疑問", "ヘルプ集"],
    synonyms: ["faqs", "help", "support faq"],
  },
};

/** トピック key 単位の共通キーワード（生成時に各 slug へコピー） */
export const QA_KEYWORDS_BY_TOPIC = {
  login: {
    keywords: ["ログイン", "login", "Google", "LINE", "メール", "サインイン", "Googleでログイン", "LINEでログイン", "OAuth"],
    aliases: ["ログイン画面", "Googleでログイン", "LINEでログイン"],
    synonyms: ["log in", "signin", "ソーシャルログイン"],
  },
  "ai-workspace-start": {
    keywords: ["TASFUL AI", "AI Workspace", "AI相談", "workspace", "AIチャット"],
    aliases: ["AIの使い方", "AI入門", "AIワークスペース"],
    synonyms: ["tasful ai", "ai workspace"],
  },
  "tlv-start": {
    keywords: ["TLV", "ライブ", "live", "配信", "TLV Live"],
    aliases: ["ライブプラットフォーム", "ライブ機能"],
    synonyms: ["tlv live", "streaming"],
  },
  "talk-start": {
    keywords: ["Talk", "トーク", "talk", "会話", "TASFUL Talk"],
    aliases: ["トーク機能", "メッセージアプリ"],
    synonyms: ["tasful talk", "messaging"],
  },
  "material-start": {
    keywords: ["Material", "マテリアル", "material", "素材"],
    aliases: ["素材機能", "マテリアルライブラリ"],
    synonyms: ["assets", "resources"],
  },
};
