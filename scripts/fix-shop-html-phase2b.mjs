#!/usr/bin/env node
/**
 * Phase 2-B: fix shop HTML mojibake (DOM / scripts / data-* preserved).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

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
];

function fixBrokenHtmlTokens(text) {
  let out = text;
  out = out.replace(/Ebr>/g, "<br>");
  out = out.replace(/E\/(\w+)>/g, "</$1>");
  out = out.replace(/aria-label="([^"]*?)E>/g, 'aria-label="$1">');
  return out;
}

function fixFffdPatterns(text) {
  let out = text;
  out = out.replace(/店\uFFFD+E/g, "店舗");
  out = out.replace(/啁\uFFFD+E/g, "商品");
  out = out.replace(/老E\uFFFD*/g, "者");
  out = out.replace(/プラチE\uFFFD*/g, "プラット");
  out = out.replace(/ショチE\uFFFD*/g, "ショップ");
  out = out.replace(/カチE\uFFFD*/g, "カテゴ");
  out = out.replace(/キーワ\uFFFD*ーチE/g, "キーワード");
  out = out.replace(/クレジチE\uFFFD*/g, "クレジット");
  out = out.replace(/リセチE\uFFFD*/g, "リセット");
  out = out.replace(/クイチE\uFFFD*/g, "クイック");
  out = out.replace(/相諁E\uFFFD*め/g, "相談する");
  out = out.replace(/�E�/g, "｜");
  out = out.replace(/\uFFFD+/g, "");
  return out;
}

const TEXT_FIXES = [
  ["AIに相談め", "AIに相談する"],
  ["お気に入め", "お気に入り"],
  ["読み込んでいす", "読み込んでいます"],
  ["探ぁ", "探す"],
  ["相諁", "相談"],
  ["口コチ", "口コミ"],
  ["トッチ", "トップ"],
  ["戻め", "戻る"],
  ["特集覧", "特集一覧"],
  ["一覧トップ", "一覧トップ"],
  ["買取対忁", "買取対応"],
  ["販売対忁", "販売対応"],
  ["法人対忁", "法人対応"],
  ["即日発送", "即日発送"],
  ["クレジット対忁", "クレジット対応"],
  ["オンライン相談対忁", "オンライン相談対応"],
  ["買叁", "買取"],
  ["入劁", "入力"],
  ["選抁", "選択"],
  ["掲輁", "掲載"],
  ["事侁", "事例"],
  ["画僁", "画像"],
  ["惁E", "情報"],
  ["概要", "概要"],
  ["説昁", "説明"],
  ["完亁", "完了"],
  ["注斁", "注文"],
  ["手数斁", "手数料"],
  ["金顁", "金額"],
  ["売丁", "売上"],
  ["確誁", "確認"],
  ["合訁", "合計"],
  ["処琁", "処理"],
  ["飲食E", "飲食・"],
  ["です、", "です。"],
  ["ください、", "ください。"],
  ["あります、", "あります。"],
  ["、Ebr>", "、<br>"],
  ["、E/h1>", "。</h1>"],
  ["もっと身近に、</h1>", "もっと身近に。</h1>"],
  ["セレクトショップE", "セレクトショップ"],
  ["ショップE", "ショップ"],
  ["店E", "店舗"],
  ["啁E", "商品"],
  ["ペEジ", "ページ"],
  ["冁E", "内"],
  ["お問ぁ", "お問い"],
  ["問い合わぁ", "問い合わせ"],
  ["につぁ", "について"],
  ["ガイチ", "ガイド"],
  ["規紁", "規約"],
  ["サポEチ", "サポート"],
  ["しまぁ", "します"],
  ["安忁", "安心"],
  ["許認可が忁", "許認可が必要"],
  ["賁E", "資格"],
  ["保有してぁ", "保有してい"],
  ["メチE", "メッ"],
  ["機E", "機能"],
  ["掲載老", "掲載者"],
  ["利用老", "利用者"],
  ["見積もり相諁", "見積もり相談"],
  ["料��目宁", "料金目安"],
  ["地域寁", "地域密着"],
  ["特定商取引況", "特定商取引法"],
  ["TASFUL冁", "TASFUL内"],
  ["ↁE", "←"],
  ["🤁E", "🤖"],
  ["✁E", "✓"],
  ["⌁E", "∨"],
  [" E", "—"],
  ["　E　", "　｜　"],
  ["大阪府/ ", "大阪府 / "],
];

function fixOrphanCloseTags(text) {
  let out = text;
  for (const tag of CLOSE_TAGS) {
    out = out.replace(new RegExp(`([^<])\\/${tag}>`, "g"), `$1</${tag}>`);
  }
  return out;
}

function applyTextFixes(text) {
  let out = text;
  for (const [from, to] of TEXT_FIXES) {
    out = out.split(from).join(to);
  }
  return out;
}

function fixMojibakeHtml(text) {
  let out = text;
  out = fixBrokenHtmlTokens(out);
  out = fixFffdPatterns(out);
  out = applyTextFixes(out);
  out = fixOrphanCloseTags(out);
  out = out.replace(/\uFFFD/g, "");
  return out;
}

const SHOP_PRODUCTS_EXTRA = [
  ["啁E��一覧", "商品一覧"],
  ["啁E��", "商品"],
  ["店�E", "店舗"],
  ["店E", "店舗"],
  ["カーチE", "カート"],
  ["該彁E件", "該当0件"],
  ["サービス案�E", "サービス案内"],
  ["ペ�Eジ送り", "ページ送り"],
  ["店�E惁E��", "店舗情報"],
  ["メニュー・啁E��をご覧ください、E", "メニュー・商品をご覧ください。"],
  ["啁E��名�Eキーワードで検索", "商品名・キーワードで検索"],
  ["並び替え：おすすめE��E", "並び替え：おすすめ順"],
  ["並び替え：新着頁E", "並び替え：新着順"],
  ["並び替え：人気頁E", "並び替え：人気順"],
  ["並び替え：価格が安い頁E", "並び替え：価格が安い順"],
  ["並び替え：価格が高い頁E", "並び替え：価格が高い順"],
  ["並び替ぁE", "並び替え"],
  ["、E/span>", "〜</span>"],
  ["TASFULトッチE", "TASFULトップ"],
  ["店�E・販売一覧", "店舗・販売一覧"],
];

function mergeShopProductsHeader(text, refPath) {
  const ref = fs.readFileSync(refPath, "utf8");
  const refHeader = ref.match(
    /<header class="shop-market-header shop-store-market-header"[\s\S]*?<\/header>/
  )?.[0];
  if (!refHeader) return text;

  const header = refHeader
    .replace(
      '<a href="post.html?scope=business" class="shop-market-header__cta">店舗を掲載する</a>\n        ',
      ""
    )
    .replace(
      `<a href="index.html" class="shop-market-header__action" aria-label="通知">
          <span class="shop-market-header__action-icon" aria-hidden="true">🔔</span>
          <span class="shop-market-header__action-label">通知</span>
        </a>`,
      `<a href="index.html" class="shop-market-header__action shop-market-header__action--cart" aria-label="カート">
          <span class="shop-market-header__action-icon" aria-hidden="true">🛒</span>
          <span class="shop-market-header__action-label">カート</span>
        </a>`
    )
    .replace(
      '<a href="ai-top.html" class="shop-market-header__nav-link shop-market-header__nav-link--ai">AI相談</a>',
      '<a href="chat.html" class="shop-market-header__nav-link shop-market-header__nav-link--ai">AI相談</a>'
    );

  return text.replace(
    /<header class="shop-market-header shop-store-market-header"[\s\S]*?<\/header>/,
    header
  );
}

function mergeShopStoreHeader(text, refPath) {
  const ref = fs.readFileSync(refPath, "utf8");
  const refHeader = ref.match(
    /<header class="shop-market-header shop-store-market-header"[\s\S]*?<\/header>/
  )?.[0];
  if (!refHeader) return text;

  const header = refHeader
    .replace(
      '<a href="index-top.html" class="shop-market-header__nav-link">特集一覧</a>',
      '<a href="index.html" class="shop-market-header__nav-link">特集一覧</a>'
    )
    .replace(
      '<a href="ai-top.html" class="shop-market-header__nav-link shop-market-header__nav-link--ai">AI相談とは</a>',
      '<a href="ai-top.html" class="shop-market-header__nav-link shop-market-header__nav-link--ai">AI相談</a>'
    )
    .replace(
      '<a href="dashboard.html" class="shop-market-header__action" aria-label="通知">',
      '<a href="index.html" class="shop-market-header__action" aria-label="通知">'
    )
    .replace(
      '<a href="dashboard.html" class="shop-market-header__action shop-market-header__action--primary" aria-label="マイページ">',
      '<a href="index.html" class="shop-market-header__action shop-market-header__action--primary" aria-label="マイページ">'
    );

  return text.replace(
    /<header class="shop-market-header shop-store-market-header"[\s\S]*?<\/header>/,
    header
  );
}

function applyShopProductsExtra(text) {
  let out = text;
  for (const [from, to] of SHOP_PRODUCTS_EXTRA) {
    out = out.split(from).join(to);
  }
  return out;
}

function fixFile(relPath, extra = (t) => t) {
  const abs = path.join(ROOT, relPath);
  const before = fs.readFileSync(abs, "utf8");
  let after = fixMojibakeHtml(before);
  after = extra(after);
  fs.writeFileSync(abs, after, "utf8");
  const ufffd = (after.match(/\uFFFD/g) || []).length;
  const brokenClose =
    (after.match(/[^<]\/(?:span|a|h[1-6]|div|option|label|dt|dd|p|section|aside|button)>/g) || [])
      .length;
  const strayE = (after.match(/[ぁ-ん一-龥]E[^\/\s<]/g) || []).length;
  return { file: relPath, ufffd, brokenClose, strayE, changed: before !== after };
}

const results = [
  fixFile("shop-store.html", (t) =>
    mergeShopStoreHeader(
      t.replace(/(<title>)[^<]*( \| TASFUL<\/title>)/, "$1店舗・販売（専門店）一覧$2"),
      path.join(ROOT, "ai-workspace.html")
    )
  ),
  fixFile("detail-shop.html", (t) =>
    t
      .replace(/(<title>)[^<]*( \| TASFUL<\/title>)/, "$1店舗詳細$2")
      .replace(
        'placeholder="ショップ・サービスを検索" aria-label="ショップ・サービスを検索"',
        'placeholder="店舗・商品を検索" aria-label="店舗・商品を検索"'
      )
      .replace(
        'name="q" class="shop-market-header__search-input"',
        'name="keyword" class="shop-market-header__search-input"'
      )
      .replace(
        'aria-label="ショップ検索ヘッダー"',
        'aria-label="店舗検索ヘッダー"'
      )
  ),
  fixFile("shop-products.html", (t) =>
    applyShopProductsExtra(
      mergeShopProductsHeader(
        t.replace(/(<title>)[^<]*( \| TASFUL<\/title>)/, "$1商品一覧$2"),
        path.join(ROOT, "shop-store.html")
      )
    )
  ),
];

console.log(JSON.stringify(results, null, 2));
