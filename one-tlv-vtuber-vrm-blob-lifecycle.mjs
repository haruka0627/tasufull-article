/**
 * VRM blob URL ownership — at most one active blob URL.
 * Candidates stay un-revoked until load succeeds (commit) or fails (abandon).
 * Double-revoke is a no-op.
 */

export function isBlobUrl(url) {
  return typeof url === "string" && url.indexOf("blob:") === 0;
}

/**
 * @param {{
 *   createObjectURL?: (blob: Blob) => string,
 *   revokeObjectURL?: (url: string) => void,
 * }} [hooks]
 */
export function createVrmBlobUrlOwner(hooks = {}) {
  const createObjectURL =
    hooks.createObjectURL ||
    function (blob) {
      return URL.createObjectURL(blob);
    };
  const revokeObjectURL =
    hooks.revokeObjectURL ||
    function (url) {
      URL.revokeObjectURL(url);
    };

  let activeUrl = null;
  const live = new Set();
  const revoked = new Set();

  function createFromBlob(blob) {
    const url = createObjectURL(blob);
    live.add(url);
    return url;
  }

  function revoke(url) {
    if (!url || !isBlobUrl(url)) {
      return { ok: false, revoked: false, reason: "not_blob" };
    }
    if (revoked.has(url)) {
      return { ok: false, revoked: false, reason: "already_revoked" };
    }
    try {
      revokeObjectURL(url);
    } catch (_) {}
    revoked.add(url);
    live.delete(url);
    if (activeUrl === url) activeUrl = null;
    return { ok: true, revoked: true };
  }

  /**
   * Promote candidate to active. Revokes the previous active URL once if different.
   * Non-blob (preset https) clears active without creating one.
   */
  function commitActive(url) {
    const previous = activeUrl;
    const next = isBlobUrl(url) ? url : null;
    if (previous && previous !== next) revoke(previous);
    activeUrl = next;
    return { previous, active: activeUrl };
  }

  function abandonCandidate(url) {
    if (!url || url === activeUrl) {
      return { ok: false, revoked: false, reason: "active_or_empty" };
    }
    return revoke(url);
  }

  function disposeActive() {
    return revoke(activeUrl);
  }

  function snapshot() {
    return {
      activeUrl,
      liveCount: live.size,
      revokedCount: revoked.size,
      liveUrls: Array.from(live),
    };
  }

  return {
    createFromBlob,
    commitActive,
    abandonCandidate,
    disposeActive,
    revoke,
    snapshot,
    getActive: function () {
      return activeUrl;
    },
  };
}

/**
 * Replacement gate: never dispose the current instance until a new load succeeds.
 * In-flight loads are generation-stamped so a later load/cleanup wins.
 *
 * @param {{
 *   blobOwner: ReturnType<typeof createVrmBlobUrlOwner>,
 *   disposeInstance: (instance: unknown) => void,
 * }} opts
 */
export function createVrmReplacementGate(opts) {
  const blobOwner = opts.blobOwner;
  const disposeInstance = opts.disposeInstance;
  let generation = 0;
  let current = null;

  function beginLoad() {
    generation += 1;
    return generation;
  }

  function isStale(gen) {
    return gen !== generation;
  }

  function failCandidate(gen, blobUrl, instance, extra) {
    if (instance) {
      try {
        disposeInstance(instance);
      } catch (_) {}
    }
    if (blobUrl) blobOwner.abandonCandidate(blobUrl);
    return Object.assign(
      { ok: false, stale: isStale(gen), current, generation },
      extra || {},
    );
  }

  /**
   * @param {{ gen: number, blobUrl?: string|null, instance: unknown }} loaded
   */
  function commitSuccess(loaded) {
    if (isStale(loaded.gen)) {
      return failCandidate(loaded.gen, loaded.blobUrl, loaded.instance, {
        error: "superseded",
        superseded: true,
      });
    }
    const previous = current;
    if (previous && previous !== loaded.instance) {
      try {
        disposeInstance(previous);
      } catch (_) {}
    }
    blobOwner.commitActive(loaded.blobUrl || null);
    current = loaded.instance;
    return { ok: true, current, previous, generation };
  }

  function getCurrent() {
    return current;
  }

  function invalidateAndClear() {
    generation += 1;
    if (current) {
      try {
        disposeInstance(current);
      } catch (_) {}
      current = null;
    }
    blobOwner.disposeActive();
    return { ok: true, generation };
  }

  return {
    beginLoad,
    isStale,
    failCandidate,
    commitSuccess,
    getCurrent,
    invalidateAndClear,
    getGeneration: function () {
      return generation;
    },
  };
}
