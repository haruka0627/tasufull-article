/**
 * パートナー評価・非表示 — 自然文パース
 */
(function (global) {
  "use strict";

  function parseDelta(token, jaRe, enRe) {
    const m =
      String(token || "").match(jaRe) ||
      String(token || "").match(enRe);
    if (!m) return null;
    return m[1] === "-" || m[1] === "−" ? -1 : 1;
  }

  /**
   * @returns {{ ok: boolean, type?: 'evaluation'|'hide', partnerName?: string, deadline_delta?: number, complaint_delta?: number, hide_status?: string, error?: string }}
   */
  function parseBuilderPartnerEvaluationInput(raw) {
    const text = String(raw || "").trim();
    if (!text) return { ok: false, error: "入力が空です" };

    const hideMatch = /(ドタキャン|表示停止|非表示)/i.test(text);
    const deadlineRe = /(?:期日|deadline)\s*([+\-−])\s*1/i;
    const complaintRe = /(?:クレーム|complaint)\s*([+\-−])\s*1/i;

    let deadline_delta = null;
    let complaint_delta = null;
    const d = text.match(deadlineRe);
    const c = text.match(complaintRe);
    if (d) deadline_delta = d[1] === "-" || d[1] === "−" ? -1 : 1;
    if (c) complaint_delta = c[1] === "-" || c[1] === "−" ? -1 : 1;

    const markers = [];
    let m;
    const markerRe = /(?:期日|deadline)\s*[+\-−]\s*1|(?:クレーム|complaint)\s*[+\-−]\s*1|ドタキャン|表示停止|非表示/gi;
    while ((m = markerRe.exec(text)) !== null) {
      markers.push({ index: m.index, len: m[0].length });
    }
    markers.sort((a, b) => a.index - b.index);
    const partnerName = markers.length
      ? text.slice(0, markers[0].index).trim()
      : text.trim();

    if (!partnerName) return { ok: false, error: "パートナー名を認識できませんでした" };

    if (hideMatch && deadline_delta == null && complaint_delta == null) {
      return {
        ok: true,
        type: "hide",
        partnerName,
        hide_status: "hidden",
        hide_reason: "ドタキャンのため非表示（管理者操作）",
      };
    }

    if (deadline_delta == null && complaint_delta == null) {
      return {
        ok: false,
        error: "期日±1 / クレーム±1 / ドタキャン非表示 のいずれかを指定してください",
      };
    }

    return {
      ok: true,
      type: "evaluation",
      partnerName,
      deadline_delta: deadline_delta ?? 0,
      complaint_delta: complaint_delta ?? 0,
    };
  }

  global.TasuBuilderPartnerEvalParse = {
    parseBuilderPartnerEvaluationInput,
  };
})(typeof window !== "undefined" ? window : globalThis);
