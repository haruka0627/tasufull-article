/**
 * TASFUL AI — AI履歴（localStorage · 将来 Supabase 同期可能）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_history_v1";
  const EVENT_NAME = "tasu:ai-history-changed";

  const CATEGORIES = Object.freeze([
    { id: "chat", label: "チャット" },
    { id: "web_search", label: "Web検索" },
    { id: "builder", label: "Builder相談" },
    { id: "image", label: "画像生成" },
    { id: "video", label: "動画生成" },
    { id: "music", label: "音楽生成" },
    { id: "translate", label: "翻訳" },
    { id: "summary", label: "要約" },
    { id: "code", label: "コード生成" },
    { id: "document", label: "資料生成" },
  ]);

  const FOLDERS = Object.freeze([
    { id: "work", label: "仕事" },
    { id: "builder", label: "Builder" },
    { id: "platform", label: "Platform" },
    { id: "tlv", label: "TLV" },
    { id: "image", label: "画像" },
    { id: "video", label: "動画" },
    { id: "music", label: "音楽" },
    { id: "other", label: "その他" },
  ]);

  const DEFAULT_FOLDER = "other";

  function newId() {
    return `aih-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function readAll() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAll(rows) {
    const safe = Array.isArray(rows) ? rows : [];
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(safe));
      global.dispatchEvent?.(new CustomEvent(EVENT_NAME, { detail: { count: safe.length } }));
    } catch {
      /* ignore */
    }
    return safe;
  }

  function normalizeFolderId(id) {
    const key = String(id || "").trim();
    return FOLDERS.some((f) => f.id === key) ? key : DEFAULT_FOLDER;
  }

  function defaultFolderForCategory(category) {
    const map = {
      builder: "builder",
      video: "video",
      music: "music",
      image: "image",
      web_search: "platform",
      document: "work",
      chat: "work",
    };
    return map[String(category || "")] || DEFAULT_FOLDER;
  }

  function pickModelLabel(record) {
    return (
      String(record?.modelLabel || record?.model || "").trim() ||
      global.TasuAiPlanModels?.getSelectedModelId?.() ||
      "default"
    );
  }

  function deriveTitle(text, fallback) {
    const t = String(text || "").trim().replace(/\s+/g, " ");
    if (!t) return fallback || "無題";
    return t.length > 48 ? `${t.slice(0, 48)}…` : t;
  }

  /**
   * @param {object} input
   * @returns {object}
   */
  function createRecord(input) {
    const now = new Date().toISOString();
    const category = String(input?.category || "chat").trim();
    return {
      id: input?.id || newId(),
      createdAt: input?.createdAt || now,
      updatedAt: now,
      category,
      title: deriveTitle(input?.title || input?.prompt, "無題"),
      model: pickModelLabel(input),
      modelLabel: String(input?.modelLabel || input?.model || "").trim(),
      favorite: Boolean(input?.favorite),
      pinned: Boolean(input?.pinned),
      folderId: normalizeFolderId(input?.folderId || defaultFolderForCategory(category)),
      prompt: String(input?.prompt || "").trim(),
      params: input?.params && typeof input.params === "object" ? { ...input.params } : {},
      resultPreview: String(input?.resultPreview || "").slice(0, 500),
      resultMarkdown: String(input?.resultMarkdown || "").trim(),
      modeId: String(input?.modeId || "").trim(),
      sessionKey: String(input?.sessionKey || "").trim(),
      messages: Array.isArray(input?.messages) ? input.messages.slice(-40) : [],
      source: String(input?.source || "workspace").trim(),
      _version: 1,
    };
  }

  function upsert(record) {
    const row = createRecord(record);
    const list = readAll();
    const idx = list.findIndex((r) => r.id === row.id);
    if (idx >= 0) {
      row.createdAt = list[idx].createdAt || row.createdAt;
      list[idx] = { ...list[idx], ...row, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(row);
    }
    writeAll(list.slice(0, 500));
    return row;
  }

  function findById(id) {
    return readAll().find((r) => r.id === String(id || "").trim()) || null;
  }

  function findBySessionKey(sessionKey) {
    const key = String(sessionKey || "").trim();
    if (!key) return null;
    return readAll().find((r) => r.sessionKey === key) || null;
  }

  function update(id, patch) {
    const list = readAll();
    const idx = list.findIndex((r) => r.id === String(id || "").trim());
    if (idx < 0) return null;
    list[idx] = {
      ...list[idx],
      ...(patch || {}),
      updatedAt: new Date().toISOString(),
    };
    if (patch?.folderId != null) list[idx].folderId = normalizeFolderId(patch.folderId);
    writeAll(list);
    return list[idx];
  }

  function remove(id) {
    const key = String(id || "").trim();
    writeAll(readAll().filter((r) => r.id !== key));
  }

  function toggleFavorite(id) {
    const row = findById(id);
    if (!row) return null;
    return update(id, { favorite: !row.favorite });
  }

  function togglePinned(id) {
    const row = findById(id);
    if (!row) return null;
    return update(id, { pinned: !row.pinned });
  }

  function list(opts) {
    const o = opts || {};
    let rows = readAll().slice();
    const q = String(o.query || "").trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const hay = `${r.title} ${r.prompt} ${r.resultPreview} ${r.category}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (o.category) rows = rows.filter((r) => r.category === o.category);
    if (o.folderId) rows = rows.filter((r) => r.folderId === normalizeFolderId(o.folderId));
    if (o.favoriteOnly) rows = rows.filter((r) => r.favorite);

    const sort = o.sort || "date-desc";
    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === "title") return a.title.localeCompare(b.title, "ja");
      if (sort === "date-asc") return String(a.updatedAt).localeCompare(String(b.updatedAt));
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
    return rows;
  }

  /** Supabase 同期用 */
  function exportAll() {
    return { version: 1, records: readAll(), exportedAt: new Date().toISOString() };
  }

  function importAll(payload) {
    if (!payload || !Array.isArray(payload.records)) return false;
    const merged = payload.records.map((r) => createRecord(r));
    writeAll(merged.slice(0, 500));
    return true;
  }

  function categoryLabel(id) {
    return CATEGORIES.find((c) => c.id === id)?.label || id;
  }

  function folderLabel(id) {
    return FOLDERS.find((f) => f.id === id)?.label || id;
  }

  global.TasuAiHistoryStore = {
    STORAGE_KEY,
    EVENT_NAME,
    CATEGORIES,
    FOLDERS,
    DEFAULT_FOLDER,
    readAll,
    upsert,
    findById,
    findBySessionKey,
    update,
    remove,
    toggleFavorite,
    togglePinned,
    list,
    exportAll,
    importAll,
    categoryLabel,
    folderLabel,
    deriveTitle,
  };
})(typeof window !== "undefined" ? window : globalThis);
