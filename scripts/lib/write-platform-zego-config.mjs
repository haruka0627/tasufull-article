/**
 * dist/platform-live/platform-live-zego-config.js を .env から生成（secret は含めない）
 */
import fs from "node:fs";
import path from "node:path";
import { readZegoEnv } from "./zego-env.mjs";

/**
 * @param {string} distPlatformLiveDir deploy/cloudflare/dist/platform-live
 * @param {ReturnType<typeof readZegoEnv>} [envState]
 */
export function writePlatformZegoConfigToDist(distPlatformLiveDir, envState) {
  const env = envState || readZegoEnv();
  if (!env.appId || !env.server) {
    return { ok: false, reason: "ZEGO_APP_ID / ZEGO_SERVER が未設定" };
  }

  fs.mkdirSync(distPlatformLiveDir, { recursive: true });
  const dest = path.join(distPlatformLiveDir, "platform-live-zego-config.js");
  const body = `/**
 * Generated from .env — do not commit
 * Source: scripts/lib/write-platform-zego-config.mjs
 */
window.PLATFORM_LIVE_ZEGO_CONFIG = {
  provider: "zego",
  appId: ${env.appId},
  server: ${JSON.stringify(env.server)},
  tokenApiPath: "/api/tlv-zego-token",
};
`;
  fs.writeFileSync(dest, body, "utf8");
  return { ok: true, path: dest, appId: env.appId };
}

/**
 * Platform + TLV PoC 双方の dist config を生成
 * @param {string} distRoot deploy/cloudflare/dist
 * @param {ReturnType<typeof readZegoEnv>} [envState]
 */
export function writeAllZegoConfigsToDist(distRoot, envState) {
  const env = envState || readZegoEnv();
  const platform = writePlatformZegoConfigToDist(path.join(distRoot, "platform-live"), env);

  const liveDir = path.join(distRoot, "live");
  fs.mkdirSync(liveDir, { recursive: true });
  const liveDest = path.join(liveDir, "live-zego-config.js");
  if (env.appId && env.server) {
    const liveBody = `/**
 * Generated from .env — do not commit
 * Source: scripts/lib/write-platform-zego-config.mjs
 */
window.TLV_LIVE_ZEGO_CONFIG = {
  provider: "zego",
  appId: ${env.appId},
  server: ${JSON.stringify(env.server)},
  tokenApiPath: "/api/tlv-zego-token",
};
`;
    fs.writeFileSync(liveDest, liveBody, "utf8");
  }

  return { platform, live: env.appId && env.server ? { ok: true, path: liveDest } : { ok: false } };
}
