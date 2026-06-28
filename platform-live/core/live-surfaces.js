/**
 * Live Platform — surface 定数（SDK 非依存）
 * Phase A · platform MVP · tlv/talk/builder は予約のみ
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_SURFACES = Object.freeze({
    PLATFORM: "platform",
    TLV: "tlv",
    TALK: "talk",
    BUILDER: "builder",
  });

  /** @readonly MVP で lifecycle テスト対象 */
  const LIVE_SURFACE_MVP = LIVE_SURFACES.PLATFORM;

  /** @readonly 予約 surface（接続なし · 検証のみ） */
  const LIVE_SURFACE_RESERVED = Object.freeze([
    LIVE_SURFACES.TLV,
    LIVE_SURFACES.TALK,
    LIVE_SURFACES.BUILDER,
  ]);

  global.TasuLivePlatformSurfaces = LIVE_SURFACES;
  global.LIVE_SURFACES = LIVE_SURFACES;
  global.LIVE_SURFACE_MVP = LIVE_SURFACE_MVP;
})(typeof window !== "undefined" ? window : globalThis);
