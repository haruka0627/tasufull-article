/**
 * Platform — お気に入りフォルダ
 */
(function (global) {
  "use strict";

  const FOLDERS = Object.freeze([
    { id: "interested", label: "気になる" },
    { id: "comparing", label: "比較中" },
    { id: "work", label: "仕事" },
    { id: "products", label: "商品" },
    { id: "later", label: "あとで依頼" },
    { id: "other", label: "その他" },
  ]);

  const META_KEY = "tasful_favorite_folders_meta";
  const DEFAULT_FOLDER = "interested";

  function readMeta() {
    try {
      const raw = global.localStorage?.getItem(META_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeMeta(meta) {
    try {
      global.localStorage?.setItem(META_KEY, JSON.stringify(meta || {}));
    } catch {
      /* ignore */
    }
  }

  function folderKey(listingId, type) {
    return `${String(type || "general").trim()}:${String(listingId || "").trim()}`;
  }

  function normalizeFolderId(folderId) {
    const id = String(folderId || "").trim();
    if (!id || id === "default") return DEFAULT_FOLDER;
    return FOLDERS.some((f) => f.id === id) ? id : DEFAULT_FOLDER;
  }

  function getFolder(listingId, type) {
    const meta = readMeta();
    return normalizeFolderId(meta[folderKey(listingId, type)]);
  }

  function setFolder(listingId, type, folderId) {
    const id = normalizeFolderId(folderId);
    const meta = readMeta();
    meta[folderKey(listingId, type)] = id;
    writeMeta(meta);
    global.dispatchEvent?.(
      new CustomEvent("tasful-favorites-changed", { detail: { folder: id, listingId, type } })
    );
    return true;
  }

  function listAllFavorites() {
    const store = global.TasuFavoriteStore;
    if (store?.readAll) {
      return store.readAll().map((row) => ({
        id: String(row?.listingId || "").trim(),
        type: String(row?.listingType || "general").trim(),
        record: row,
      }));
    }
    const ids = store?.getAllListingIds?.() || [];
    return ids
      .map((id) => ({ id: String(id || "").trim(), type: "general" }))
      .filter((item) => item.id);
  }

  function listByFolder(folderId) {
    const fid = normalizeFolderId(folderId);
    return listAllFavorites().filter((item) => getFolder(item.id, item.type) === fid);
  }

  function listFolders() {
    return FOLDERS.map((f) => ({
      ...f,
      count: listByFolder(f.id).length,
    }));
  }

  /** 将来 DB 保存用 — localStorage メタをそのまま返す */
  function exportMeta() {
    return { ...readMeta(), _version: 1 };
  }

  /** 将来 DB 保存用 — メタをマージ */
  function importMeta(meta) {
    if (!meta || typeof meta !== "object") return false;
    const current = readMeta();
    Object.keys(meta).forEach((key) => {
      if (key.startsWith("_")) return;
      current[key] = normalizeFolderId(meta[key]);
    });
    writeMeta(current);
    return true;
  }

  global.TasuPlatformFavoriteFolders = {
    FOLDERS,
    DEFAULT_FOLDER,
    getFolder,
    setFolder,
    listByFolder,
    listFolders,
    listAllFavorites,
    exportMeta,
    importMeta,
  };
})(typeof window !== "undefined" ? window : globalThis);
