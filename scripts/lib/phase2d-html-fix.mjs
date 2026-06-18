/**
 * Shared Phase 2-D HTML mojibake repair (static text only).
 */

const CLOSE_TAGS = [
  "span",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "div",
  "option",
  "label",
  "dt",
  "dd",
  "p",
  "section",
  "aside",
  "button",
  "li",
  "ul",
  "pre",
  "nav",
  "main",
  "footer",
  "header",
  "figure",
  "th",
  "td",
];

function fixBrokenHtmlTokens(text) {
  let out = text;
  out = out.replace(/Ebr>/g, "<br>");
  out = out.replace(/E\/(\w+)>/g, "</$1>");
  out = out.replace(/aria-label="([^"]*?)E>/g, 'aria-label="$1">');
  out = out.replace(/aria-label="([^"]*?)\uFFFD([^"]*?)"/g, (_, a, b) => `aria-label="${a}${b}"`);
  return out;
}

function fixFffdPatterns(text) {
  let out = text;
  out = out.replace(/老E\uFFFD*/g, "者");
  out = out.replace(/プラチE\uFFFD*/g, "プラット");
  out = out.replace(/ペE\uFFFD*/g, "ページ");
  out = out.replace(/料釁E/g, "料金");
  out = out.replace(/料\uFFFD+/g, "料金");
  out = out.replace(/相諁E\uFFFD*/g, "相談");
  out = out.replace(/冁E\uFFFD*/g, "内容");
  out = out.replace(/篁E\uFFFD*/g, "範囲");
  out = out.replace(/サポE\uFFFD*/g, "サポート");
  out = out.replace(/対忁E\uFFFD*/g, "対応");
  out = out.replace(/E\uFFFD+/g, "");
  out = out.replace(/([ぁ-ん一-龥ァ-ヶ])E(?![a-zA-Z-])/g, "$1");
  out = out.replace(/　E　/g, "　｜　");
  out = out.replace(/\uFFFD+/g, "");
  return out;
}

const BUSINESS_TEXT_FIXES = [
  ["サービス賁E（PDF", "サービス資料（PDF"],
  ["サービス賁E", "サービス資料"],
  ["賁Eをダウンロードすめ", "資料をダウンロードする"],
  ["賁Eをダウンロード", "資料をダウンロード"],
  ["保有賁E", "保有資格"],
  ["賁E・認証", "資格・認証"],
  ["提供サービス冁E", "提供サービス内容"],
  ["対応冁E", "対応内容"],
  ["対応E容", "対応内容"],
  ["ご依頼冁E", "ご依頼内容"],
  ["評価の冁E", "評価の内訳"],
  ["エリアごとの対応方況E", "エリアごとの対応方法"],
  ["お支払いにつぁE", "お支払いについて"],
  ["対応につぁE", "対応について"],
  ["業務E容めE積もりにつぁE", "業務内容や見積もりについて"],
  ["業務E容", "業務内容"],
  ["まずEお気軽に", "まずはお気軽に"],
  ["そE他エリア", "その他エリア"],
  ["そE他", "その他"],
  ["決済E掲載老E依頼老EE間", "決済は掲載者と依頼者の間"],
  ["掲載老EらE回答", "掲載者からの回答"],
  ["掲載老Eお問ぁEわせ", "掲載者へお問い合わせ"],
  ["詳細は掲載老Eお問ぁEわせ", "詳細は掲載者へお問い合わせ"],
  ["事業老E報", "事業者情報"],
  ["事業老EE基本惁E", "事業者の基本情報"],
  ["法人・業老E覧", "法人・業者一覧"],
  ["業老E覧に戻め", "業者一覧に戻る"],
  ["会員ペEジ", "会員ページ"],
  ["一覧トッチE", "一覧トップ"],
  ["プラチEへようこそ", "プラットフォームへようこそ"],
  ["読み込んでぁEす", "読み込んでいます"],
  ["読み込めませんでした。EージをE読み込み", "読み込めませんでした。ページを再読み込み"],
  ["ↁE法人", "← 法人"],
  ["ヒEローTOP", "ヒーローTOP"],
  ["左画僁E", "左画像"],
  ["中央惁E", "中央情報"],
  ["前E画僁E", "前の画像"],
  ["次の画僁E", "次の画像"],
  ["相諁EE見穁E", "相談・見積"],
  ["ご相諁EEお見積りはこちめ", "ご相談・お見積りはこちら"],
  ["24時間受付E無斁E", "24時間受付・無料"],
  ["ペEジ冁Eビとお問ぁEわせ", "ページ内ナビとお問い合わせ"],
  ["横幁EっぱぁEE白カーチE", "横幅いっぱいの白カード"],
  ["目安料釁E", "目安料金"],
  ["料の詳細", "料金の詳細"],
  ["表示料は", "表示料金は"],
  ["実績・事ä¾E", "実績・事例"],
  ["庁E掲輁E", "広告掲載"],
  ["口コミE評価", "口コミ・評価"],
  ["☁EE☁EE☁E", "★★★★★"],
  ["お客様E声", "お客様の声"],
  ["すべての口コミを見るEE", "すべての口コミを見る →"],
  ["料の詳細を見るEE", "料金の詳細を見る →"],
  ["お問ぁEわせ", "お問い合わせ"],
  ["お気軽にお問ぁEわせ", "お気軽にお問い合わせ"],
  ["詳細はお問ぁEわせ", "詳細はお問い合わせ"],
  ["問い合わせください、E", "問い合わせください。"],
  ["ください、E", "ください。"],
  ["です、E", "です。"],
  ["します、E", "します。"],
  ["、E/p>", "。</p>"],
  ["（税別EE", "（税別）"],
  ["AIç¢ºèª", "AI確認"],
  ["オンライン対忁E", "オンライン対応"],
  ["全国対忁E", "全国対応"],
  ["現地へお伺ぁEて対忁E", "現地へお伺いして対応"],
  ["スタチEが現地へお伺ぁEて", "スタッフが現地へお伺いして"],
  ["スタチEが訪問して", "スタッフが訪問して"],
  ["十E県", "千葉県"],
  ["東京都全域E神奈川", "東京都全域・神奈川"],
  ["相諁E能", "相談可能"],
  ["相諁Eめ", "相談する"],
  ["相諁Eださい", "相談ください"],
  ["相諁E", "相談を"],
  ["ご相諁E", "ご相談"],
  ["ご案Eしま", "ご案内しま"],
  ["対応してぁEす", "対応しています"],
  ["お伺ぁEて", "お伺いして"],
  ["現地確認E調査", "現地確認・調査"],
  ["作業が忁Eな", "作業が必要な"],
  ["場合E、", "場合は、"],
  ["契紁E", "契約"],
  ["実衁E", "実施"],
  ["報呁E", "報告"],
  ["見穁E", "見積"],
  ["スチEプ", "ステップ"],
  ["地域寁E型", "地域密着型"],
  ["便利プラチEフォーム", "便利プラットフォーム"],
  ["お気に入めE", "お気に入り"],
  ["✁E本人確認済み", "✓ 本人確認済み"],
  ["✁E/span>", "✓</span>"],
  ["ↁE", "←"],
  ["✨ 相諁Eめ", "✨ 相談する"],
  ["スクリプトの読み込みに失敗しました、E", "スクリプトの読み込みに失敗しました。"],
  ["再度お開きください、E", "再度お開きください。"],
  ["付E無", "付・無"],
  ["チE-", "ットフォーム"],
  ["記E目", "記は目"],
  ["県E埼", "県・埼"],
  ["済E掲", "済は掲"],
  ["らE回", "らの回"],
  ["たE「", "た「"],
  ["型E便", "型便利"],
  ["地域寁型", "地域密着型"],
  ["あなた「困った」", "あなたの「困った」"],
  ["白カーットフォーム->", "白カード -->"],
  ["横幁っぱぁ", "横幅いっぱいの"],
  ["プラットへようこそ", "プラットフォームへようこそ"],
  ["法人・業者覧", "法人・業者一覧"],
];

const SHARED_TEXT_FIXES = [
  ["お気に入め", "お気に入り"],
  ["読み込んでいす", "読み込んでいます"],
  ["相諁", "相談"],
  ["口コチ", "口コミ"],
  ["トッチ", "トップ"],
  ["戻め", "戻る"],
  ["画僁", "画像"],
  ["惁E", "情報"],
  ["掲輁", "掲載"],
  ["ペEジ", "ページ"],
  ["お問ぁ", "お問い"],
  ["につぁ", "について"],
  ["サポEト", "サポート"],
  ["掲載老", "掲載者"],
  ["利用老", "利用者"],
  ["事業老", "事業者"],
  ["ↁE", "←"],
  ["　E　", "　｜　"],
];

const GENERAL_EXTRA_FIXES = [
  ["<title>????E?? | TASFUL</title>", "<title>掲載詳細 | TASFUL</title>"],
  ["aria-label=\"TASFULトップへ\"", 'aria-label="サービス概要"'],
  ["?E?????E??????", "← サービス一覧へ戻る"],
  ["??????????????", "掲載データを読み込んでいます…"],
  ["????", "パンくず"],
  ["????E????", "掲載管理へ"],
];

function fixOrphanCloseTags(text) {
  let out = text;
  for (const tag of CLOSE_TAGS) {
    out = out.replace(new RegExp(`([^<])\\/${tag}>`, "g"), `$1</${tag}>`);
  }
  return out;
}

function applyTextFixes(text, pairs) {
  let out = text;
  for (const [from, to] of pairs) {
    out = out.split(from).join(to);
  }
  return out;
}

function fixGarbledAttributes(text) {
  let out = text;
  out = out.replace(/aria-label="([^"]+) hidden>/g, 'aria-label="$1" hidden>');
  out = out.replace(/aria-label="前画像"/g, 'aria-label="前の画像"');
  out = out.replace(/aria-label="相談見穁"/g, 'aria-label="相談・見積"');
  out = out.replace(/aria-label="ページジ内容ビとお問いわせ"/g, 'aria-label="ページ内ナビとお問い合わせ"');
  out = out.replace(/aria-label="特徴・対応容"/g, 'aria-label="特徴・対応内容"');
  out = out.replace(/aria-label="エリアごとの対応方況"/g, 'aria-label="エリアごとの対応方法"');
  out = out.replace(/aria-label="問い合わぁ"/g, 'aria-label="問い合わせ"');
  return out;
}

const POLISH_TEXT_FIXES = [
  ["、</p>", "。</p>"],
  ["お見積りぁします", "お見積りします"],
  ["保有賁・", "保有資格・"],
  ["掲載者お問いわせ", "掲載者へお問い合わせ"],
  [
    "問い合わせ←ヒアリング ←見穁←契紁←実衁←報呁の6スチプ",
    "お問い合わせ → ヒアリング → 見積 → 契約 → 実施 → 報告 の6ステップ",
  ],
  ["見穁←", "見積 →"],
  ["契紁←", "契約 →"],
  ["実衁←", "実施 →"],
  ["報呁の", "報告 の"],
  ["スチプ", "ステップ"],
  ["問い合わぁ", "問い合わせ"],
  ["見積 ←", "見積 →"],
  ["契約 ←", "契約 →"],
  ["実施 ←", "実施 →"],
  ["報告 の6スチプ", "報告 の6ステップ"],
  ["事業者基本惁", "事業者の基本情報"],
  ["ご相談お見積り", "ご相談・お見積り"],
  ["対応してぁす", "対応しています"],
  ["スタチが", "スタッフが"],
  ["お伺ぁて", "お伺いして"],
  ["忁な", "必要な"],
  ["決済掲載者依頼者間", "決済は掲載者と依頼者の間"],
  ["掲載者ら回答", "掲載者からの回答"],
  ["（税別</p>", "（税別）</p>"],
  ["実績・事ä¾", "実績・事例"],
  ["ページジ内容ビ", "ページ内ナビ"],
  ["対応容", "対応内容"],
  ["対応方況", "対応方法"],
  ["相談見積", "相談・見積"],
  ["ご確認ください、", "ご確認ください。"],
  ["ご相談相談を", "ご相談"],
  ["相談をすめ", "相談する"],
  ["相談をださい", "相談ください"],
  ['showLoadIssue("スクリプトの読み込みに失敗しました。);', 'showLoadIssue("スクリプトの読み込みに失敗しました。");'],
  [
    'showLoadIssue("読み込めませんでした。ページを再読み込みするか、一覧から再度お開きください。);',
    'showLoadIssue("読み込めませんでした。ページを再読み込みするか、一覧から再度お開きください。");',
  ],
];

/** @param {string} text */
export function fixBusinessServiceHtml(text) {
  let out = text;
  out = fixBrokenHtmlTokens(out);
  out = fixFffdPatterns(out);
  out = applyTextFixes(out, BUSINESS_TEXT_FIXES);
  out = applyTextFixes(out, SHARED_TEXT_FIXES);
  out = fixOrphanCloseTags(out);
  out = applyTextFixes(out, POLISH_TEXT_FIXES);
  out = fixGarbledAttributes(out);
  out = out.replace(/\uFFFD/g, "");
  out = out.replace(/\?\?/g, "");
  return out;
}

/** @param {string} text */
export function fixGeneralDetailHtml(text) {
  let out = fixBusinessServiceHtml(text);
  out = applyTextFixes(out, GENERAL_EXTRA_FIXES);
  return out;
}
