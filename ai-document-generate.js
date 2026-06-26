/**
 * TASFUL AI — Document Generator（Markdown テンプレート · 将来 PDF/PPT）
 */
(function (global) {
  "use strict";

  const DOC_TYPES = Object.freeze([
    { id: "pdf", label: "PDF", outputFormat: "markdown" },
    { id: "proposal", label: "提案書", outputFormat: "markdown" },
    { id: "plan", label: "企画書", outputFormat: "markdown" },
    { id: "minutes", label: "議事録", outputFormat: "markdown" },
    { id: "estimate", label: "見積資料", outputFormat: "markdown" },
    { id: "presentation", label: "プレゼン資料", outputFormat: "markdown" },
    { id: "manual", label: "マニュアル", outputFormat: "markdown" },
  ]);

  function esc(s) {
    return String(s ?? "").trim();
  }

  function section(title, body) {
    return `## ${title}\n\n${body}\n`;
  }

  function buildProposalMd(topic, detail) {
    const t = esc(topic) || "ご提案テーマ";
    const d = esc(detail) || "（詳細は入力内容に基づき追記）";
    return (
      `# 提案書\n\n` +
      `**件名:** ${t}\n\n` +
      section("1. 背景", `${d}\n\n現状の課題と改善の必要性を整理します。`) +
      section("2. 目的", "本提案のゴールと期待効果を明確化します。") +
      section("3. 提案内容", `- スコープ\n- スケジュール\n- 体制\n\n${d}`) +
      section("4. 費用・条件", "見積条件 · 支払条件 · 前提条件を記載します。") +
      section("5. 次のステップ", "1. 要件確認\n2. 見積確定\n3. 契約・着手") +
      `\n---\n*出力: Markdown → 将来 PDF 変換*\n`
    );
  }

  function buildPlanMd(topic, detail) {
    const t = esc(topic) || "企画タイトル";
    return (
      `# 企画書\n\n` +
      `## 企画名\n${t}\n\n` +
      section("概要", esc(detail) || "企画の背景と狙い") +
      section("ターゲット", "対象ユーザー · 地域 · 利用シーン") +
      section("施策", "1. 準備\n2. 実施\n3. 評価") +
      section("KPI", "- リード数\n- 成約率\n- 満足度") +
      `\n---\n*Markdown → PDF（将来）*\n`
    );
  }

  function buildMinutesMd(topic, detail) {
    const now = new Date().toISOString().slice(0, 10);
    return (
      `# 議事録\n\n` +
      `- 日付: ${now}\n` +
      `- 件名: ${esc(topic) || "定例ミーティング"}\n\n` +
      section("参加者", "（記入）") +
      section("議題", esc(detail) || "1. 前回フォロー\n2. 本日の議題\n3. 次回まで") +
      section("決定事項", "- ") +
      section("アクション", "| 担当 | 内容 | 期限 |\n| --- | --- | --- |\n| | | |") +
      `\n---\n*Markdown → PDF（将来）*\n`
    );
  }

  function buildEstimateMd(topic, detail) {
    return (
      `# 見積資料\n\n` +
      `**案件名:** ${esc(topic) || "作業見積"}\n\n` +
      section("作業概要", esc(detail) || "作業内容の概要") +
      section("見積内訳", "| 項目 | 数量 | 単価 | 金額 |\n| --- | ---: | ---: | ---: |\n| 作業費 | 1 | — | — |\n| 諸経費 | — | — | — |") +
      section("合計", "（税抜 · 税込を明記）") +
      section("備考", "有効期限 · 前提条件 · 除外事項") +
      `\n---\n*Markdown → PDF（将来）*\n`
    );
  }

  function buildPresentationMd(topic, detail) {
    const t = esc(topic) || "プレゼンテーション";
    return (
      `# ${t}\n\n` +
      `<!-- スライド構成（Markdown） -->\n\n` +
      `---\n\n## スライド1: 表紙\n${t}\n\n---\n\n` +
      `## スライド2: 課題\n${esc(detail) || "現状の課題"}\n\n---\n\n` +
      `## スライド3: 解決策\n提案の要点\n\n---\n\n` +
      `## スライド4: まとめ\n次のアクション\n\n---\n*将来 PPT / PDF エクスポート*\n`
    );
  }

  function buildManualMd(topic, detail) {
    return (
      `# マニュアル\n\n` +
      `**対象:** ${esc(topic) || "業務手順"}\n\n` +
      section("目的", "本マニュアルの目的と適用範囲") +
      section("前提", "必要な権限 · ツール · 安全上の注意") +
      section("手順", esc(detail) || "1. 準備\n2. 実行\n3. 確認\n4. 報告") +
      section("トラブルシュート", "よくある問題と対処") +
      `\n---\n*Markdown → PDF（将来）*\n`
    );
  }

  function buildPdfMd(topic, detail) {
    return buildProposalMd(topic, detail).replace(/^# 提案書/, "# PDF出力用資料");
  }

  const BUILDERS = {
    pdf: buildPdfMd,
    proposal: buildProposalMd,
    plan: buildPlanMd,
    minutes: buildMinutesMd,
    estimate: buildEstimateMd,
    presentation: buildPresentationMd,
    manual: buildManualMd,
  };

  /**
   * @param {{ type?: string, topic?: string, detail?: string, prompt?: string }} opts
   */
  function generate(opts) {
    const o = opts || {};
    const type = String(o.type || "proposal").trim();
    const def = DOC_TYPES.find((d) => d.id === type) || DOC_TYPES[1];
    const topic = o.topic || o.prompt || "";
    const detail = o.detail || o.prompt || "";
    const builder = BUILDERS[def.id] || buildProposalMd;
    const markdown = builder(topic, detail);
    return {
      ok: true,
      type: def.id,
      typeLabel: def.label,
      outputFormat: "markdown",
      futureFormats: ["pdf", "ppt"],
      markdown,
      preview: markdown.slice(0, 280),
      message: `【${def.label}】Markdown テンプレートを生成しました（PDF変換は将来対応）`,
    };
  }

  global.TasuAiDocumentGenerate = {
    DOC_TYPES,
    generate,
  };
})(typeof window !== "undefined" ? window : globalThis);
