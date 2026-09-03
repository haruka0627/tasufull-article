/**
 * TLV LiveKit Formal — room name SSOT (no manual room typing).
 * Room = deterministic function of Formal broadcast id.
 * PoC shared room (tlv-livekit-poc-qa) is intentionally separate.
 */
(function (global) {
  "use strict";

  var ROOM_RE = /^[a-zA-Z0-9._-]{1,96}$/;
  var PREFIX = "tlv_";

  /**
   * @param {string} broadcastId
   * @returns {string}
   */
  function roomNameFromBroadcastId(broadcastId) {
    var id = String(broadcastId || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!id) throw new Error("invalid_broadcast_id");
    var name = PREFIX + id;
    if (name.length > 96) name = name.slice(0, 96);
    if (!ROOM_RE.test(name)) throw new Error("invalid_room");
    return name;
  }

  /**
   * @param {string} roomName
   * @returns {string}
   */
  function broadcastIdFromRoomName(roomName) {
    var n = String(roomName || "").trim();
    if (n.indexOf(PREFIX) === 0) return n.slice(PREFIX.length);
    return n;
  }

  function isFormalRoomName(roomName) {
    return String(roomName || "").trim().indexOf(PREFIX) === 0;
  }

  global.TasuTlvLiveKitRoom = {
    PREFIX: PREFIX,
    ROOM_RE: ROOM_RE,
    roomNameFromBroadcastId: roomNameFromBroadcastId,
    broadcastIdFromRoomName: broadcastIdFromRoomName,
    isFormalRoomName: isFormalRoomName,
  };
})(typeof window !== "undefined" ? window : globalThis);
