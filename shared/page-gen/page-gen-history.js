/**
 * TASFUL Page Gen — version history (Phase 1 common engine)
 *
 * In-memory / serializable version log with path-level diff and restore.
 * Persistence is the integrating surface's responsibility (Phase 2+).
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  const DEFAULT_MAX = 20;

  function createHistory(options) {
    return {
      max: Number.isFinite(options?.max) ? Math.max(1, Number(options.max)) : DEFAULT_MAX,
      entries: [],
      nextVersion: 1,
    };
  }

  function push(history, doc, options) {
    const schema = S();
    const snapshot = schema.cloneDoc(doc);
    const version = history.nextVersion;
    snapshot.meta.version = version;
    const entry = {
      version,
      label: schema.trimText(options?.label, 80) || "",
      reason: schema.trimText(options?.reason, 40) || "save",
      status: snapshot.meta.status,
      created_at: schema.nowIso(),
      doc: snapshot,
    };
    history.entries.push(entry);
    history.nextVersion += 1;
    while (history.entries.length > history.max) history.entries.shift();
    doc.meta.version = version;
    return entry;
  }

  function list(history) {
    return history.entries.map((e) => ({
      version: e.version,
      label: e.label,
      reason: e.reason,
      status: e.status,
      created_at: e.created_at,
    }));
  }

  function get(history, version) {
    return history.entries.find((e) => e.version === Number(version)) || null;
  }

  function latest(history) {
    return history.entries[history.entries.length - 1] || null;
  }

  function restore(history, version) {
    const entry = get(history, version);
    if (!entry) return null;
    return S().cloneDoc(entry.doc);
  }

  function flatten(value, prefix, out) {
    if (Array.isArray(value)) {
      out[prefix] = JSON.stringify(value);
      return out;
    }
    if (value && typeof value === "object") {
      Object.keys(value).forEach((k) => flatten(value[k], prefix ? `${prefix}.${k}` : k, out));
      return out;
    }
    out[prefix] = value === undefined ? null : value;
    return out;
  }

  /** Path-level diff, ignoring bookkeeping fields. */
  function diffDocs(a, b, options) {
    const ignore = new Set(
      options?.ignore || ["meta.updated_at", "meta.version", "provenance"],
    );
    const flatA = flatten(a || {}, "", {});
    const flatB = flatten(b || {}, "", {});
    const keys = new Set([...Object.keys(flatA), ...Object.keys(flatB)]);
    const changed = [];
    keys.forEach((key) => {
      if ([...ignore].some((ig) => key === ig || key.startsWith(`${ig}.`))) return;
      if (flatA[key] !== flatB[key]) {
        changed.push({ path: key, from: flatA[key] ?? null, to: flatB[key] ?? null });
      }
    });
    return changed.sort((x, y) => x.path.localeCompare(y.path));
  }

  function diffVersions(history, fromVersion, toVersion) {
    const from = get(history, fromVersion);
    const to = get(history, toVersion);
    if (!from || !to) return null;
    return diffDocs(from.doc, to.doc);
  }

  function serialize(history) {
    return JSON.stringify(history);
  }

  function deserialize(json) {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    return {
      max: Number(parsed?.max) || DEFAULT_MAX,
      entries: Array.isArray(parsed?.entries) ? parsed.entries : [],
      nextVersion: Number(parsed?.nextVersion) || 1,
    };
  }

  global.TasuPageGenHistory = {
    DEFAULT_MAX,
    createHistory,
    push,
    list,
    get,
    latest,
    restore,
    diffDocs,
    diffVersions,
    serialize,
    deserialize,
  };
})(typeof window !== "undefined" ? window : globalThis);
