/**
 * TASFUL TALK — AI Workspace 由来の問い合わせ下書き（自動送信なし）
 * キー: tasful_talk_inquiry_drafts
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_inquiry_drafts";
  const EVENT_NAME = "tasful-talk-inquiry-drafts-changed";
  const MAX_DRAFTS = 50;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function newId() {
    return `talk-inq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeDraft(raw) {
    const createdAt = pickStr(raw?.createdAt) || nowIso();
    const card = raw?.card && typeof raw.card === "object" ? raw.card : {};
    return {
      id: pickStr(raw?.id) || newId(),
      recipientId: pickStr(raw?.recipientId),
      listingId: pickStr(raw?.listingId, raw?.itemId, raw?.vendorId, raw?.workerId),
      itemId: pickStr(raw?.itemId),
      vendorId: pickStr(raw?.vendorId),
      workerId: pickStr(raw?.workerId),
      jobId: pickStr(raw?.jobId),
      generatedSubject: String(raw?.generatedSubject ?? ""),
      generatedBody: String(raw?.generatedBody ?? ""),
      source: pickStr(raw?.source, "ai_workspace"),
      model: pickStr(raw?.model),
      modelId: pickStr(raw?.modelId),
      modelProvider: pickStr(raw?.modelProvider),
      status: pickStr(raw?.status, "draft") || "draft",
      createdAt,
      updatedAt: pickStr(raw?.updatedAt) || createdAt,
      card,
    };
  }

  function readAll() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeDraft);
    } catch {
      return [];
    }
  }

  function writeAll(list) {
    const safe = Array.isArray(list) ? list.slice(0, MAX_DRAFTS).map(normalizeDraft) : [];
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list: safe } }));
    } catch (err) {
      console.warn("[TasuTalkInquiryDrafts] save failed:", err);
    }
    return safe;
  }

  function findById(id) {
    const key = pickStr(id);
    if (!key) return null;
    return readAll().find((row) => row.id === key) || null;
  }

  /**
   * @param {object} input
   */
  function add(input) {
    const row = normalizeDraft({
      ...input,
      id: newId(),
      status: "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const next = [row, ...readAll().filter((d) => d.id !== row.id)];
    writeAll(next);
    return row;
  }

  function update(id, patch) {
    const key = pickStr(id);
    if (!key) return null;
    let updated = null;
    const next = readAll().map((row) => {
      if (row.id !== key) return row;
      updated = normalizeDraft({
        ...row,
        ...patch,
        id: row.id,
        updatedAt: nowIso(),
      });
      return updated;
    });
    writeAll(next);
    return updated;
  }

  function buildTalkDraftUrl(draftId) {
    const id = pickStr(draftId);
    if (!id) return "talk-inquiry-draft.html";
    return `talk-inquiry-draft.html?draftId=${encodeURIComponent(id)}`;
  }

  global.TasuTalkInquiryDrafts = {
    STORAGE_KEY,
    EVENT_NAME,
    readAll,
    findById,
    add,
    update,
    buildTalkDraftUrl,
    normalizeDraft,
  };
})(typeof window !== "undefined" ? window : globalThis);
