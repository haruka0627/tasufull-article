/**
 * TLV Realtime Viewer Count Contract (V1).
 * Counts viewers only — host/broadcaster identities are excluded.
 * LiveKit remotes are preferred; identity prefix viewer_ / host_ is authoritative.
 */
(function (global) {
  "use strict";

  var HOST_PREFIX = "host_";
  var VIEWER_PREFIX = "viewer_";

  /**
   * @param {string} identity
   * @returns {"host"|"viewer"|"unknown"}
   */
  function roleFromIdentity(identity) {
    var id = String(identity || "");
    if (id.indexOf(HOST_PREFIX) === 0) return "host";
    if (id.indexOf(VIEWER_PREFIX) === 0) return "viewer";
    return "unknown";
  }

  /**
   * Deduplicate by identity (reconnect must not double-count).
   * Hosts are never included. Unknown remotes count as viewers (non-host remotes).
   * @param {Array<{ identity?: string, sid?: string }|string>} participants
   * @returns {{ viewerCount: number, identities: string[], excludedHosts: string[] }}
   */
  function countViewers(participants) {
    var seen = Object.create(null);
    var identities = [];
    var excludedHosts = [];
    var list = Array.isArray(participants) ? participants : [];
    for (var i = 0; i < list.length; i++) {
      var raw = list[i];
      var identity = typeof raw === "string" ? raw : String((raw && raw.identity) || "");
      if (!identity) continue;
      var role = roleFromIdentity(identity);
      if (role === "host") {
        excludedHosts.push(identity);
        continue;
      }
      if (seen[identity]) continue;
      seen[identity] = true;
      identities.push(identity);
    }
    return {
      viewerCount: identities.length,
      identities: identities,
      excludedHosts: excludedHosts,
      hostExcluded: true,
      fakeForbidden: true,
    };
  }

  /**
   * Build stats from a LiveKit-like room snapshot.
   * Local participant is always treated as host-side and excluded.
   * @param {{ localIdentity?: string, remotes?: Array<{ identity?: string }> }} snap
   */
  function fromRoomSnapshot(snap) {
    snap = snap || {};
    var remotes = Array.isArray(snap.remotes) ? snap.remotes.slice() : [];
    var localIdentity = String(snap.localIdentity || "");
    if (localIdentity && roleFromIdentity(localIdentity) !== "host") {
      // Safety: never count local as viewer even if mis-prefixed
      remotes = remotes.filter(function (p) {
        return String((p && p.identity) || "") !== localIdentity;
      });
    }
    var counted = countViewers(remotes);
    return Object.assign(
      {
        source: "livekit_remote_participants",
        localIdentity: localIdentity,
        remoteCount: remotes.length,
      },
      counted
    );
  }

  global.TasuTlvLiveViewerCountContract = {
    roleFromIdentity: roleFromIdentity,
    countViewers: countViewers,
    fromRoomSnapshot: fromRoomSnapshot,
    HOST_PREFIX: HOST_PREFIX,
    VIEWER_PREFIX: VIEWER_PREFIX,
    ssot: "livekit.remoteParticipants · exclude host_* · dedupe identity",
  };
})(typeof window !== "undefined" ? window : globalThis);
