/**
 * TASFUL Page Gen — provenance & regeneration merge (Phase 1 common engine)
 *
 * Tracks whether each field came from AI, the user or the system, and keeps
 * user edits from being overwritten when the page is regenerated.
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  function ensureStore(doc) {
    if (!doc.provenance || typeof doc.provenance !== "object") doc.provenance = {};
    return doc.provenance;
  }

  function entryFor(doc, path) {
    return ensureStore(doc)[String(path)] || null;
  }

  function mark(doc, path, options) {
    const schema = S();
    const store = ensureStore(doc);
    const key = String(path);
    const prev = store[key] || {};
    const source = options?.source || schema.SOURCE.SYSTEM;
    store[key] = {
      source,
      locked: options?.locked != null ? Boolean(options.locked) : source === schema.SOURCE.USER,
      model: options?.model ? String(options.model) : prev.model || "",
      at: schema.nowIso(),
    };
    return store[key];
  }

  function markUser(doc, path) {
    return mark(doc, path, { source: S().SOURCE.USER, locked: true });
  }

  function markAi(doc, path, model) {
    return mark(doc, path, { source: S().SOURCE.AI, locked: false, model });
  }

  function markSystem(doc, path) {
    return mark(doc, path, { source: S().SOURCE.SYSTEM, locked: false });
  }

  function sourceOf(doc, path) {
    return entryFor(doc, path)?.source || null;
  }

  function isLocked(doc, path) {
    return Boolean(entryFor(doc, path)?.locked);
  }

  function setLock(doc, path, locked) {
    const entry = entryFor(doc, path) || mark(doc, path, { source: S().SOURCE.SYSTEM });
    entry.locked = Boolean(locked);
    return entry;
  }

  function lock(doc, path) {
    return setLock(doc, path, true);
  }

  function unlock(doc, path) {
    return setLock(doc, path, false);
  }

  /** A path is writable by AI unless the user locked or authored it (or a descendant). */
  function hasProtectedDescendant(doc, path) {
    const prefix = `${String(path)}.`;
    const store = ensureStore(doc);
    const user = S().SOURCE.USER;
    return Object.keys(store).some((key) => {
      if (!key.startsWith(prefix)) return false;
      const entry = store[key];
      return Boolean(entry?.locked) || entry?.source === user;
    });
  }

  function canAiWrite(doc, path) {
    const entry = entryFor(doc, path);
    if (entry) {
      if (entry.locked) return false;
      if (entry.source === S().SOURCE.USER) return false;
    }
    // Parent array/object writes must not wipe locked nested user edits (e.g. faq items.0.a).
    if (hasProtectedDescendant(doc, path)) return false;
    return true;
  }

  /**
   * Applies a flat { path: value } patch produced from an AI draft.
   * Returns which paths were applied and which were skipped (and why).
   */
  function applyAiPatch(doc, patch, options) {
    const schema = S();
    const model = options?.model || "";
    const force = Boolean(options?.force);
    const forcePaths = new Set(Array.isArray(options?.paths) ? options.paths.map(String) : []);
    const applied = [];
    const skipped = [];

    Object.keys(patch || {}).forEach((path) => {
      const targeted = forcePaths.size ? forcePaths.has(path) : true;
      if (!targeted) {
        skipped.push({ path, reason: "out_of_scope" });
        return;
      }
      if (!force && !canAiWrite(doc, path)) {
        skipped.push({ path, reason: isLocked(doc, path) ? "locked" : "user_authored" });
        return;
      }
      schema.setPath(doc, path, patch[path]);
      markAi(doc, path, model);
      applied.push(path);
    });

    schema.touch(doc);
    return { applied, skipped };
  }

  /** Records a user edit at a path and locks it against future regeneration. */
  function applyUserEdit(doc, path, value) {
    const schema = S();
    schema.setPath(doc, path, value);
    markUser(doc, path);
    schema.touch(doc);
    return doc;
  }

  function summary(doc) {
    const store = ensureStore(doc);
    const counts = { ai: 0, user: 0, system: 0, import: 0, locked: 0, total: 0 };
    Object.keys(store).forEach((key) => {
      const entry = store[key];
      counts.total += 1;
      if (counts[entry.source] != null) counts[entry.source] += 1;
      if (entry.locked) counts.locked += 1;
    });
    return counts;
  }

  function lockedPaths(doc) {
    const store = ensureStore(doc);
    return Object.keys(store).filter((key) => store[key].locked);
  }

  function aiPaths(doc) {
    const store = ensureStore(doc);
    return Object.keys(store).filter((key) => store[key].source === S().SOURCE.AI);
  }

  global.TasuPageGenProvenance = {
    mark,
    markUser,
    markAi,
    markSystem,
    entryFor,
    sourceOf,
    isLocked,
    lock,
    unlock,
    canAiWrite,
    applyAiPatch,
    applyUserEdit,
    summary,
    lockedPaths,
    aiPaths,
  };
})(typeof window !== "undefined" ? window : globalThis);
