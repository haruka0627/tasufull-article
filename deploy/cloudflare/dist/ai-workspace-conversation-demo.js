/**
 * TASFUL AI Workspace — 長い会話履歴デモ（?demo=conversation）
 */
(function (global) {
  "use strict";

  const cross = () => global.TasuAiCrossSearch || {};

  function demoCtas() {
    return (
      `<a class="ai-cross-cta" href="detail-worker.html">詳細を見る</a>` +
      `<a class="ai-cross-cta ai-cross-cta--gold" href="detail-worker.html">問い合わせへ進む</a>`
    );
  }

  function compareCard(rank, title, category, region, price, desc, point, metrics, matchScore) {
    const metaBlock =
      `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
      `<li><span>カテゴリ</span> ${category}</li>` +
      `<li><span>地域</span> ${region}</li>` +
      `<li><span>料金</span> ${price}</li>` +
      `</ul>`;
    const render = cross().renderCompareCard;
    if (render) {
      return render({
        rank,
        title,
        metrics,
        matchScore,
        comparePoint: point,
        metaBlock,
        desc,
        ctasHtml: demoCtas(),
        profile: cross().CATEGORY_PROFILES?.vendor || cross().resolveProfile?.("service_request", "business_service"),
      });
    }
    return `<article class="ai-cross-card" data-ai-cross-card><p>${title}</p></article>`;
  }

  function vendorSearchHtml() {
    const summary = cross().buildComparisonSummaryHtml
      ? cross().buildComparisonSummaryHtml(
          [
            { title: "堺グリーンケア", compareMetrics: { budget: 5, schedule: 5, response: 5, review: 4 } },
            { title: "大阪便利サービス", compareMetrics: { budget: 4, schedule: 5, response: 3, review: 4 } },
            { title: "みどりサポート", compareMetrics: { budget: 5, schedule: 4, response: 4, review: 4 } },
          ],
          "",
          { countLabel: "3社", weekendPick: "大阪便利サービス" }
        )
      : "";
    const next = cross().renderNextSuggestionsHtml ? cross().renderNextSuggestionsHtml() : "";
    return (
      `<div class="ai-cross-intro"><p>大阪府で草刈りに対応できる候補を条件比較用に整理しました。 <span class="ai-cross-intent">（候補比較）</span></p></div>` +
      compareCard(
        1,
        "堺グリーンケア",
        "草刈り・庭管理",
        "大阪府堺市",
        "15,000円〜",
        "一般家庭の草刈りから空き地管理まで対応。見積り無料で当日連絡も可能です。",
        "堺市エリアでの実績が多く、初回相談の返信が早い傾向があります。",
        { budget: 5, schedule: 5, response: 5, review: 4 },
        92
      ) +
      compareCard(
        2,
        "大阪便利サービス",
        "草刈り・剪定",
        "大阪府大阪市",
        "18,000円〜",
        "刈り込み1箇所まで対応可能。作業後の清掃まで含むプランあり。",
        "土日対応の記載があり、刈り込み対応の条件に近い候補です。",
        { budget: 4, schedule: 5, response: 3, review: 4 },
        85
      ) +
      compareCard(
        3,
        "みどりサポート",
        "便利屋・草刈り",
        "大阪府全域",
        "12,000円〜",
        "小規模案件も歓迎。駐車スペースが限られる現場にも柔軟に対応。",
        "料金帯が抑えめで、予算条件との一致度が高い候補です。",
        { budget: 5, schedule: 4, response: 4, review: 4 },
        87
      ) +
      summary +
      next +
      `<p class="ai-cross-note">※ AIは依頼確定・購入確定・応募確定・決済・個人情報送信・取引完了・レビュー投稿は行いません。電話・チャット・詳細ページからご確認ください。</p>`
    );
  }

  function narrowedSearchHtml() {
    const summary = cross().buildComparisonSummaryHtml
      ? cross().buildComparisonSummaryHtml(
          [
            { title: "堺グリーンケア", compareMetrics: { budget: 5, schedule: 5, response: 5, review: 4 } },
            { title: "大阪便利サービス", compareMetrics: { budget: 4, schedule: 5, response: 3, review: 4 } },
          ],
          "",
          { countLabel: "2社", weekendPick: "大阪便利サービス" }
        )
      : "";
    return (
      `<div class="ai-cross-intro"><p>平日対応・予算3万円以内・堺市近郊で候補を絞り込み、条件一致度を整理しました。 <span class="ai-cross-intent">（条件比較結果）</span></p></div>` +
      compareCard(
        1,
        "堺グリーンケア",
        "草刈り・庭管理",
        "堺市・近郊",
        "15,000〜28,000円",
        "平日午前・午後枠あり。50㎡前後の庭なら概算見積りが当日中に届くケースが多いです。",
        "予算内に収まりやすく、平日対応の記載がある候補です。",
        { budget: 5, schedule: 5, response: 5, review: 4 },
        92
      ) +
      compareCard(
        2,
        "大阪便利サービス",
        "草刈り・剪定",
        "堺市南部",
        "18,000〜30,000円",
        "刈り込み1箇所込みの作業プランあり。作業報告写真付き。",
        "刈り込み対応の記載があり、条件整理後も比較対象に残る候補です。",
        { budget: 4, schedule: 5, response: 3, review: 4 },
        85
      ) +
      summary +
      `<p class="ai-cross-note">※ AIは依頼確定・購入確定・応募確定・決済・個人情報送信・取引完了・レビュー投稿は行いません。電話・チャット・詳細ページからご確認ください。</p>`
    );
  }

  function comparisonHtml() {
    return (
      `<div class="ai-cross-intro"><p>候補2社を料金・評価・対応速度の観点で比較しました。</p></div>` +
      `<section class="ai-search-summary ai-compare-result">` +
      `<h3 class="ai-search-summary__title">整理結果</h3>` +
      `<p>今回の条件では<br>2社とも対応可能です。</p>` +
      `<p>予算重視なら<br><strong>堺グリーンケア</strong></p>` +
      `<p>土日対応重視なら<br><strong>大阪便利サービス</strong></p>` +
      `<p>返信速度重視なら<br><strong>堺グリーンケア</strong></p>` +
      `<p>という傾向があります。</p>` +
      `<p class="ai-compare-result__note">最終判断は利用者自身で行ってください。</p>` +
      `</section>`
    );
  }

  function vendorReplyHtml() {
    return (
      `<div class="ai-cross-intro"><p>問い合わせ送信後、2社から返信が届いた想定で内容を整理しました。</p></div>` +
      `<div class="ai-search-summary">` +
      `<p><strong>堺グリーンケア（返信）</strong><br>` +
      `・見積り：24,800円（税込）<br>` +
      `・作業日候補：6/18（水）午前 / 6/20（金）午後<br>` +
      `・作業時間目安：2.5時間<br>` +
      `・刈り込み1箇所込み、作業後清掃あり</p>` +
      `<p><strong>大阪便利サービス（返信）</strong><br>` +
      `・見積り：27,500円（税込）<br>` +
      `・作業日候補：6/19（木）午前 / 6/21（土）午前<br>` +
      `・作業時間目安：3時間<br>` +
      `・作業報告写真と簡易アフター報告あり</p>` +
      `</div>`
    );
  }

  function quoteComparisonHtml() {
    return (
      `<div class="ai-cross-intro"><p>返信見積りを料金・日程・作業内容で比較しました。</p></div>` +
      `<section class="ai-search-summary ai-compare-result">` +
      `<h3 class="ai-search-summary__title">整理結果</h3>` +
      `<p><strong>料金</strong> — 堺グリーンケア 24,800円 / 大阪便利サービス 27,500円。予算3万円内は両社ともクリア。</p>` +
      `<p><strong>日程</strong> — 平日希望なら堺グリーンケアが 6/18（水）・6/20（金）で有利。土曜対応が必要なら大阪便利サービスも選択肢。</p>` +
      `<p><strong>作業内容</strong> — 両社とも刈り込み1箇所込み。堺グリーンケアは作業時間が短め、大阪便利サービスは報告資料が手厚い。</p>` +
      `<p class="ai-compare-result__note">どちらを選ぶかは、予算・日程・報告の重視度をもとにご自身で判断してください。</p>` +
      `</section>`
    );
  }

  function finalDecisionHtml() {
    return (
      `<div class="ai-cross-intro"><p>ご指定の候補で進める場合の次のアクションを整理しました。</p></div>` +
      `<div class="ai-search-summary">` +
      `<p><strong>選択候補：堺グリーンケア</strong>（利用者指定）</p>` +
      `<p><strong>整理した判断材料</strong><br>` +
      `・見積り 24,800円で予算内<br>` +
      `・6/18（水）午前の日程が希望に合う<br>` +
      `・初回相談から返信までの速さと評価の高さ</p>` +
      `<p><strong>次のステップ</strong><br>` +
      `1. 6/18（水）午前で作業確定の返信を送る<br>` +
      `2. 駐車スペースと現地入口の情報を共有<br>` +
      `3. 作業前日に最終確認の連絡を受ける</p>` +
      `</div>`
    );
  }

  function workDateConfirmHtml() {
    return (
      `<div class="ai-cross-intro"><p>作業日を確定し、業者への返信内容まで整理しました。</p></div>` +
      `<div class="ai-search-summary">` +
      `<p><strong>作業日確定：6/18（水）午前</strong></p>` +
      `<p><strong>確定内容</strong><br>` +
      `・業者：堺グリーンケア<br>` +
      `・作業内容：草刈り（約50㎡）+ 刈り込み1箇所<br>` +
      `・確定見積り：24,800円（税込）<br>` +
      `・作業時間目安：2.5時間</p>` +
      `<p><strong>送信した返信文（要点）</strong><br>` +
      `6/18（水）午前でお願いします。駐車スペース1台分あり、現地入口は南側の門から入れます。作業前日の最終確認もお願いします。</p>` +
      `<p>この後は作業前日のリマインド整理や、作業後フォローの文面作成も続けて支援できます。</p>` +
      `</div>`
    );
  }

  function completionSummaryHtml() {
    return (
      `<div class="ai-cross-intro"><p>依頼フローが完了しました。これまでの支援内容を整理します。</p></div>` +
      `<div class="ai-search-summary ai-completion-summary">` +
      `<p><strong>✓ TASFUL AIが支援した内容</strong></p>` +
      `<ul class="ai-completion-summary__list">` +
      `<li>業者検索</li>` +
      `<li>条件整理</li>` +
      `<li>候補比較</li>` +
      `<li>問い合わせ文作成</li>` +
      `<li>業者返信整理</li>` +
      `<li>見積比較</li>` +
      `<li>作業日確定</li>` +
      `</ul>` +
      `<p class="ai-completion-summary__done"><strong>完了：</strong>6/18（水）午前、堺グリーンケアで作業予定を確定しました。</p>` +
      `</div>`
    );
  }

  function build() {
    const inquiry = global.TasuAiGenerateUi?.buildResponse?.(
      "inquiry",
      "堺グリーンケアへの草刈り見積り問い合わせ文を作って"
    );
    const inquiryPolite = global.TasuAiGenerateUi?.buildResponse?.(
      "inquiry",
      "堺グリーンケアへの草刈り見積り問い合わせ文を作って。もう少し丁寧な文面にして"
    );

    return [
      { role: "user", content: "草刈り業者を探したい" },
      {
        role: "assistant",
        content: "草刈り業者の候補探しから進めます。まずは対応エリアを教えてください。",
      },
      { role: "user", content: "大阪府で探したい" },
      {
        role: "assistant",
        content: "大阪府で草刈りに対応できる候補を条件比較用に整理しました。",
        html: vendorSearchHtml(),
        search_used: true,
      },
      { role: "user", content: "予算は3万円以内で、平日対応できる業者に絞りたい" },
      {
        role: "assistant",
        content:
          "了解しました。予算上限3万円・平日対応を条件に、候補の絞り込み観点を整理します。\n\n・作業面積の目安（約50㎡）\n・刈り込み1箇所の有無\n・希望時期（2週間以内）\n\nこの条件で再検索します。",
      },
      { role: "user", content: "対応エリアは堺市と近郊でお願いします" },
      {
        role: "assistant",
        content: "堺市と近郊エリアで候補を再整理し、条件一致度を更新しました。",
        html: narrowedSearchHtml(),
        search_used: true,
      },
      { role: "user", content: "候補を比較したい。料金・評価・対応速度で教えて" },
      {
        role: "assistant",
        content: "候補2社を料金・評価・対応速度の観点で比較しました。",
        html: comparisonHtml(),
      },
      { role: "user", content: "一番条件に合う業者はどれ？" },
      {
        role: "assistant",
        content:
          "条件比較の結果を整理します。\n\n・予算重視：堺グリーンケアの一致度が高い傾向\n・土日対応重視：大阪便利サービスも選択肢\n・返信速度重視：堺グリーンケアが速い傾向\n\n最終判断はご自身で行ってください。次は問い合わせ文の作成に進めます。",
      },
      { role: "user", content: "堺グリーンケアへの問い合わせ文を作って" },
      {
        role: "assistant",
        content: inquiry?.plain || "問い合わせ文を作成しました。",
        html: inquiry?.html || "",
      },
      { role: "user", content: "もう少し丁寧な文面にして" },
      {
        role: "assistant",
        content: inquiryPolite?.plain || "問い合わせ文を修正しました。",
        html: inquiryPolite?.html || "",
      },
      { role: "user", content: "この文面で送信した想定。返信が来たら整理して" },
      {
        role: "assistant",
        content: "問い合わせ送信後、2社から返信が届いた想定で内容を整理しました。",
        html: vendorReplyHtml(),
      },
      { role: "user", content: "返信の見積りを比較して、どちらが良いか教えて" },
      {
        role: "assistant",
        content: "返信見積りを料金・日程・作業内容で比較しました。",
        html: quoteComparisonHtml(),
      },
      { role: "user", content: "最終的に堺グリーンケアで決めたい。次にやることを整理して" },
      {
        role: "assistant",
        content: "ご指定の候補（堺グリーンケア）で進める場合の次のアクションを整理しました。",
        html: finalDecisionHtml(),
      },
      { role: "user", content: "6/18（水）午前で作業日を確定したい。返信文も整えて" },
      {
        role: "assistant",
        content: "作業日を6/18（水）午前で確定し、業者への返信内容まで整理しました。",
        html: workDateConfirmHtml(),
      },
      { role: "user", content: "ここまでの流れをまとめて" },
      {
        role: "assistant",
        content:
          "依頼フローが完了しました。検索から作業日確定まで、TASFUL AIが支援した内容を整理しました。",
        html: completionSummaryHtml(),
      },
    ];
  }

  global.TasuAiConversationDemo = { build };
})(typeof window !== "undefined" ? window : globalThis);
