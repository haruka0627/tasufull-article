/**
 * Merge shop-store / field-service flows into current post.html (UTF-8 safe via Node).
 * Run: node scripts/merge-post-latest-flows.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = "post.html";
let html = readFileSync(path, "utf8");

const FS_CATEGORIES = [
  ["transport", "送迎・運搬"],
  ["construction", "建設・工事"],
  ["repair_maintenance", "修理・メンテナンス"],
  ["cleaning", "清掃・片付け"],
  ["beauty_wellness", "美容・リラク"],
  ["education", "スクール・教室"],
  ["onsite_service", "出張サービス"],
  ["life_support", "暮らしサポート"],
  ["it_web", "IT・Web制作"],
  ["sales_agency", "営業・代行"],
  ["corporate_support", "法人サポート"],
  ["other_business", "その他業務"],
];

const SHOP_SUBCATEGORIES = [
  ["restaurant", "飲食・カフェ"],
  ["retail", "小売・物販"],
  ["vintage_brand", "古着・ブランド"],
  ["goods_interior", "雑貨・インテリア"],
  ["food_retail", "食品販売"],
  ["hobby_anime", "ホビー・アニメ・トレカ"],
  ["pet", "ペット用品"],
  ["other_shop", "その他"],
];

function supportSelect(id, name, extraKey, fieldKey, label) {
  return `<p class="post-field">
  <label for="${id}">${label}</label>
  <select id="${id}" name="${name}" class="post-select" data-category-extra-key="${extraKey}" data-business-extra-field="${fieldKey}" data-business-field>
    <option value="">選択してください</option>
    <option value="yes">対応可能</option>
    <option value="no">対応不可</option>
    <option value="consult">相談可能</option>
  </select>
</p>`;
}

function buildBusinessHubInner() {
  const modeCards = `
          <div class="post-category-pick post-category-pick--biz-mode post-type-cards" role="group" aria-label="法人・業者掲載種別">
            <button type="button" class="post-type-card" data-post-type="shop-store" aria-pressed="false">
              <strong>店舗・販売</strong>
              <span>商品・物販・飲食・雑貨など</span>
            </button>
            <button type="button" class="post-type-card" data-post-type="business-service" aria-pressed="false">
              <strong>業務サービス</strong>
              <span>見積・相談・業務依頼向けサービス</span>
            </button>
          </div>
          <div class="visually-hidden" aria-hidden="true">
            <input type="radio" name="businessModePick" value="shop_store" data-business-mode-pick id="bizModeShopStore">
            <input type="radio" name="businessModePick" value="field_service" data-business-mode-pick id="bizModeFieldService">
          </div>`;

  const fsPicks = FS_CATEGORIES.map(
    ([id, label]) => `<label class="post-category-pick__item" data-category="${id}">
              <input type="radio" name="businessCategoryPick" value="${id}" data-business-category-pick data-category="${id}">
              <span class="post-category-pick__label">${label}</span>
            </label>`
  ).join("\n            ");

  const shopPicks = SHOP_SUBCATEGORIES.map(
    ([id, label]) => `<label class="post-category-pick__item post-category-pick__item--center" data-shop-store-category="${id}">
              <input type="radio" name="shopStoreCategoryPick" value="${id}" data-shop-store-category-pick>
              <span class="post-category-pick__label">${label}</span>
            </label>`
  ).join("\n            ");

  return `${modeCards}

          <div class="post-category-pick post-category-pick--business" role="radiogroup" aria-label="業務サービスカテゴリ" data-business-category-pick-group hidden aria-hidden="true" style="display:none">
            ${fsPicks}
          </div>

          <div class="post-category-pick post-category-pick--business" role="radiogroup" aria-label="店舗・販売カテゴリ" data-shop-store-category-pick-group hidden aria-hidden="true" style="display:none">
            ${shopPicks}
          </div>

          <p class="post-field post-field--full" data-business-subcategory-wrap hidden aria-hidden="true">
            <label for="businessSubcategory">サブカテゴリ</label>
            <select id="businessSubcategory" name="business_subcategory" class="post-select" data-business-subcategory disabled></select>
          </p>`;
}

const businessBlockRe =
  /(<div class="post-category-hub__block post-category-hub__block--business" data-post-scope-block="business">[\s\S]*?<h3 class="post-category-hub__subtitle">[\s\S]*?<\/h3>\s*)[\s\S]*?(<aside class="post-notice post-notice--business" data-business-notice hidden>)/;

if (!businessBlockRe.test(html)) {
  console.error("Could not find business category hub block to replace.");
  process.exit(1);
}

html = html.replace(businessBlockRe, `$1${buildBusinessHubInner()}\n\n          $2`);

if (!html.includes("data-business-type-value")) {
  html = html.replace(
    '<input type="hidden" name="business_category" value="" data-business-category-hidden>',
    `<input type="hidden" name="business_category" value="" data-business-category-hidden>
      <input type="hidden" name="business_type" value="" data-business-type-value>`
  );
}

if (!html.includes('value="shop-store"')) {
  html = html.replace(
    '<option value="worker">',
    `<option value="shop-store">店舗・販売</option>
            <option value="business-service">業務サービス</option>
            <option value="worker">`
  );
}

if (!html.includes("data-business-category-bar")) {
  html = html.replace(
    "</div>\n\n      <!--",
    `</div>

      <div class="post-business-category-bar" data-business-category-bar data-business-only hidden aria-hidden="true">
        <p class="post-business-category-bar__label">選択中のカテゴリ</p>
        <span class="post-type-badge post-type-badge--business" data-business-category-badge data-category="">—</span>
      </div>

      <!--`
  );
}

const flowsBlock = `
      <!-- 店舗・販売専用フロー -->
      <div class="post-shop-store-flow" data-shop-store-flow data-business-only data-business-form-key="shopFlow" hidden aria-hidden="true">
        <section class="post-shop-store-card" aria-labelledby="shopStoreBasicTitle">
          <header class="post-shop-store-card__head">
            <h2 id="shopStoreBasicTitle" class="post-shop-store-card__title">掲載基本情報</h2>
            <p class="post-shop-store-card__desc">一覧・詳細に表示する店舗の基本情報です</p>
          </header>
          <div class="post-shop-store-card__body post-shop-store-card__body--grid" data-shop-mount="basic"></div>
        </section>
        <section class="post-shop-store-card" aria-labelledby="shopStoreContactTitle">
          <header class="post-shop-store-card__head">
            <h2 id="shopStoreContactTitle" class="post-shop-store-card__title">店舗情報・連絡先</h2>
            <p class="post-shop-store-card__desc">住所・アクセス・連絡先など</p>
          </header>
          <div class="post-shop-store-card__body post-shop-store-card__body--grid" data-shop-mount="contact"></div>
        </section>
        <section class="post-shop-store-card" aria-labelledby="shopStoreSalesTitle">
          <header class="post-shop-store-card__head">
            <h2 id="shopStoreSalesTitle" class="post-shop-store-card__title">販売・買取オプション</h2>
            <p class="post-shop-store-card__desc">対応可能な販売・買取内容</p>
          </header>
          <div class="post-shop-store-card__body post-shop-store-card__body--grid" data-shop-mount="sales"></div>
        </section>
        <section class="post-shop-store-card" aria-labelledby="shopStoreProductsTitle">
          <header class="post-shop-store-card__head">
            <h2 id="shopStoreProductsTitle" class="post-shop-store-card__title">掲載商品</h2>
            <p class="post-shop-store-card__desc">商品・メニューを登録（最大12件）</p>
          </header>
          <div class="post-shop-store-card__body" data-shop-mount="products"></div>
        </section>
        <section class="post-shop-store-card" aria-labelledby="shopStoreImagesTitle">
          <header class="post-shop-store-card__head">
            <h2 id="shopStoreImagesTitle" class="post-shop-store-card__title">店舗画像</h2>
            <p class="post-shop-store-card__desc">メイン画像・ギャラリー</p>
          </header>
          <div class="post-shop-store-card__body" data-shop-mount="images"></div>
        </section>
        <section class="post-shop-store-card" aria-labelledby="shopStoreOptionsTitle">
          <header class="post-shop-store-card__head">
            <h2 id="shopStoreOptionsTitle" class="post-shop-store-card__title">PR・公開設定</h2>
          </header>
          <div class="post-shop-store-card__body post-shop-store-card__body--grid" data-shop-mount="options"></div>
        </section>
      </div>

      <!-- 業務サービス専用フロー -->
      <div class="post-field-service-flow" data-field-service-flow data-business-only data-business-form-key="fieldServiceFlow" hidden aria-hidden="true">
        <div data-fs-mount="basic"></div>
        <div data-fs-mount="hero"></div>
        <div data-fs-mount="features"></div>
        <div data-fs-mount="overview"></div>
        <div data-fs-mount="license"></div>
        <div data-fs-mount="flow"></div>
        <div data-fs-mount="company"></div>
        <div data-fs-mount="area"></div>
        <div data-fs-mount="materials"></div>
        <div data-fs-mount="images"></div>
        <div data-fs-mount="menu"></div>
        <div data-fs-mount="cases"></div>
        <div data-fs-mount="contact"></div>
        <div data-fs-mount="ads"></div>
      </div>
`;

if (!html.includes("data-shop-store-flow")) {
  html = html.replace(
    /(\s*<!-- ========== .*? ========== -->)/,
    `${flowsBlock}$1`
  );
}

const shopFieldsBlock = `
            <p class="post-field post-field--full">
              <label for="bizExtraShopStoreCategory">商品カテゴリ</label>
              <input type="text" id="bizExtraShopStoreCategory" name="biz_extra_shop_store_category" data-category-extra-key="shop_store" data-business-extra-field="store_type" data-business-field placeholder="例：工具・機材・中古販売・買取">
            </p>
            <p class="post-field post-field--full">
              <label for="bizExtraShopStoreCatchCopy">キャッチコピー<span class="post-field__required">必須</span></label>
              <input type="text" id="bizExtraShopStoreCatchCopy" name="biz_extra_shop_store_catch_copy" maxlength="120" data-category-extra-key="shop_store" data-business-extra-field="catch_copy" data-business-field placeholder="例：工具の買取強化中｜即日査定・法人対応">
            </p>
            <p class="post-field post-field--full">
              <label for="bizExtraShopStoreDesc">店舗説明<span class="post-field__required">必須</span></label>
              <textarea id="bizExtraShopStoreDesc" name="biz_extra_shop_store_desc" rows="4" data-category-extra-key="shop_store" data-business-extra-field="shop_description" data-business-field placeholder="店舗の特徴・取扱商品・強みを記載"></textarea>
            </p>
            <p class="post-field post-field--full">
              <label for="bizExtraShopStoreAddress">住所<span class="post-field__required">必須</span></label>
              <input type="text" id="bizExtraShopStoreAddress" name="biz_extra_shop_store_address" data-category-extra-key="shop_store" data-business-extra-field="address" data-business-field placeholder="例：大阪府大阪市北区…">
            </p>
            <p class="post-field">
              <label for="bizExtraShopStoreHours">営業時間<span class="post-field__required">必須</span></label>
              <input type="text" id="bizExtraShopStoreHours" name="biz_extra_shop_store_hours" data-category-extra-key="shop_store" data-business-extra-field="business_hours" data-business-field placeholder="例：10:00〜19:00">
            </p>
            <p class="post-field">
              <label for="bizExtraShopStoreClosed">定休日<span class="post-field__required">必須</span></label>
              <input type="text" id="bizExtraShopStoreClosed" name="biz_extra_shop_store_closed" data-category-extra-key="shop_store" data-business-extra-field="closed_day" data-business-field placeholder="例：水曜定休">
            </p>
            <p class="post-field">
              <label for="bizExtraShopStoreStation">最寄駅</label>
              <input type="text" id="bizExtraShopStoreStation" name="biz_extra_shop_store_station" data-category-extra-key="shop_store" data-business-extra-field="access" data-business-field placeholder="例：JR大阪駅 徒歩5分">
            </p>
            <p class="post-field post-field--full">
              <label for="bizExtraShopStoreParking">駐車場<span class="post-field__required">必須</span></label>
              <select id="bizExtraShopStoreParking" name="biz_extra_shop_store_parking" class="post-select" data-category-extra-key="shop_store" data-business-extra-field="parking" data-business-field>
                <option value="">選択してください</option>
                <option value="yes">あり</option>
                <option value="no">なし</option>
                <option value="nearby">近隣あり</option>
              </select>
            </p>
            <p class="post-field post-field--full">
              <label for="bizExtraShopStoreServices">取扱サービス<span class="post-field__required">必須</span></label>
              <textarea id="bizExtraShopStoreServices" name="biz_extra_shop_store_services" rows="2" data-category-extra-key="shop_store" data-business-extra-field="services" data-business-field placeholder="例：新品販売, 中古買取, 出張査定"></textarea>
            </p>
            ${supportSelect("bizExtraShopSales", "biz_extra_shop_sales", "shop_store", "sales_support", "販売対応")}
            ${supportSelect("bizExtraShopBuyback", "biz_extra_shop_buyback", "shop_store", "buyback_support", "買取対応")}
            ${supportSelect("bizExtraShopUsed", "biz_extra_shop_used", "shop_store", "used_sales", "中古販売")}
            ${supportSelect("bizExtraShopNew", "biz_extra_shop_new", "shop_store", "new_sales", "新品販売")}
            ${supportSelect("bizExtraShopVisitBuy", "biz_extra_shop_visit_buy", "shop_store", "visit_buyback", "出張買取")}
            ${supportSelect("bizExtraShopFreeAssessment", "biz_extra_shop_free_assessment", "shop_store", "shop_store_free_assessment", "査定無料対応")}
            ${supportSelect("bizExtraShopFastShip", "biz_extra_shop_fast_ship", "shop_store", "fast_shipping", "即日発送")}
            ${supportSelect("bizExtraShopCredit", "biz_extra_shop_credit", "shop_store", "credit_support", "クレジット対応")}
            ${supportSelect("bizExtraShopCorporate", "biz_extra_shop_corporate", "shop_store", "corporate_contract", "法人対応")}
            <p class="post-field">
              <label for="bizExtraShopShowEstimate">見積表示</label>
              <select id="bizExtraShopShowEstimate" name="biz_extra_shop_show_estimate" class="post-select" data-category-extra-key="shop_store" data-business-extra-field="show_estimate" data-business-field>
                <option value="">未設定</option>
                <option value="yes">表示する</option>
                <option value="no">表示しない</option>
              </select>
            </p>
            <p class="post-field">
              <label for="bizExtraShopShowPhone">問い合わせ可否</label>
              <select id="bizExtraShopShowPhone" name="biz_extra_shop_show_phone" class="post-select" data-category-extra-key="shop_store" data-business-extra-field="show_phone" data-business-field>
                <option value="">未設定</option>
                <option value="yes">電話相談可</option>
                <option value="no">非表示</option>
              </select>
            </p>
            <input type="hidden" id="bizExtraShopStoreFaqs" name="biz_extra_shop_store_faqs" data-category-extra-key="shop_store" data-business-extra-field="faqs" value="[]">
            <p class="post-field post-field--full" data-fs-catch-copy-field>
              <label for="fsCatchCopy">キャッチコピー</label>
              <input type="text" id="fsCatchCopy" name="fs_catch_copy" maxlength="120" data-category-extra-key="field_service" data-business-extra-field="catch_copy" data-business-field placeholder="例：即日対応・見積無料">
            </p>
            <p class="post-field post-field--full" data-fs-service-desc-field>
              <label for="bizExtraFieldServiceDesc">サービス説明<span class="post-field__required">必須</span></label>
              <textarea id="bizExtraFieldServiceDesc" name="biz_extra_field_service_desc" rows="4" data-category-extra-key="field_service" data-business-extra-field="service_description" data-business-field placeholder="提供サービス内容・強み・対応範囲"></textarea>
            </p>
`;

if (!html.includes("bizExtraShopStoreCatchCopy")) {
  html = html.replace(
    /(<p class="post-field post-field--full">\s*<label for="bizCompanyName">)/,
    `${shopFieldsBlock}$1`
  );
}

if (!html.includes("data-shop-store-images-heading")) {
  html = html.replace(
    '<div class="post-images-block post-field--full" data-listing-images-block>',
    `<div class="post-images-block post-field--full" data-listing-images-block>
            <h3 class="post-images-block__shop-title" data-shop-store-images-heading hidden aria-hidden="true">店舗サブ画像</h3>`
  );
}

if (!html.includes('data-biz-service-area-label')) {
  html = html.replace(
    '<label for="bizServiceArea">',
    '<label for="bizServiceArea" data-biz-service-area-label>'
  );
}

if (!html.includes("data-biz-pr-plan-group")) {
  html = html.replace(
    '<p class="post-field">\n              <label for="bizPrPlan">',
    '<p class="post-field" data-biz-pr-plan-group>\n              <label for="bizPrPlan">'
  );
  html = html.replace(
    '<p class="post-field">\n              <label for="bizFeaturedPlan">',
    '<p class="post-field" data-biz-featured-plan-group>\n              <label for="bizFeaturedPlan">'
  );
}

const shopProductsSection = `
        <section class="post-section post-section--shop-products" data-shop-products-section data-business-only data-business-form-key="shopProducts" hidden aria-hidden="true" aria-labelledby="shopProductsTitle">
          <header class="post-section__head">
            <h2 id="shopProductsTitle" class="post-section__title">掲載商品</h2>
            <p class="post-section__desc">商品名・価格・在庫・問い合わせ可否を登録（最大12件）</p>
          </header>
          <div class="post-section__body">
            <div class="post-shop-products-list" data-shop-products-list></div>
            <button type="button" class="post-work-cases-add" data-shop-products-add>+ 商品を追加</button>
          </div>
        </section>
`;

if (!html.includes("data-shop-products-section")) {
  html = html.replace(
    "</div>\n\n      <!-- 追加オプション",
    `${shopProductsSection}\n\n      <!-- 追加オプション`
  );
}

if (!html.includes("post-field-service-ui.css")) {
  html = html.replace(
    '<link rel="stylesheet" href="post.css">',
    `<link rel="stylesheet" href="post.css">
  <link rel="stylesheet" href="post-field-service-ui.css">`
  );
}

const extraScripts = `
  <script src="post-image-upload-slot.js"></script>
  <script src="post-shop-store-layout.js"></script>
  <script src="post-field-service-layout.js"></script>
  <script src="post-field-service-form.js"></script>
  <script src="post-shop-products.js"></script>
  <script src="post-shop-product-upload.js"></script>
  <script src="post-service-menu-upload.js"></script>
  <script src="post-work-case-upload.js"></script>
  <script src="business-service-data.js"></script>`;

if (!html.includes("post-shop-store-layout.js")) {
  html = html.replace('<script src="post.js"></script>', `${extraScripts}
  <script src="post.js"></script>`);
}

writeFileSync(path, html, "utf8");
console.log("Merged flows into post.html");
console.log("shop-store-flow:", html.includes("data-shop-store-flow"));
console.log("field-service-flow:", html.includes("data-field-service-flow"));
console.log("post-type-card:", html.includes("post-type-card"));
console.log("lines:", html.split("\n").length);
