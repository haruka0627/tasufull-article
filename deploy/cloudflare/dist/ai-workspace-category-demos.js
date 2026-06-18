/**
 * TASFUL AI Workspace — カテゴリ別デモ（?demo=worker|job|product）
 */
(function (global) {
  "use strict";

  const cross = () => global.TasuAiCrossSearch || {};

  function profile(id) {
    return cross().CATEGORY_PROFILES?.[id] || cross().resolveProfile?.("", id);
  }

  function compareCard(opts) {
    const render = cross().renderCompareCard;
    if (!render) return "";
    return render({
      profile: opts.profile || profile("vendor"),
      ctasHtml: opts.ctasHtml || "",
      ...opts,
    });
  }

  function summary(items, intent, options) {
    const fn = cross().buildComparisonSummaryHtml;
    return fn ? fn(items, "", { intent, ...options }) : "";
  }

  function next(intent, kind) {
    const fn = cross().renderNextSuggestionsHtml;
    return fn ? fn(intent, kind) : "";
  }

  function note() {
    return `<p class="ai-cross-note">※ AIは依頼確定・購入確定・応募確定・決済・個人情報送信・取引完了・レビュー投稿は行いません。詳細ページからご確認ください。</p>`;
  }

  function workerCtas() {
    return (
      `<a class="ai-cross-cta" href="detail-worker.html">詳細を見る</a>` +
      `<a class="ai-cross-cta ai-cross-cta--gold" href="detail-worker.html">依頼相談へ進む</a>`
    );
  }

  function jobCtas() {
    return (
      `<a class="ai-cross-cta" href="detail-job.html">求人を見る</a>` +
      `<a class="ai-cross-cta ai-cross-cta--gold" href="detail-job.html">応募ページへ進む</a>`
    );
  }

  function productCtas() {
    return (
      `<a class="ai-cross-cta" href="detail-product.html">商品を見る</a>` +
      `<a class="ai-cross-cta ai-cross-cta--gold" href="detail-product.html">購入ページへ進む</a>`
    );
  }

  function workerSearchHtml() {
    const items = [
      { title: "山田 太郎", compareMetrics: { rating: 5, trackRecord: 5, categoryFit: 5, availability: 4, response: 5 } },
      { title: "佐藤 花子", compareMetrics: { rating: 4, trackRecord: 4, categoryFit: 5, availability: 5, response: 4 } },
      { title: "田中 健", compareMetrics: { rating: 4, trackRecord: 5, categoryFit: 4, availability: 4, response: 3 } },
    ];
    const p = profile("worker");
    return (
      `<div class="ai-cross-intro"><p>大阪府で引っ越し・荷物運びに対応できるワーカー候補を整理しました。 <span class="ai-cross-intent">（候補比較）</span></p></div>` +
      compareCard({
        rank: 1,
        title: "山田 太郎",
        profile: p,
        metrics: { rating: 5, trackRecord: 5, categoryFit: 5, availability: 4, response: 5 },
        matchScore: 91,
        comparePoint: "引っ越し・搬入の実績が多く、初回返信が早い傾向があります。",
        metaBlock:
          `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
          `<li><span>対応カテゴリ</span> 引っ越し・搬入</li>` +
          `<li><span>地域</span> 大阪府全域</li>` +
          `<li><span>料金目安</span> 3,500円/時〜</li></ul>`,
        desc: "2名体制での搬入対応可。土日稼働の記載あり。",
        ctasHtml: workerCtas(),
      }) +
      compareCard({
        rank: 2,
        title: "佐藤 花子",
        profile: p,
        metrics: { rating: 4, trackRecord: 4, categoryFit: 5, availability: 5, response: 4 },
        matchScore: 86,
        comparePoint: "土日稼働の空きが多く、短時間の作業依頼に向く候補です。",
        metaBlock:
          `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
          `<li><span>対応カテゴリ</span> 引っ越し・片付け</li>` +
          `<li><span>地域</span> 大阪市・堺市</li>` +
          `<li><span>料金目安</span> 3,000円/時〜</li></ul>`,
        desc: "女性スタッフ対応可。家具の組み立て実績あり。",
        ctasHtml: workerCtas(),
      }) +
      compareCard({
        rank: 3,
        title: "田中 健",
        profile: p,
        metrics: { rating: 4, trackRecord: 5, categoryFit: 4, availability: 4, response: 3 },
        matchScore: 84,
        comparePoint: "大型荷物の搬入実績が豊富で、条件整理後も比較対象に残る候補です。",
        metaBlock:
          `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
          `<li><span>対応カテゴリ</span> 搬入・力仕事</li>` +
          `<li><span>地域</span> 大阪府</li>` +
          `<li><span>料金目安</span> 4,000円/時〜</li></ul>`,
        desc: "トラック手配の相談可。平日夕方以降の対応記載あり。",
        ctasHtml: workerCtas(),
      }) +
      summary(items, "worker_request", { countLabel: "3名" }) +
      next("worker_request", "worker") +
      note()
    );
  }

  function workerNarrowedHtml() {
    return (
      `<div class="ai-cross-intro"><p>土日対応・2名体制で候補を絞り込み、条件一致度を更新しました。</p></div>` +
      `<section class="ai-search-summary ai-compare-result">` +
      `<h3 class="ai-search-summary__title">整理結果</h3>` +
      `<p>土日対応を重視する場合、<strong>佐藤 花子</strong>の稼働状況が有利な傾向があります。</p>` +
      `<p>2名体制・搬入実績を重視する場合、<strong>山田 太郎</strong>の比較ポイントが一致しやすいです。</p>` +
      `<p class="ai-compare-result__note">最終判断は利用者自身で行ってください。</p>` +
      `</section>`
    );
  }

  function workerCompletionHtml() {
    return (
      `<div class="ai-search-summary ai-completion-summary">` +
      `<p><strong>✓ TASFUL AIが支援した内容</strong></p>` +
      `<ul class="ai-completion-summary__list">` +
      `<li>ワーカー検索</li><li>条件整理</li><li>候補比較</li>` +
      `<li>依頼文作成</li><li>稼働条件の整理</li>` +
      `</ul>` +
      `<p class="ai-completion-summary__done"><strong>完了：</strong>山田 太郎への依頼文を作成し、土曜午前の作業候補日を整理しました（利用者判断）。</p>` +
      `</div>`
    );
  }

  function buildWorker() {
    const request = global.TasuAiGenerateUi?.buildResponse?.(
      "inquiry",
      "引っ越し手伝いの依頼文を作って。山田太郎に土曜午前でお願いしたい"
    );
    return [
      { role: "user", content: "引っ越しの手伝いができるワーカーを探したい" },
      { role: "assistant", content: "ワーカー候補の整理から進めます。対応エリアを教えてください。" },
      { role: "user", content: "大阪府で探したい" },
      {
        role: "assistant",
        content: "大阪府で引っ越し・搬入に対応できるワーカー候補を整理しました。",
        html: workerSearchHtml(),
        search_used: true,
      },
      { role: "user", content: "土日対応で、2名体制でお願いできる人に絞りたい" },
      {
        role: "assistant",
        content: "土日対応・2名体制を条件に、比較観点を整理しました。",
        html: workerNarrowedHtml(),
      },
      { role: "user", content: "候補を比較して、どんな傾向があるか教えて" },
      {
        role: "assistant",
        content:
          "条件比較の結果です。\n\n・評価・実績重視：山田 太郎\n・土日稼働重視：佐藤 花子\n・大型搬入重視：田中 健\n\n最終判断はご自身で行ってください。",
      },
      { role: "user", content: "山田太郎への依頼文を作って。土曜午前で" },
      {
        role: "assistant",
        content: request?.plain || "依頼文を作成しました。",
        html: request?.html || "",
      },
      { role: "user", content: "ここまでの流れをまとめて" },
      {
        role: "assistant",
        content: "検索から依頼文作成まで、TASFUL AIが支援した内容を整理しました。",
        html: workerCompletionHtml(),
      },
    ];
  }

  function jobSearchHtml() {
    const items = [
      { title: "ABC物流｜倉庫スタッフ", compareMetrics: { jobType: 5, salary: 5, location: 5, employment: 4, remote: 2 } },
      { title: "関西配送センター｜ピッキング", compareMetrics: { jobType: 4, salary: 4, location: 5, employment: 5, remote: 2 } },
      { title: "大阪メンテ｜設備保全", compareMetrics: { jobType: 4, salary: 5, location: 4, employment: 4, remote: 3 } },
    ];
    const p = profile("job");
    return (
      `<div class="ai-cross-intro"><p>大阪府の倉庫・物流系求人を条件比較用に整理しました。 <span class="ai-cross-intent">（候補比較）</span></p></div>` +
      compareCard({
        rank: 1,
        title: "ABC物流｜倉庫スタッフ",
        profile: p,
        metrics: { jobType: 5, salary: 5, location: 5, employment: 4, remote: 2 },
        matchScore: 90,
        comparePoint: "倉庫作業の職種一致度が高く、給与レンジが条件に近い募集です。",
        metaBlock:
          `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
          `<li><span>職種</span> 倉庫・物流</li>` +
          `<li><span>給与</span> 月給25万〜30万円</li>` +
          `<li><span>勤務地</span> 大阪府東大阪市</li>` +
          `<li><span>雇用形態</span> 正社員</li></ul>`,
        desc: "未経験可。シフト相談可。",
        ctasHtml: jobCtas(),
      }) +
      compareCard({
        rank: 2,
        title: "関西配送センター｜ピッキング",
        profile: p,
        metrics: { jobType: 4, salary: 4, location: 5, employment: 5, remote: 2 },
        matchScore: 85,
        comparePoint: "アルバイト・パート枠があり、勤務地が大阪市内中心の候補です。",
        metaBlock:
          `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
          `<li><span>職種</span> ピッキング</li>` +
          `<li><span>給与</span> 時給1,200円〜</li>` +
          `<li><span>勤務地</span> 大阪市</li>` +
          `<li><span>雇用形態</span> アルバイト</li></ul>`,
        desc: "週3日〜OK。土日勤務歓迎。",
        ctasHtml: jobCtas(),
      }) +
      compareCard({
        rank: 3,
        title: "大阪メンテ｜設備保全",
        profile: p,
        metrics: { jobType: 4, salary: 5, location: 4, employment: 4, remote: 3 },
        matchScore: 83,
        comparePoint: "給与水準は高め。設備保全の経験がある場合に比較しやすい候補です。",
        metaBlock:
          `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
          `<li><span>職種</span> 設備保全</li>` +
          `<li><span>給与</span> 月給28万〜35万円</li>` +
          `<li><span>勤務地</span> 大阪府堺市</li>` +
          `<li><span>雇用形態</span> 正社員</li></ul>`,
        desc: "資格保有者優遇。一部リモート相談可。",
        ctasHtml: jobCtas(),
      }) +
      summary(items, "job_search", { countLabel: "3件" }) +
      next("job_search", "job") +
      note()
    );
  }

  function jobCompletionHtml() {
    return (
      `<div class="ai-search-summary ai-completion-summary">` +
      `<p><strong>✓ TASFUL AIが支援した内容</strong></p>` +
      `<ul class="ai-completion-summary__list">` +
      `<li>求人検索</li><li>条件整理</li><li>候補比較</li>` +
      `<li>応募文作成</li><li>職務経歴の整理</li>` +
      `</ul>` +
      `<p class="ai-completion-summary__done"><strong>完了：</strong>ABC物流への応募文を作成し、比較材料を整理しました（利用者判断）。</p>` +
      `</div>`
    );
  }

  function buildJob() {
    const apply = global.TasuAiGenerateUi?.buildResponse?.(
      "resume",
      "ABC物流の倉庫スタッフ求人への応募文を作って"
    );
    return [
      { role: "user", content: "倉庫作業の求人を探したい" },
      { role: "assistant", content: "求人候補の整理から進めます。希望の勤務地を教えてください。" },
      { role: "user", content: "大阪府で、月給25万円以上を希望" },
      {
        role: "assistant",
        content: "大阪府・月給25万円以上の倉庫・物流系求人を整理しました。",
        html: jobSearchHtml(),
        search_used: true,
      },
      { role: "user", content: "正社員で比較したい。リモート可否も含めて整理して" },
      {
        role: "assistant",
        content:
          "正社員枠に絞った比較です。\n\n・給与・職種一致：ABC物流\n・勤務地の柔軟性：関西配送センター\n・給与水準：大阪メンテ\n\n最終判断はご自身で行ってください。",
      },
      { role: "user", content: "ABC物流への応募文を作って" },
      {
        role: "assistant",
        content: apply?.plain || "応募文を作成しました。",
        html: apply?.html || "",
      },
      { role: "user", content: "ここまでまとめて" },
      {
        role: "assistant",
        content: "求人検索から応募文作成まで、TASFUL AIが支援した内容を整理しました。",
        html: jobCompletionHtml(),
      },
    ];
  }

  function productSearchHtml() {
    const items = [
      { title: "クリーンエアー Pro 300", compareMetrics: { price: 5, features: 5, warranty: 4, rating: 5 } },
      { title: "フィルター長持ち 250", compareMetrics: { price: 4, features: 4, warranty: 5, rating: 4 } },
      { title: "静音モデル AirQuiet 200", compareMetrics: { price: 4, features: 4, warranty: 4, rating: 4 } },
    ];
    const p = profile("product");
    return (
      `<div class="ai-cross-intro"><p>予算3万円以内の空気清浄機候補を比較用に整理しました。 <span class="ai-cross-intent">（商品比較）</span></p></div>` +
      compareCard({
        rank: 1,
        title: "クリーンエアー Pro 300",
        profile: p,
        metrics: { price: 5, features: 5, warranty: 4, rating: 5 },
        matchScore: 92,
        comparePoint: "適用畳数・消臭機能の記載があり、予算内で評価が高い候補です。",
        metaBlock:
          `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
          `<li><span>価格</span> 28,800円</li>` +
          `<li><span>カテゴリ</span> 空気清浄機</li>` +
          `<li><span>店舗</span> 家電ショップA</li></ul>`,
        desc: "25畳対応。HEPAフィルター付き。",
        ctasHtml: productCtas(),
      }) +
      compareCard({
        rank: 2,
        title: "フィルター長持ち 250",
        profile: p,
        metrics: { price: 4, features: 4, warranty: 5, rating: 4 },
        matchScore: 87,
        comparePoint: "フィルター交換コストの記載が明確で、保証期間が長い候補です。",
        metaBlock:
          `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
          `<li><span>価格</span> 26,500円</li>` +
          `<li><span>カテゴリ</span> 空気清浄機</li>` +
          `<li><span>店舗</span> 家電ショップB</li></ul>`,
        desc: "20畳対応。フィルター1年保証。",
        ctasHtml: productCtas(),
      }) +
      compareCard({
        rank: 3,
        title: "静音モデル AirQuiet 200",
        profile: p,
        metrics: { price: 4, features: 4, warranty: 4, rating: 4 },
        matchScore: 84,
        comparePoint: "寝室利用を想定した静音性の記載があり、比較検討に向く候補です。",
        metaBlock:
          `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
          `<li><span>価格</span> 24,900円</li>` +
          `<li><span>カテゴリ</span> 空気清浄機</li>` +
          `<li><span>店舗</span> 家電ショップC</li></ul>`,
        desc: "18畳対応。夜間モード搭載。",
        ctasHtml: productCtas(),
      }) +
      summary(items, "product_search", { countLabel: "3商品" }) +
      next("product_search", "product") +
      note()
    );
  }

  function productCompareHtml() {
    return (
      `<section class="ai-search-summary ai-compare-result">` +
      `<h3 class="ai-search-summary__title">整理結果</h3>` +
      `<p>価格重視なら <strong>静音モデル AirQuiet 200</strong></p>` +
      `<p>保証重視なら <strong>フィルター長持ち 250</strong></p>` +
      `<p>評価・機能重視なら <strong>クリーンエアー Pro 300</strong></p>` +
      `<p class="ai-compare-result__note">購入の最終判断は利用者自身で行ってください。</p>` +
      `</section>`
    );
  }

  function productCompletionHtml() {
    return (
      `<div class="ai-search-summary ai-completion-summary">` +
      `<p><strong>✓ TASFUL AIが支援した内容</strong></p>` +
      `<ul class="ai-completion-summary__list">` +
      `<li>商品検索</li><li>条件整理</li><li>商品比較</li>` +
      `<li>比較表の整理</li><li>問い合わせ文作成</li>` +
      `</ul>` +
      `<p class="ai-completion-summary__done"><strong>完了：</strong>3商品の比較材料と問い合わせ文を整理しました（利用者判断）。</p>` +
      `</div>`
    );
  }

  function buildProduct() {
    const inquiry = global.TasuAiGenerateUi?.buildResponse?.(
      "inquiry",
      "クリーンエアー Pro 300について在庫と配送日を問い合わせる文を作って"
    );
    return [
      { role: "user", content: "空気清浄機を比較したい" },
      { role: "assistant", content: "商品比較の整理から進めます。予算や用途を教えてください。" },
      { role: "user", content: "予算3万円以内、25畳くらいの部屋用" },
      {
        role: "assistant",
        content: "予算3万円以内・25畳前後向けの空気清浄機候補を整理しました。",
        html: productSearchHtml(),
        search_used: true,
      },
      { role: "user", content: "価格・保証・評価で比較表を整理して" },
      {
        role: "assistant",
        content: "3商品を価格・保証・評価の観点で比較しました。",
        html: productCompareHtml(),
      },
      { role: "user", content: "クリーンエアー Pro 300への問い合わせ文を作って" },
      {
        role: "assistant",
        content: inquiry?.plain || "問い合わせ文を作成しました。",
        html: inquiry?.html || "",
      },
      { role: "user", content: "ここまでまとめて" },
      {
        role: "assistant",
        content: "商品比較から問い合わせ文作成まで、TASFUL AIが支援した内容を整理しました。",
        html: productCompletionHtml(),
      },
    ];
  }

  global.TasuAiCategoryDemos = {
    buildWorker,
    buildJob,
    buildProduct,
  };
})(typeof window !== "undefined" ? window : globalThis);
