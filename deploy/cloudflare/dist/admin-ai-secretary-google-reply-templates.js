/**
 * AI秘書 Phase 4-T1 — Gmail 返信テンプレ（文案のみ · send 禁止）
 */
(function (global) {
  "use strict";

  const TEMPLATE_DRAFT_FOOTER =
    "\n\n※ 返信案 · 未送信 · 「下書き保存して」で Human Gate に登録できます";

  const TEMPLATES = Object.freeze({
    tasful_ai_guidance: {
      id: "tasful_ai_guidance",
      label: "TASFUL AI誘導",
      keywords: /検索|業者|サービス|相談|条件|探し|見つけ|不明点|分からない/i,
    },
    assignee_followup: {
      id: "assignee_followup",
      label: "担当確認",
      keywords: /至急|契約|電話|折り返し|面談|担当|確認のうえ/i,
    },
    receipt_ack: {
      id: "receipt_ack",
      label: "受付完了",
      keywords: /受付|問い合わせ|お問い合わせ/i,
    },
    detail_request: {
      id: "detail_request",
      label: "詳細依頼",
      keywords: /詳細|条件|見積|予算|地域|希望時期|希望条件/i,
    },
  });

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function getTasfulAiWorkspaceUrl() {
    const loc = global.location || global.window?.location;
    if (loc?.origin && loc.protocol !== "file:") {
      return `${loc.origin}/ai-workspace.html`;
    }
    return "/ai-workspace.html";
  }

  function buildTasfulAiGuidanceBody() {
    const url = getTasfulAiWorkspaceUrl();
    return (
      "お問い合わせありがとうございます。\n" +
      "条件に合うサービスや業者の検索、分からないことの確認は、TASFUL AIに聞きたい内容を入力してご確認ください。\n" +
      "必要な条件を入力すると、該当する情報を探しやすくなります。\n" +
      `${url}\n` +
      "よろしくお願いいたします。"
    );
  }

  function buildAssigneeFollowupBody() {
    return (
      "お問い合わせありがとうございます。\n" +
      "内容を確認のうえ、担当より改めてご連絡いたします。\n" +
      "よろしくお願いいたします。"
    );
  }

  function buildReceiptAckBody() {
    return (
      "お問い合わせありがとうございます。\n" +
      "受付いたしました。\n" +
      "必要に応じて、担当よりご連絡いたします。\n" +
      "よろしくお願いいたします。"
    );
  }

  function buildDetailRequestBody() {
    return (
      "お問い合わせありがとうございます。\n" +
      "確認のため、希望条件・地域・予算・希望時期など、分かる範囲で詳細をお送りください。\n" +
      "よろしくお願いいたします。"
    );
  }

  function buildReplyBody(templateId) {
    const id = TEMPLATES[templateId] ? templateId : "receipt_ack";
    const meta = TEMPLATES[id];
    let body = "";
    if (id === "tasful_ai_guidance") body = buildTasfulAiGuidanceBody();
    else if (id === "assignee_followup") body = buildAssigneeFollowupBody();
    else if (id === "detail_request") body = buildDetailRequestBody();
    else body = buildReceiptAckBody();
    return { id, label: meta.label, body };
  }

  function matchTemplateId(userText) {
    const t = String(userText || "");
    if (/TASFUL\s*AI|TASFULAI/i.test(t) && /誘導|案内/.test(t)) return "tasful_ai_guidance";
    if (/受付テンプレ|受付完了|受付.*返/.test(t)) return "receipt_ack";
    if (/担当確認|担当.*返/.test(t)) return "assignee_followup";
    if (/詳細.*(聞いて|依頼)|詳細聞いて|希望条件|詳細を/.test(t)) return "detail_request";
    if (/テンプレ.*返信|返信.*テンプレ|テンプレで返/.test(t)) return "auto";
    return "";
  }

  function isTemplateReplyIntent(userText) {
    const t = String(userText || "");
    if (matchTemplateId(t)) return true;
    return /テンプレで返信|TASFUL AIに誘導|受付テンプレで返|担当確認で返|詳細聞いて/.test(t);
  }

  function inferTemplateId(focus) {
    focus = focus || {};
    const haystack = `${trim(focus.subject, 300)} ${trim(focus.snippet, 300)} ${trim(focus.bodyPreview, 500)}`;
    const scores = Object.keys(TEMPLATES).map((id) => {
      const kw = TEMPLATES[id].keywords;
      return { id, score: kw.test(haystack) ? 1 : 0 };
    });
    scores.sort((a, b) => b.score - a.score);
    const best = scores.find((s) => s.score > 0);
    return best?.id || "receipt_ack";
  }

  function resolveTemplateId(userText, focus) {
    const matched = matchTemplateId(userText);
    if (matched && matched !== "auto") return matched;
    if (matched === "auto" || /テンプレ.*返信|返信.*テンプレ|テンプレで返/.test(String(userText || ""))) {
      return inferTemplateId(focus);
    }
    return "receipt_ack";
  }

  global.TasuSecretaryGoogleReplyTemplates = {
    TEMPLATES,
    TEMPLATE_DRAFT_FOOTER,
    getTasfulAiWorkspaceUrl,
    buildReplyBody,
    matchTemplateId,
    isTemplateReplyIntent,
    inferTemplateId,
    resolveTemplateId,
  };
})(typeof window !== "undefined" ? window : globalThis);
