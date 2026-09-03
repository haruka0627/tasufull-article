/**
 * one-tlv-scene-asset-store.js
 * Local Scene asset persistence (IndexedDB) for Image / Logo Sources.
 * Scene state stores assetId references only — not MediaStreams / huge data URLs.
 */
(function (global) {
  "use strict";

  var DB_NAME = "tlv_scene_assets_v1";
  var DB_VERSION = 1;
  var STORE = "assets";
  var MAX_BYTES = 5 * 1024 * 1024;
  var ALLOWED = Object.freeze(["image/png", "image/jpeg", "image/webp"]);

  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    if (!global.indexedDB) {
      return Promise.reject(new Error("indexedDB unsupported"));
    }
    dbPromise = new Promise(function (resolve, reject) {
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error || new Error("indexedDB open failed"));
      };
    });
    return dbPromise;
  }

  function uid() {
    return "asset-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function validateFile(file) {
    if (!file) return { ok: false, code: "no_file", message: "No file" };
    var mime = String(file.type || "").toLowerCase();
    if (ALLOWED.indexOf(mime) < 0) {
      return { ok: false, code: "mime", message: "PNG / JPEG / WebP only" };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, code: "size", message: "Max 5MB" };
    }
    return { ok: true, mime: mime };
  }

  function decodeImageBlob(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve({
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0,
          image: img,
        });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("image decode failed"));
      };
      img.src = url;
    });
  }

  async function putAsset(file) {
    var v = validateFile(file);
    if (!v.ok) return v;
    var decoded;
    try {
      decoded = await decodeImageBlob(file);
    } catch (err) {
      return { ok: false, code: "decode", message: err?.message || String(err) };
    }
    if (!decoded.width || !decoded.height) {
      return { ok: false, code: "decode", message: "Invalid image dimensions" };
    }
    var id = uid();
    var record = {
      id: id,
      mime: v.mime,
      name: String(file.name || id).slice(0, 120),
      size: file.size,
      width: decoded.width,
      height: decoded.height,
      blob: file,
      createdAt: Date.now(),
    };
    var db = await openDb();
    await new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error || new Error("asset put failed"));
      };
    });
    return {
      ok: true,
      assetId: id,
      width: decoded.width,
      height: decoded.height,
      mime: v.mime,
      name: record.name,
      image: decoded.image,
    };
  }

  async function getAsset(assetId) {
    if (!assetId) return { ok: false, code: "no_id" };
    var db = await openDb();
    var record = await new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readonly");
      var req = tx.objectStore(STORE).get(String(assetId));
      req.onsuccess = function () {
        resolve(req.result || null);
      };
      req.onerror = function () {
        reject(req.error || new Error("asset get failed"));
      };
    });
    if (!record || !record.blob) return { ok: false, code: "missing" };
    try {
      var decoded = await decodeImageBlob(record.blob);
      return {
        ok: true,
        assetId: record.id,
        mime: record.mime,
        name: record.name,
        width: record.width || decoded.width,
        height: record.height || decoded.height,
        image: decoded.image,
        blob: record.blob,
      };
    } catch (_) {
      return { ok: false, code: "decode" };
    }
  }

  async function deleteAsset(assetId) {
    if (!assetId) return { ok: true };
    try {
      var db = await openDb();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(String(assetId));
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error || new Error("asset delete failed"));
        };
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  global.TasuOneTlvSceneAssetStore = {
    DB_NAME: DB_NAME,
    MAX_BYTES: MAX_BYTES,
    ALLOWED: ALLOWED,
    validateFile: validateFile,
    putAsset: putAsset,
    getAsset: getAsset,
    deleteAsset: deleteAsset,
  };
})(typeof window !== "undefined" ? window : globalThis);
