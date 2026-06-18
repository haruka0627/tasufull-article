import fs from "node:fs";
import path from "node:path";

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>商品詳細 | TASFUL</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="tasu-banner.css">
  <link rel="stylesheet" href="shop-store-cards.css">
  <link rel="stylesheet" href="detail-shop-product.css">
</head>
<body class="shop-product-detail-page" data-page="shop_product_detail">

  <div class="tasu-banner">
    <div class="tasu-text">
      🚀 <span class="logo">TASFUL</span>プラットフォームへようこそ　
      <a href="shop-store.html" class="link">店舗・販売一覧</a>
    </div>
  </div>

  <main class="shop-product-detail" data-shop-product-main>
    <nav class="shop-product-detail__breadcrumb" data-shop-product-breadcrumb aria-label="パンくず"></nav>

    <p class="shop-product-detail__status" data-shop-product-status hidden></p>

    <div class="shop-product-detail__layout" data-shop-product-layout hidden>
      <div class="shop-product-detail__gallery">
        <figure class="shop-product-detail__figure">
          <img data-shop-product-image src="" alt="" width="640" height="480" decoding="async">
        </figure>
      </div>

      <div class="shop-product-detail__info">
        <p class="shop-product-detail__shop" data-shop-product-shop-name></p>
        <h1 class="shop-product-detail__title" data-shop-product-title>商品</h1>
        <p class="shop-product-detail__category" data-shop-product-category hidden></p>
        <p class="shop-product-detail__price" data-shop-product-price></p>
        <div class="shop-product-detail__meta" data-shop-product-meta></div>

        <div class="shop-product-detail__qty">
          <label for="shopProductQty">数量</label>
          <div class="shop-product-detail__qty-control">
            <button type="button" class="shop-product-detail__qty-btn" data-qty-minus aria-label="数量を減らす">−</button>
            <input type="number" id="shopProductQty" data-shop-product-qty value="1" min="1" max="99" inputmode="numeric">
            <button type="button" class="shop-product-detail__qty-btn" data-qty-plus aria-label="数量を増やす">＋</button>
          </div>
        </div>

        <div class="shop-product-detail__cta">
          <button type="button" class="shop-product-detail__btn shop-product-detail__btn--primary" data-shop-product-buy>
            購入する
          </button>
          <a class="shop-product-detail__btn shop-product-detail__btn--secondary" data-shop-product-inquiry href="chat.html">
            問い合わせる
          </a>
        </div>

        <p class="shop-product-detail__payout-note" data-shop-product-payout-note hidden></p>
        <p class="shop-product-detail__note">商品代金は店舗の売上として処理され、TASFUL はプラットフォーム手数料のみを受け取ります（Stripe Connect）。</p>
      </div>
    </div>

    <section class="shop-product-detail__desc" data-shop-product-desc-wrap hidden>
      <h2>商品説明</h2>
      <div data-shop-product-description></div>
    </section>
  </main>

  <script src="chat-supabase-config.js"></script>
  <script src="supabase-public-key.js"></script>
  <script src="tasu-supabase-client.js"></script>
  <script src="business-categories.js"></script>
  <script src="shop-store-products-db.js"></script>
  <script src="shop-store-demo.js"></script>
  <script src="detail-shop-store-loader.js"></script>
  <script src="shop-products-config.js"></script>
  <script src="stripe-featured-config.js"></script>
  <script src="stripe-shop-config.js"></script>
  <script src="shop-payout.js"></script>
  <script src="shop-checkout.js"></script>
  <script src="detail-shop-product-page.js"></script>
</body>
</html>
`;

const out = path.resolve(import.meta.dirname, "..", "detail-shop-product.html");
fs.writeFileSync(out, html, "utf8");
console.log("ok", fs.readFileSync(out, "utf8").includes("商品詳細"));
