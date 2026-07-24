/**
 * Builder — 業者ページ AI文章生成 mock（API 未接続）
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  /**
   * @param {{ companyName?: string, tradesText?: string, areasText?: string, achievements?: string, priceGuide?: string }} input
   */
  function generateCopy(input) {
    const company = pickStr(input?.companyName, "当社");
    const trades = pickStr(input?.tradesText, "内装・設備");
    const areas = pickStr(input?.areasText, "関東エリア");
    const achievements = pickStr(input?.achievements, "多数の施工実績");
    const price = pickStr(input?.priceGuide, "要見積");

    const intro =
      `${company}は、${areas}を中心に${trades}のご依頼に対応しています。` +
      `現場調整から施工完了まで、TASFUL Talk で丁寧にご報告します。`;

    const strengths =
      `・${areas}での迅速対応\n` +
      `・${trades}に特化した専門チーム\n` +
      `・見積〜施工後フォローまで一貫サポート\n` +
      `・安全・品質を最優先した現場管理`;

    const seoDescription =
      `${company}の公式ページ。${areas}で${trades}を提供。${achievements}。料金目安: ${price}。TASFUL Builder から相談・見積依頼が可能です。`;

    const seoTitle = `${company} | ${trades} | ${areas}`;

    return {
      ok: true,
      source: "mock",
      intro,
      strengths,
      seoDescription,
      seoTitle,
    };
  }

  global.TasuBuilderVendorPagesAiMock = {
    generateCopy,
  };
})(typeof window !== "undefined" ? window : globalThis);
