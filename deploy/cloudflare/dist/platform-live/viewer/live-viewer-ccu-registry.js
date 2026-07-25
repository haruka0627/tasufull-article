/**
 * Live Platform Viewer — CCU Registry（正本 · in-memory）
 * Phase C · heartbeat TTL ベース active viewer 集計
 */
(function (global) {
  "use strict";

  class TasuLivePlatformViewerCcuRegistry {
    /**
     * @param {{ heartbeatTtlMs?: number }} [options]
     */
    constructor(options = {}) {
      /** @private */
      this._heartbeatTtlMs = Number(options.heartbeatTtlMs) > 0 ? Number(options.heartbeatTtlMs) : 30_000;
      /** @private @type {Map<string, Map<string, { userId: string, lastHeartbeatAt: number, active: boolean }>>} */
      this._rooms = new Map();
    }

    /** @private */
    _key(surface, broadcastId) {
      return `${String(surface).trim().toLowerCase()}:${String(broadcastId).trim()}`;
    }

    /** @private */
    _room(surface, broadcastId, create = false) {
      const key = this._key(surface, broadcastId);
      if (!this._rooms.has(key) && create) {
        this._rooms.set(key, new Map());
      }
      return this._rooms.get(key);
    }

    /**
     * @param {string} surface
     * @param {string} broadcastId
     * @param {string} userId
     */
    register(surface, broadcastId, userId) {
      const uid = String(userId).trim();
      const bucket = this._room(surface, broadcastId, true);
      bucket.set(uid, { userId: uid, lastHeartbeatAt: Date.now(), active: true });
      return this.getCcu(surface, broadcastId);
    }

    /**
     * @param {string} surface
     * @param {string} broadcastId
     * @param {string} userId
     */
    unregister(surface, broadcastId, userId) {
      const bucket = this._room(surface, broadcastId);
      if (!bucket) return this.getCcu(surface, broadcastId);
      bucket.delete(String(userId).trim());
      return this.getCcu(surface, broadcastId);
    }

    /**
     * @param {string} surface
     * @param {string} broadcastId
     * @param {string} userId
     */
    heartbeat(surface, broadcastId, userId) {
      const uid = String(userId).trim();
      const bucket = this._room(surface, broadcastId, true);
      bucket.set(uid, { userId: uid, lastHeartbeatAt: Date.now(), active: true });
      return this.getCcu(surface, broadcastId);
    }

    /**
     * @param {string} surface
     * @param {string} broadcastId
     * @param {number} [nowMs]
     */
    expireStale(surface, broadcastId, nowMs = Date.now()) {
      const bucket = this._room(surface, broadcastId);
      if (!bucket) return { expired: [], ccu: 0 };
      const expired = [];
      for (const [uid, rec] of bucket.entries()) {
        if (nowMs - rec.lastHeartbeatAt > this._heartbeatTtlMs) {
          rec.active = false;
          bucket.delete(uid);
          expired.push(uid);
        }
      }
      return { expired, ccu: bucket.size };
    }

    /**
     * @param {string} surface
     * @param {string} broadcastId
     * @param {number} [nowMs]
     */
    getCcu(surface, broadcastId, nowMs = Date.now()) {
      this.expireStale(surface, broadcastId, nowMs);
      const bucket = this._room(surface, broadcastId);
      return bucket ? bucket.size : 0;
    }

    /**
     * @param {string} surface
     * @param {string} broadcastId
     */
    getActiveViewers(surface, broadcastId) {
      const bucket = this._room(surface, broadcastId);
      if (!bucket) return [];
      return Array.from(bucket.keys());
    }

    clear(surface, broadcastId) {
      this._rooms.delete(this._key(surface, broadcastId));
    }

    clearAll() {
      this._rooms.clear();
    }
  }

  global.TasuLivePlatformViewerCcuRegistry = TasuLivePlatformViewerCcuRegistry;
})(typeof window !== "undefined" ? window : globalThis);
