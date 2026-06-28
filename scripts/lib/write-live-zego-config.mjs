/**
 * dist/live/live-zego-config.js を .env から生成（secret は含めない）
 */
import fs from "node:fs";
import path from "node:path";
import { readZegoEnv } from "./zego-env.mjs";

/**
 * @param {string} distLiveDir deploy/cloudflare/dist/live
 * @param {ReturnType<typeof readZegoEnv>} [envState]
 */
export function writeLiveZegoConfigToDist(distLiveDir, envState) {
  const env = envState || readZegoEnv();
  if (!env.appId || !env.server) {
    return { ok: false, reason: "ZEGO_APP_ID / ZEGO_SERVER が未設定" };
  }

  fs.mkdirSync(distLiveDir, { recursive: true });
  const dest = path.join(distLiveDir, "live-zego-config.js");
  const body = `/**
 * Generated from .env — do not commit
 * Source: scripts/lib/write-live-zego-config.mjs
 */
window.TLV_LIVE_ZEGO_CONFIG = {
  provider: "zego",
  appId: ${env.appId},
  server: ${JSON.stringify(env.server)},
  tokenApiPath: "/api/tlv-zego-token",
};
`;
  fs.writeFileSync(dest, body, "utf8");
  return { ok: true, path: dest, appId: env.appId };
}
