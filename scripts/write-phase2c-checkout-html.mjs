#!/usr/bin/env node
/**
 * Phase 2-C: write checkout / order-complete / service-fee-pay HTML as UTF-8.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const files = {
  "checkout.html": `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ご注文・お支払い | TASFUL</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="tasu-banner.css">
  <link rel="stylesheet" href="shop-checkout-page.css">
</head>
<body class="shop-checkout-page" data-page="shop_checkout">

  <div class="tasu-banner">
    <div class="tasu-text">
      🚀 <span class="logo">TASFUL</span> — 安全な決済（Stripe）
    </div>
  </div>

  <main class="shop-checkout">
    <h1 class="shop-checkout__title">ご注文内容の確認</h1>
    <p class="shop-checkout__status" data-checkout-status>読み込み中…</p>

    <section class="shop-checkout__card" data-checkout-card hidden>
      <dl class="shop-checkout__summary">
        <div><dt>店舗</dt><dd data-checkout-shop-name>—</dd></div>
        <div><dt>商品</dt><dd data-checkout-product-name>—</dd></div>
        <div><dt>単価</dt><dd data-checkout-unit-price>—</dd></div>
        <div><dt>数量</dt><dd data-checkout-quantity>1</dd></div>
        <div class="shop-checkout__total-row"><dt>お支払い合計</dt><dd data-checkout-total>—</dd></div>
        <div><dt>店舗売上（目安）</dt><dd data-checkout-seller-amount>—</dd></div>
        <div><dt>TASFUL手数料（目安）</dt><dd data-checkout-platform-fee>—</dd></div>
      </dl>

      <p class="shop-checkout__note" data-checkout-recipient-note></p>

      <div class="shop-checkout__actions">
        <button type="button" class="shop-checkout__btn shop-checkout__btn--primary" data-checkout-pay>
          購入する（決済へ進む）
        </button>
        <a class="shop-checkout__btn shop-checkout__btn--secondary" data-checkout-back href="#">商品に戻る</a>
      </div>

      <p class="shop-checkout__note" data-checkout-demo-note hidden></p>
    </section>
  </main>

  <script src="chat-supabase-config.js"></script>
  <script src="supabase-public-key.js"></script>
  <script src="tasu-supabase-client.js"></script>
  <script src="shop-store-demo.js"></script>
  <script src="detail-shop-store-loader.js"></script>
  <script src="stripe-featured-config.js"></script>
  <script src="stripe-shop-config.js"></script>
  <script src="shop-payout.js"></script>
  <script src="shop-checkout.js"></script>
  <script src="checkout-page.js"></script>
</body>
</html>
`,
  "order-complete.html": `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ご注文完了 | TASFUL</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="tasu-banner.css">
  <link rel="stylesheet" href="shop-checkout-page.css">
</head>
<body class="shop-checkout-page shop-order-complete-page" data-page="shop_order_complete">

  <div class="tasu-banner">
    <div class="tasu-text">
      🚀 <span class="logo">TASFUL</span> — ご注文ありがとうございます
    </div>
  </div>

  <main class="shop-checkout shop-order-complete">
    <div class="shop-order-complete__icon" aria-hidden="true">✓</div>
    <h1 class="shop-checkout__title">ご注文が完了しました</h1>
    <p class="shop-checkout__status" data-order-complete-status>確認中…</p>

    <section class="shop-checkout__card" data-order-complete-card hidden>
      <dl class="shop-checkout__summary">
        <div><dt>注文番号</dt><dd data-order-id>—</dd></div>
        <div><dt>商品</dt><dd data-order-product-name>—</dd></div>
        <div><dt>数量</dt><dd data-order-quantity>—</dd></div>
        <div class="shop-checkout__total-row"><dt>お支払い金額</dt><dd data-order-total>—</dd></div>
        <div><dt>店舗売上</dt><dd data-order-seller-amount>—</dd></div>
        <div><dt>TASFUL手数料</dt><dd data-order-platform-fee>—</dd></div>
      </dl>
      <p class="shop-checkout__note">商品代金は店舗の売上として記録され、店舗へ注文が通知されます。発送・受取の詳細は店舗からご連絡があります。</p>
      <div class="shop-checkout__actions">
        <a class="shop-checkout__btn shop-checkout__btn--primary" data-order-shop-link href="shop-store.html">店舗ページへ</a>
        <a class="shop-checkout__btn shop-checkout__btn--secondary" href="index.html">トップへ戻る</a>
      </div>
    </section>
  </main>

  <script src="chat-supabase-config.js"></script>
  <script src="supabase-public-key.js"></script>
  <script src="stripe-featured-config.js"></script>
  <script src="stripe-shop-config.js"></script>
  <script src="shop-payout.js"></script>
  <script src="shop-checkout.js"></script>
  <script src="order-complete-page.js"></script>
</body>
</html>
`,
  "service-fee-pay.html": `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TASFUL 成約手数料のお支払い</title>
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="tasu-banner.css">
  <link rel="stylesheet" href="business-service-flow.css">
  <link rel="stylesheet" href="shop-checkout-page.css">
  <link rel="stylesheet" href="site-member-nav.css">
</head>
<body class="shop-checkout-page" data-page="service_fee_pay">

  <div class="tasu-banner">
    <div class="tasu-text">TASFUL — プラットフォーム利用料（成約手数料）</div>
  </div>

  <nav class="page-subnav" aria-label="戻るリンク">
    <a class="page-subnav__link" href="dashboard.html">← 会員ページへ戻る</a>
    <a class="page-subnav__link page-subnav__link--ghost" href="business.html">業務サービス一覧</a>
  </nav>

  <main class="shop-checkout">
    <h1 class="shop-checkout__title">成約手数料のお支払い</h1>
    <p class="shop-checkout__status" data-fee-status>読み込み中…</p>

    <section class="shop-checkout__card" data-fee-card hidden>
      <dl class="shop-checkout__summary">
        <div><dt>取引ID</dt><dd data-fee-deal-id>—</dd></div>
        <div><dt>成約金額</dt><dd data-fee-agreed>—</dd></div>
        <div class="shop-checkout__total-row"><dt>TASFUL手数料（5%）</dt><dd data-fee-amount>—</dd></div>
      </dl>
      <p class="shop-checkout__note">商品・作業の代金は掲載者と依頼者の間でお支払い済みである前提です。ここではTASFULの成約手数料のみお支払いいただきます。</p>

      <div class="shop-checkout__actions">
        <button type="button" class="shop-checkout__btn shop-checkout__btn--primary" data-fee-stripe-pay>Stripeで支払う</button>
      </div>

      <div class="bsf-payment__block" style="margin-top:16px">
        <h3 class="bsf-payment__label">銀行振込（TASFUL法人口座）</h3>
        <pre class="bsf-payment__note" data-fee-bank style="white-space:pre-wrap;font-family:inherit"></pre>
      </div>
    </section>
  </main>

  <script src="chat-supabase-config.js"></script>
  <script src="supabase-public-key.js"></script>
  <script src="stripe-featured-config.js"></script>
  <script src="stripe-service-fee-config.js"></script>
  <script src="service-deals-db.js"></script>
  <script src="service-fee-pay.js"></script>
</body>
</html>
`,
};

for (const [name, html] of Object.entries(files)) {
  const out = path.join(ROOT, name);
  fs.writeFileSync(out, html, "utf8");
  const text = fs.readFileSync(out, "utf8");
  console.log(name, {
    ufffd: (text.match(/\uFFFD/g) || []).length,
    questionMarks: (text.match(/\?\?/g) || []).length,
    ok: text.includes("UTF-8") && !text.includes("??"),
  });
}
