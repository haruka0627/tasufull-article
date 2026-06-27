/**
 * AI秘書 Phase 6-H — Google Drive client (read-only · Edge proxy only)
 */
(function (global) {
  "use strict";

  const PRESETS = Object.freeze({
    recent: "recent",
    root: "root",
  });

  const MIME_FILTERS = Object.freeze({
    folder: "application/vnd.google-apps.folder",
    doc: "application/vnd.google-apps.document",
    sheet: "application/vnd.google-apps.spreadsheet",
    slide: "application/vnd.google-apps.presentation",
    pdf: "application/pdf",
  });

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function postDriveRead(payload) {
    const OAuth = global.TasuSecretaryGoogleOAuthClient;
    if (!OAuth?.postAction) {
      return Promise.resolve({ ok: false, error: "oauth_client_missing" });
    }
    return OAuth.postAction(OAuth.TOOLS_FN, { action: "drive_read", ...payload });
  }

  async function listFiles(options) {
    options = options || {};
    const result = await postDriveRead({
      method: "files.list",
      preset: options.preset || undefined,
      folderId: options.folderId || undefined,
      q: options.q || options.keyword || undefined,
      mimeType: options.mimeType || undefined,
      maxResults: options.maxResults || 25,
      pageToken: options.pageToken,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function getFile(fileId) {
    const result = await postDriveRead({
      method: "files.get",
      fileId: trim(fileId, 200),
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function exportFileText(fileId, exportMimeType) {
    const result = await postDriveRead({
      method: "files.export",
      fileId: trim(fileId, 200),
      exportMimeType: exportMimeType ? trim(exportMimeType, 120) : undefined,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function tryWriteBlocked(method) {
    return postDriveRead({ method: trim(method, 80) || "files.create" });
  }

  global.TasuSecretaryGoogleDriveClient = {
    PRESETS,
    MIME_FILTERS,
    listFiles,
    getFile,
    exportFileText,
    tryWriteBlocked,
  };
})(typeof window !== "undefined" ? window : globalThis);
