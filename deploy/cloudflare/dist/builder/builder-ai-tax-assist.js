/**
 * Builder AI — 個人事業主・確定申告整理補助（税額断定なし）
 */
(function (global) {
  "use strict";

  const ACTION_ID = "sole_prop_tax_assist";

  const TAX_FIELDS = Object.freeze([
    { key: "filingType", label: "申告区分", patterns: [/白色申告/i, /青色申告/i] },
    { key: "sales", label: "売上", patterns: [/売上[:：\s]*([\d,]+)/i, /売上高[:：\s]*([\d,]+)/i] },
    { key: "expenses", label: "経費", patterns: [/経費[:：\s]*([\d,]+)/i, /経費合計[:：\s]*([\d,]+)/i] },
    { key: "invoiceReg", label: "インボイス登録", patterns: [/インボイス(?:登録)?[:：\s]*([^\n]+)/i, /登録番号[:：\s]*([^\n]+)/i] },
    { key: "consumptionTax", label: "消費税", patterns: [/消費税(?:課税|免税)[:：\s]*([^\n]+)/i, /課税事業者/i, /免税事業者/i] },
    { key: "homeOffice", label: "家事按分", patterns: [/家事按分[:：\s]*([^\n]+)/i, /按分[:：\s]*([^\n]+)/i] },
    { key: "subcontract", label: "外注費", patterns: [/外注[:：\s]*([\d,]+)/i] },
    { key: "materials", label: "材料費", patterns: [/材料[:：\s]*([\d,]+)/i] },
    { key: "transport", label: "交通費", patterns: [/交通費[:：\s]*([\d,]+)/i] },
    { key: "communication", label: "通信費", patterns: [/通信費[:：\s]*([\d,]+)/i] },
    { key: "vehicle", label: "車両費", patterns: [/車両[:：\s]*([\d,]+)/i, /ガソリン[:：\s]*([\d,]+)/i] },
  ]);

  const EXPENSE_CATEGORIES = Object.freeze([
    "外注費",
    "材料費",
    "交通費",
    "通信費",
    "車両費（ガソリン・修繕・減価償却）",
    "工具・消耗品",
    "事務用品",
    "広告宣伝費",
    "地代家賃（事業按分）",
    "水道光熱費（家事按分）",
    "接待交際費",
    "会議費",
    "研修・資格取得",
    "保険料",
    "支払手数料",
  ]);

  const ACCOUNT_HINTS = Object.freeze([
    "売上高",
    "外注工賃",
    "材料費",
    "旅費交通費",
    "通信費",
    "車両費",
    "消耗品費",
    "地代家賃",
    "水道光熱費",
    "減価償却費",
    "雑費",
  ]);

  function extractParsed(text) {
    const t = String(text || "");
    const out = { topics: [] };
    if (/白色申告/i.test(t)) out.topics.push("white");
    if (/青色申告/i.test(t)) out.topics.push("blue");
    if (/経費|勘定科目/i.test(t)) out.topics.push("expenses");
    if (/家事按分/i.test(t)) out.topics.push("home_office");
    if (/インボイス/i.test(t)) out.topics.push("invoice");
    if (/消費税|課税|免税/i.test(t)) out.topics.push("consumption_tax");
    if (/領収書|請求書/i.test(t)) out.topics.push("receipts");
    if (!out.topics.length) out.topics.push("general");

    TAX_FIELDS.forEach((f) => {
      if (f.key === "filingType") {
        if (/白色申告/i.test(t)) out[f.key] = "白色申告";
        else if (/青色申告/i.test(t)) out[f.key] = "青色申告";
        return;
      }
      for (const p of f.patterns) {
        const m = t.match(p);
        if (m) {
          out[f.key] = m[1] !== undefined ? String(m[1]).trim() : "該当";
          break;
        }
      }
    });
    return out;
  }

  function whiteBlueTable() {
    return [
      "| 項目 | 白色申告（整理） | 青色申告（整理） |",
      "| --- | --- | --- |",
      "| 帳簿 | 簡易な収支内訳書等 | 複式簿記・決算書等（要件あり） |",
      "| 特徴 | 比較的簡易 | 青色申告特別控除等（要件・届出要確認） |",
      "| 確認 | 税理士・税務署 | 税理士・税務署 |",
      "",
      "※制度・控除額は年度により変更されます。**最新情報は税理士・国税庁等で確認**してください。",
    ].join("\n");
  }

  function relatedTools(parsed) {
    const lines = ["- `invoice_tax_calc` — 消費税・税込/税抜の試算（請求確定ではない）"];
    if (parsed.sales || parsed.expenses || /利益|粗利/i.test(JSON.stringify(parsed))) {
      lines.push("- `estimate_profit_calc` — 売上・原価・粗利の整理試算");
    }
    if (parsed.subcontract || parsed.materials) {
      lines.push("- `labor_cost_calc` — 人件費・外注関連の試算");
    }
    return lines.join("\n");
  }

  /**
   * @param {string} userText
   * @param {{ contextText?: string }} [opts]
   */
  function run(userText, opts) {
    const parsed = extractParsed(userText);
    const ctx = String(opts?.contextText || "").trim();

    const body = [
      "【個人事業主・確定申告整理補助 — 下書き】",
      "",
      "## 申告準備チェックリスト",
      "- [ ] 売上・入金の整理（請求書・入金明細）",
      "- [ ] 経費の領収書・請求書の収集",
      "- [ ] 家事按分の根拠メモ（面積・時間・使用量）",
      "- [ ] インボイス登録番号の確認（該当時）",
      "- [ ] 消費税課税/免税の区分確認",
      "- [ ] 青色申告承認申請の要否（該当時）",
      "- [ ] 確定申告書類の提出期限確認",
      "",
      "## 白色 / 青色申告 — 整理表（参考）",
      whiteBlueTable(),
      "",
      "## 入力から読み取った整理項目",
      parsed.filingType ? `- 申告区分: ${parsed.filingType}` : "- 申告区分: （白色/青色を税理士と確認）",
      parsed.sales ? `- 売上（入力値）: ${parsed.sales} ※税額計算はしません` : "- 売上: （帳簿・入金から整理）",
      parsed.expenses ? `- 経費（入力値）: ${parsed.expenses}` : "- 経費: （領収書から科目別に整理）",
      parsed.invoiceReg ? `- インボイス: ${parsed.invoiceReg}` : "- インボイス登録: 有無・登録番号を確認",
      parsed.consumptionTax ? `- 消費税: ${parsed.consumptionTax}` : "- 消費税: 課税/免税・インボイス要件を確認",
      parsed.homeOffice ? `- 家事按分: ${parsed.homeOffice}` : "- 家事按分: 按分割合の根拠をメモ",
      ctx ? `\n## 案件コンテキスト（参考）\n${ctx.slice(0, 600)}` : "",
      "",
      "## 経費候補一覧（勘定科目の整理用）",
      EXPENSE_CATEGORIES.map((c) => `- ${c}`).join("\n"),
      "",
      "## 勘定科目候補（整理用）",
      ACCOUNT_HINTS.map((a) => `- ${a}`).join("\n"),
      "",
      "## 領収書・請求書 確認リスト",
      "- 取引先名称・日付・金額・内容が読み取れるか",
      "- 事業関連性のメモがあるか",
      "- インボイス登録番号（該当取引）",
      "- 家事按分対象経費は按分根拠を添付",
      "",
      "## 税理士に確認すべき項目",
      "- 白色/青色の選択・届出状況",
      "- 消費税の課税/免税・インボイス要件",
      "- 家事按分の妥当性",
      "- 減価償却・専従者給与・青色控除の適用",
      "- 今年度の税制改正の影響",
      "",
      "## 関連 Builder AI アクション（試算連携）",
      relatedTools(parsed),
      "",
      "## 注意事項",
      "- **税額の断定・節税策の断定・脱法助言は行いません。**",
      "- **最終判断は税理士・税務署確認が必要**です。",
      "- 税制・控除要件は変更されるため、**最新情報の確認**が必要です。",
      "- 本出力は申告準備の整理下書きであり、確定申告書の提出代行ではありません。",
    ]
      .filter(Boolean)
      .join("\n");

    return { ok: true, draftBody: body, parsed, actionId: ACTION_ID };
  }

  function isTaxAssistAction(actionId) {
    return actionId === ACTION_ID;
  }

  global.TasuBuilderAITaxAssist = {
    ACTION_ID,
    TAX_FIELDS,
    EXPENSE_CATEGORIES,
    run,
    isTaxAssistAction,
    extractParsed,
  };
})(typeof window !== "undefined" ? window : globalThis);
