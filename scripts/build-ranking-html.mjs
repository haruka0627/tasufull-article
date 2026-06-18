function card({ img, tag, tagMod = "", href, title, rating, count, price, sellerName }) {
  const tagClass = tagMod ? ` top-rank-card__tag--${tagMod}` : "";
  const countHtml = count ? `<span class="top-rank-card__rating-count">（${count}）</span>` : "";
  return `            <a href="${href}" class="top-rank-card ranking-card top-mini-rank">
              <span class="top-rank-card__media-wrap">
                <span class="top-rank-card__media ranking-card-image" role="img" aria-label="" style="background-image:url('images/demo-ranking/${img}')"></span>
                <span class="top-rank-card__tag ranking-tag${tagClass}">${tag}</span>
              </span>
              <span class="top-rank-card__body ranking-body">
                <span class="top-rank-card__title ranking-title">${title}</span>
                <span class="top-rank-card__rating ranking-meta">★ ${rating}${countHtml}</span>
                <span class="top-rank-card__price ranking-price">${price}</span>
              </span>
              <span class="top-rank-card__footer">
                <span class="top-rank-card__seller ranking-seller">出品者：${sellerName}</span>
                <span class="top-rank-card__cta ranking-cta">詳しく見る →</span>
              </span>
            </a>`;
}

const popular = [
  { img: "popular-01.jpg", tag: "スキル", href: "detail-skill.html?id=skill_demo_001", title: "YouTube動画を編集します", rating: "5.0", count: "312件", price: "¥5,000〜", sellerName: "山田 美咲" },
  { img: "popular-02.jpg", tag: "スキル", href: "detail-skill.html?userId=u_me&id=skill_test_001", title: "YouTubeサムネイル制作", rating: "5.0", count: "228件", price: "¥3,000〜", sellerName: "佐藤 健" },
  { img: "popular-03.jpg", tag: "スキル", href: "detail-skill.html?id=skill_demo_001", title: "バナー・広告デザイン制作", rating: "5.0", count: "314件", price: "¥5,000〜", sellerName: "田中 彩" },
  { img: "popular-04.jpg", tag: "スキル", href: "detail-skill.html?userId=u_me&id=skill_test_001", title: "ロゴデザイン・ブランド設計", rating: "5.0", count: "297件", price: "¥5,000〜", sellerName: "鈴木 凛" },
  { img: "popular-05.jpg", tag: "スキル", href: "detail-product.html?id=product_earphone_001", title: "Instagram運用代行", rating: "5.0", count: "325件", price: "¥10,000〜", sellerName: "高橋 ゆい" },
];

const newest = [
  { img: "new-01.jpg", tag: "新着", tagMod: "new", href: "detail-skill.html?id=skill_new_001", title: "SNS運用マニュアル作成", rating: "新着", count: "本日", price: "¥8,000〜", sellerName: "伊藤 さくら" },
  { img: "new-02.jpg", tag: "新着", tagMod: "new", href: "detail-skill.html?id=skill_new_002", title: "画像AIレタッチ代行", rating: "新着", count: "昨日", price: "¥2,500〜", sellerName: "渡辺 大輔" },
  { img: "new-03.jpg", tag: "新着", tagMod: "new", href: "detail-skill.html?id=skill_new_003", title: "占い鑑定30分", rating: "新着", count: "2日前", price: "¥1,500〜", sellerName: "中村 ひかり" },
  { img: "new-04.jpg", tag: "新着", tagMod: "new", href: "detail-skill.html?id=skill_new_004", title: "Webサイトワイヤー作成", rating: "新着", count: "3日前", price: "¥12,000〜", sellerName: "小林 翔" },
  { img: "new-05.jpg", tag: "新着", tagMod: "new", href: "detail-product.html?id=product_new_001", title: "Canvaテンプレート販売", rating: "新着", count: "3日前", price: "¥980〜", sellerName: "加藤 真由" },
];

const product = [
  { img: "product-01.jpg", tag: "商品", tagMod: "product", href: "detail-product.html?id=product_earphone_001", title: "ワイヤレスイヤホン", rating: "4.9", count: "189件", price: "¥3,980", sellerName: "Audio Plus" },
  { img: "product-02.jpg", tag: "商品", tagMod: "product", href: "detail-product.html?id=product_handmade_001", title: "ハンドメイドアクセサリー", rating: "5.0", count: "142件", price: "¥2,200〜", sellerName: "atelier miel" },
  { img: "product-03.jpg", tag: "商品", tagMod: "product", href: "detail-product.html?id=product_book_001", title: "ビジネス書籍セット", rating: "4.8", count: "96件", price: "¥1,500", sellerName: "BOOK LAB" },
  { img: "product-04.jpg", tag: "商品", tagMod: "product", href: "detail-product.html?id=product_gadget_001", title: "スマホスタンド", rating: "4.9", count: "211件", price: "¥880", sellerName: "Gadget Base" },
  { img: "product-05.jpg", tag: "商品", tagMod: "product", href: "detail-product.html?id=product_food_001", title: "オーガニックコーヒー豆", rating: "5.0", count: "78件", price: "¥1,280", sellerName: "ROAST HOUSE" },
];

const skill = [
  { img: "skill-01.jpg", tag: "スキル", href: "detail-skill.html?id=skill_demo_001", title: "YouTube動画編集", rating: "5.0", count: "412件", price: "¥5,000〜", sellerName: "山田 美咲" },
  { img: "skill-02.jpg", tag: "スキル", href: "detail-skill.html?id=skill_edit_002", title: "ショート動画編集", rating: "4.9", count: "286件", price: "¥3,500〜", sellerName: "佐藤 健" },
  { img: "skill-03.jpg", tag: "スキル", href: "detail-skill.html?id=skill_sns_003", title: "Instagram運用代行", rating: "5.0", count: "325件", price: "¥10,000〜", sellerName: "高橋 ゆい" },
  { img: "skill-04.jpg", tag: "スキル", href: "detail-skill.html?id=skill_design_004", title: "バナー・広告デザイン", rating: "5.0", count: "314件", price: "¥5,000〜", sellerName: "田中 彩" },
  { img: "skill-05.jpg", tag: "スキル", href: "detail-skill.html?id=skill_code_005", title: "LPコーディング", rating: "4.9", count: "198件", price: "¥15,000〜", sellerName: "鈴木 凛" },
];

function section(id, title, moreHref, items) {
  const cards = items.map((item) => card(item)).join("\n");
  return `    <section class="top-section top-ranking" aria-labelledby="${id}">
      <div class="top-page__inner top-ranking__inner">
        <header class="top-ranking__head">
          <h2 id="${id}" class="top-section__title">${title}</h2>
          <a href="${moreHref}" class="top-ranking__more">すべて見る →</a>
        </header>
        <div class="top-ranking__carousel">
          <button type="button" class="top-ranking__arrow top-ranking__arrow--prev" data-ranking-prev aria-label="前の掲載">‹</button>
          <div class="top-ranking__track ranking-slider" data-ranking-track tabindex="0">
${cards}
          </div>
          <button type="button" class="top-ranking__arrow top-ranking__arrow--next" data-ranking-next aria-label="次の掲載">›</button>
        </div>
      </div>
    </section>`;
}

const html = [
  section("rankingPopularTitle", "人気ランキング", "index.html", popular),
  section("rankingNewTitle", "新着ランキング", "index.html?sort=new", newest),
  section("rankingProductTitle", "商品ランキング", "index.html?category=product", product),
  section("rankingSkillTitle", "スキルランキング", "index.html?category=skill", skill),
].join("\n\n");

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "_ranking-sections.html");
writeFileSync(out, html + "\n", "utf8");
console.log("wrote", out);
