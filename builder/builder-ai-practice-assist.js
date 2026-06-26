/**
 * Builder AI — 実務文面・KY・工程・チェックリスト補助（下書きのみ）
 */
(function (global) {
  "use strict";

  const PRACTICE_ACTION_IDS = Object.freeze([
    "document_text_draft",
    "contract_order_draft",
    "safety_ky_checklist",
    "gantt_schedule_draft",
    "before_after_checklist",
  ]);

  function pick(text, patterns) {
    for (const p of patterns) {
      const m = String(text || "").match(p);
      if (m && m[1] !== undefined) return m[1].trim();
    }
    return "";
  }

  function pickNum(text, patterns) {
    const raw = pick(text, patterns);
    if (!raw) return NaN;
    const n = Number(String(raw).replace(/[,，]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }

  function fmtYen(n) {
    if (!Number.isFinite(n)) return "（入力値参照）";
    return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);
  }

  function footer(kind) {
    const lines = [
      "",
      "## 注意事項",
      "- 本出力は【下書き・確認用】です。",
      "- **請求確定・支払確定・契約成立・完了承認・安全保証は行いません。**",
      "- 最終確認は運営または当事者（現場責任者・有資格者）が行ってください。",
    ];
    if (kind === "document") lines.push("- 金額・支払期限は入力値の反映のみです。正式送付前に内容を確認してください。");
    if (kind === "contract") lines.push("- 法的有効性の断定はしません。必要に応じて専門家確認を行ってください。");
    if (kind === "safety") lines.push("- 安全を保証しません。重大リスクはAIだけで判断せず、現場責任者・有資格者に確認してください。");
    return lines.join("\n");
  }

  function detectDocType(text) {
    const t = String(text || "");
    if (/請求書|請求/.test(t)) return "請求書送付";
    if (/領収書|領収/.test(t)) return "領収書送付";
    if (/発注書|発注/.test(t)) return "発注書送付";
    if (/入金確認/.test(t)) return "入金確認";
    if (/催促|支払い催促/.test(t)) return "支払い催促";
    if (/支払い案内|支払案内/.test(t)) return "支払い案内";
    if (/見積/.test(t)) return "見積書送付";
    return "書類送付";
  }

  function runDocumentText(userText, ctx) {
    const docType = detectDocType(userText);
    const client = pick(userText, [/宛先[:：\s]*([^\n,、]+)/i, /(?:様|御中)/]) || "（宛先）";
    const amount = pickNum(userText, [/金額[:：\s]*([\d,]+)/i, /([\d,]+)\s*円/i]);
    const deadline = pick(userText, [/支払期限[:：\s]*([^\n]+)/i, /期限[:：\s]*([^\n]+)/i, /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/]);
    const project = pick(userText, [/案件[:：\s]*([^\n]+)/i, /工事名[:：\s]*([^\n]+)/i]);

    const body = [
      `【${docType}文 — 下書き】`,
      "",
      `${client} 様`,
      "",
      "いつもお世話になっております。",
      `下記のとおり${docType}のご案内です（下書き）。`,
      "",
      project ? `- 件名: ${project}` : "- 件名: （入力または案件コンテキスト参照）",
      Number.isFinite(amount) ? `- 金額（入力値）: ${fmtYen(amount)} ※確定請求ではありません` : "- 金額: （入力値を反映）",
      deadline ? `- 支払期限（入力値）: ${deadline}` : "- 支払期限: （入力値を反映）",
      "",
      "【本文テンプレート】",
      "添付の書類をご確認ください。",
      "ご不明点がございましたらお知らせください。",
      "何卒よろしくお願いいたします。",
      ctx ? `\n## 案件コンテキスト（参考）\n${ctx.slice(0, 500)}` : "",
      footer("document"),
    ]
      .filter(Boolean)
      .join("\n");
    return { ok: true, draftBody: body, docType };
  }

  function runContractOrder(userText, ctx) {
    const t = String(userText || "");
    const sections = [];
    if (/契約前|確認メモ/.test(t)) sections.push("契約前確認メモ");
    if (/発注書/.test(t)) sections.push("発注書文面");
    if (/作業依頼|依頼書/.test(t)) sections.push("作業依頼書文面");
    if (/仕様/.test(t)) sections.push("仕様確認メモ");
    if (/キャンセル/.test(t)) sections.push("キャンセル条件確認");
    if (/追加費用/.test(t)) sections.push("追加費用確認メモ");
    if (!sections.length) sections.push("契約前確認メモ", "発注書文面", "作業依頼書文面");

    const body = [
      "【契約・発注・作業依頼 — 下書き補助】",
      "",
      "## 含めるセクション（案）",
      ...sections.map((s) => `- ${s}`),
      "",
      "## 契約前確認メモ（テンプレート）",
      "- [ ] 工期・範囲・仕様の合意",
      "- [ ] 支払条件（着手金・中間・完了）",
      "- [ ] 変更協議のルール",
      "- [ ] 保証・瑕疵対応の確認",
      "- [ ] 下請け・再委託の有無",
      "",
      "## 発注書 / 作業依頼書（文面骨子）",
      "- 発注者・受注者",
      "- 作業内容・仕様",
      "- 工期・納期",
      "- 金額（参考・未確定）",
      "- 安全・近隣配慮",
      "",
      "## キャンセル / 追加費用",
      "- キャンセル条件: （協議・契約書で確認）",
      "- 追加費用: 仕様変更時は事前協議",
      ctx ? `\n## 案件コンテキスト\n${ctx.slice(0, 600)}` : "",
      footer("contract"),
    ].join("\n");
    return { ok: true, draftBody: body };
  }

  const KY_TOPICS = Object.freeze([
    { key: "高所作業", patterns: [/高所|足場|はしご/i] },
    { key: "電気作業", patterns: [/電気/i] },
    { key: "水回り作業", patterns: [/水回り|配管|水道/i] },
    { key: "屋根作業", patterns: [/屋根/i] },
    { key: "外壁作業", patterns: [/外壁/i] },
    { key: "清掃作業", patterns: [/清掃/i] },
    { key: "重量物運搬", patterns: [/重量|運搬|荷揚/i] },
    { key: "脚立・足場", patterns: [/脚立|足場/i] },
    { key: "火気使用", patterns: [/火気|溶接|切断/i] },
    { key: "近隣配慮", patterns: [/近隣|騒音|粉塵/i] },
  ]);

  function runSafetyKy(userText) {
    const t = String(userText || "");
    const active = KY_TOPICS.filter((k) => k.patterns.some((p) => p.test(t)));
    const topics = active.length ? active.map((k) => k.key) : KY_TOPICS.map((k) => k.key);

    const rows = topics
      .map(
        (topic) =>
          `| ${topic} | （危険要因） | （対策案） | （確認者） |`
      )
      .join("\n");

    const body = [
      "【現場KY（危険予知）チェックリスト — 下書き】",
      "",
      "| 作業 | 危険要因 | 対策 | 確認 |",
      "| --- | --- | --- | --- |",
      rows,
      "",
      "## KY 実施メモ",
      "- [ ] 作業前ミーティング実施",
      "- [ ] 危険箇所の共有",
      "- [ ] 保護具・資機材の確認",
      "- [ ] 有資格者配置の確認（該当時）",
      "- [ ] 近隣・通行者への配慮",
      footer("safety"),
    ].join("\n");
    return { ok: true, draftBody: body, topics };
  }

  function parseTasks(text) {
    const lines = String(text || "").split(/\n/);
    const tasks = [];
    lines.forEach((line) => {
      const m = line.match(/(.+?)[:：\s]+(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*[〜~\-–—]\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})(?:\s*[（(]([^)）]+)[)）])?/);
      if (m) tasks.push({ name: m[1].trim(), start: m[2], end: m[3], owner: m[4] || "" });
    });
    if (!tasks.length) {
      const inline = text.match(/(.{2,20})[:：]\s*開始\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}).*終了\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i);
      if (inline) tasks.push({ name: inline[1].trim(), start: inline[2], end: inline[3], owner: "" });
    }
    return tasks;
  }

  function runGantt(userText, ctx) {
    const tasks = parseTasks(userText);
    const bufferDays = pickNum(userText, [/予備日[:：\s]*([\d.]+)/i]) || 0;

    let table;
    if (tasks.length) {
      table = ["| 工事項目 | 開始 | 終了 | 担当 | 備考 |", "| --- | --- | --- | --- | --- |"];
      tasks.forEach((t) => {
        table.push(`| ${t.name} | ${t.start} | ${t.end} | ${t.owner || "—"} | 下書き |`);
      });
    } else {
      table = [
        "| 工事項目 | 開始 | 終了 | 担当 | 前後関係 |",
        "| --- | --- | --- | --- | --- |",
        "| 準備・養生 | YYYY-MM-DD | YYYY-MM-DD | — | — |",
        "| 本体工事 | YYYY-MM-DD | YYYY-MM-DD | — | 準備後 |",
        "| 仕上げ・検査 | YYYY-MM-DD | YYYY-MM-DD | — | 本体後 |",
      ];
    }

    const body = [
      "【工程表（ガント風テキスト）— 下書き】",
      "",
      table.join("\n"),
      bufferDays ? `\n予備日（入力）: ${bufferDays} 日` : "",
      "",
      "## 遅延リスク・天候リスク（確認メモ）",
      "- 外装・屋根: 雨天時の順延",
      "- 材料納期: 前倒し/遅延の影響",
      "- 近隣・許認可: 工程への影響",
      "",
      "## 遅延時の対応案（下書き）",
      "- 関係者への事実共有",
      "- 優先順位の見直し",
      "- 予備日の活用検討",
      ctx ? `\n## 案件コンテキスト\n${ctx.slice(0, 400)}` : "",
      footer("gantt"),
    ]
      .filter(Boolean)
      .join("\n");
    return { ok: true, draftBody: body, tasks };
  }

  function runBeforeAfter(userText) {
    const t = String(userText || "");
    const body = [
      "【作業前・作業後チェックリスト — 下書き】",
      "",
      "## 作業前",
      "- [ ] 作業内容・範囲の再確認",
      "- [ ] 養生・養生材の設置",
      "- [ ] 写真撮影（Before）",
      "- [ ] 近隣・共用部への配慮確認",
      "- [ ] 工具・資材・安全具の確認",
      "",
      "## 作業中",
      "- [ ] 仕様どおりの施工",
      "- [ ] 破損・既存部材の確認",
      "",
      "## 作業後",
      "- [ ] 清掃・ゴミ処理",
      "- [ ] 写真撮影（After）",
      "- [ ] 完了確認（当事者立会）",
      "- [ ] 引き渡し事項のメモ",
      "- [ ] 追加対応・残工事メモ",
      t.includes("引き渡し") ? "- [ ] 引き渡し確認書（下書き）の準備" : "",
      "",
      "## 追加対応メモ",
      "（追記欄）",
      footer("checklist"),
    ]
      .filter(Boolean)
      .join("\n");
    return { ok: true, draftBody: body };
  }

  const RUNNERS = Object.freeze({
    document_text_draft: runDocumentText,
    contract_order_draft: runContractOrder,
    safety_ky_checklist: runSafetyKy,
    gantt_schedule_draft: runGantt,
    before_after_checklist: runBeforeAfter,
  });

  /**
   * @param {string} actionId
   * @param {string} userText
   * @param {{ contextText?: string }} [opts]
   */
  function run(actionId, userText, opts) {
    const fn = RUNNERS[actionId];
    if (!fn) return { ok: false, error: "unknown_practice" };
    const ctx = String(opts?.contextText || "").trim();
    if (actionId === "safety_ky_checklist") return fn(userText);
    if (actionId === "before_after_checklist") return fn(userText);
    return fn(userText, ctx);
  }

  function isPracticeAction(actionId) {
    return PRACTICE_ACTION_IDS.includes(actionId);
  }

  global.TasuBuilderAIPracticeAssist = {
    PRACTICE_ACTION_IDS,
    run,
    isPracticeAction,
    detectDocType,
  };
})(typeof window !== "undefined" ? window : globalThis);
