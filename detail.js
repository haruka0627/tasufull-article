/**
 * TasuFull — 記事詳細ページ（静的）
 * ギャラリー切替 / 表示タイプ（注目掲載など）のダミー切替
 */

(function () {
  "use strict";

  const DEMO = {
    featured: {
      title: "スマートウォッチ Pro",
      category: "商品 · 注目掲載",
      conditionClass: "detail-condition--mint",
      condition: "美品",
      lead:
        "健康管理・通知・決済をこれ1台で。有料掲載の注目商品。プレミアムサポートと30日間保証付きで安心のお買い物を。",
      price: "¥34,800",
      pageTitle: "スマートウォッチ Pro | TasuFull",
    },
    premium: {
      title: "スマートウォッチ Pro",
      category: "商品 · 有料掲載",
      conditionClass: "detail-condition--mint",
      condition: "美品",
      lead:
        "健康管理・通知・決済をこれ1台で。プレミアムサポート付きの有料掲載商品です。",
      price: "¥34,800",
      pageTitle: "スマートウォッチ Pro | TasuFull",
    },
    free: {
      title: "ワイヤレスイヤホン",
      category: "商品",
      conditionClass: "detail-condition--used",
      condition: "中古",
      lead: "ノイズキャンセリング対応。動作確認済みのお手頃価格モデルです。",
      price: "¥12,800",
      pageTitle: "ワイヤレスイヤホン | TasuFull",
    },
  };

  const elements = {
    page: document.querySelector(".detail-page"),
    hero: document.getElementById("detailHero"),
    decor: document.querySelector("[data-featured-decor]"),
    mainImage: document.getElementById("detailMainImage"),
    thumbs: document.querySelectorAll(".detail-gallery__thumb"),
    title: document.getElementById("detailHeroTitle"),
    category: document.querySelector(".detail-category"),
    condition: document.querySelector(".detail-condition"),
    lead: document.querySelector(".detail-summary__lead"),
    price: document.querySelector(".detail-summary__price"),
    heroPrice: document.getElementById("detailHeroPrice"),
  };

  let pricingBaseAmount = 34800;
  let updatePricingTotal = null;

  function parsePriceAmount(priceText) {
    if (!priceText) {
      return 0;
    }
    const digits = priceText.replace(/[^\d]/g, "");
    const amount = Number.parseInt(digits, 10);
    return Number.isFinite(amount) ? amount : 0;
  }

  function getDetailType() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    if (type === "skill") {
      window.location.replace("detail-skill.html");
      return "featured";
    }
    if (type === "job") {
      window.location.replace("detail-job.html");
      return "featured";
    }
    return type && DEMO[type] ? type : "featured";
  }

  function applyDetailType(type) {
    const data = DEMO[type];
    if (!data || !elements.hero) {
      return;
    }

    document.title = data.pageTitle;

    if (elements.page) {
      elements.page.dataset.detailType = "product";
      elements.page.dataset.productVariant = type;
    }

    const isFeatured = type === "featured";

    elements.hero.classList.toggle("detail-hero--featured", isFeatured);
    elements.hero.dataset.rank = isFeatured ? "pr" : type === "premium" ? "premium" : "free";

    if (elements.decor) {
      elements.decor.hidden = !isFeatured;
    }

    if (elements.title) {
      elements.title.textContent = data.title;
    }
    if (elements.category) {
      elements.category.textContent = data.category;
    }
    if (elements.condition) {
      elements.condition.textContent = data.condition;
      elements.condition.className = `detail-condition ${data.conditionClass}`;
    }
    if (elements.lead) {
      elements.lead.textContent = data.lead;
    }
    if (elements.heroPrice) {
      elements.heroPrice.innerHTML = `${data.price}<span class="detail-summary__price-tax">（税込）</span>`;
    } else if (elements.price) {
      elements.price.textContent = data.price;
    }

    pricingBaseAmount = parsePriceAmount(data.price);
    if (updatePricingTotal) {
      updatePricingTotal();
    }
  }

  function formatYen(amount) {
    return `¥${amount.toLocaleString("ja-JP")}`;
  }

  function initPricingOptions() {
    const optionList = document.getElementById("pricingOptionList");
    const totalNode = document.getElementById("pricingOptionTotal");
    if (!optionList || !totalNode) {
      return;
    }

    const items = optionList.querySelectorAll(".option-pick");

    updatePricingTotal = function updateTotal() {
      let sum = pricingBaseAmount;
      items.forEach((item) => {
        const price = Number.parseInt(item.dataset.optionPrice ?? "0", 10);
        if (item.classList.contains("is-active") && Number.isFinite(price)) {
          sum += price;
        }
      });
      totalNode.textContent = `${formatYen(sum)}〜`;
    };

    items.forEach((item) => {
      item.addEventListener("click", () => {
        item.classList.toggle("is-active");
        updatePricingTotal();
      });
    });

    updatePricingTotal();
  }

  function initGallery() {
    if (!elements.mainImage || elements.thumbs.length === 0) {
      return;
    }

    elements.thumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const src = thumb.dataset.src;
        const alt = thumb.dataset.alt;
        if (!src) {
          return;
        }

        elements.thumbs.forEach((t) => {
          const active = t === thumb;
          t.classList.toggle("is-active", active);
          t.setAttribute("aria-selected", String(active));
        });

        elements.mainImage.classList.add("is-fading");
        window.setTimeout(() => {
          elements.mainImage.src = src;
          if (alt) {
            elements.mainImage.alt = alt;
          }
          elements.mainImage.classList.remove("is-fading");
        }, 120);
      });
    });
  }

  function init() {
    applyDetailType(getDetailType());
    initGallery();
    initPricingOptions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
