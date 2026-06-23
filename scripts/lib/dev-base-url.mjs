/**
 * ローカル検証用 dev サーバー URL
 * 標準: http://127.0.0.1:8788 （wrangler pages dev / Cloudflare Pages dist）
 * 上書き: BASE_URL / PAGES_BASE_URL / BENCH_BASE_URL
 */
import { STANDARD_LOCAL_BASE } from "./dev-server-url.mjs";

export { STANDARD_LOCAL_BASE };

export const DEV_PORT = Number(
  process.env.BENCH_DEV_PORT || process.env.DEV_PORT || new URL(STANDARD_LOCAL_BASE).port || 8788
);

function resolveBaseUrl() {
  const fallback = STANDARD_LOCAL_BASE;
  const env = String(
    process.env.BASE_URL || process.env.PAGES_BASE_URL || process.env.BENCH_BASE_URL || ""
  ).replace(/\/$/, "");
  if (!env) return fallback;
  try {
    new URL(env);
    return env;
  } catch {
    console.warn(`[dev] Ignoring invalid BASE_URL=${env}`);
  }
  return fallback;
}

export const BASE_URL = resolveBaseUrl();

/** @param {string} [path] */
export function devUrl(path = "") {
  const p = String(path || "");
  if (!p) return BASE_URL;
  return `${BASE_URL}${p.startsWith("/") ? p : `/${p}`}`;
}

/**
 * ローカル dev サーバー（既定 8788）が応答するか確認する。
 * @returns {Promise<string>} 到達できた BASE_URL
 */
export async function requireDevServer() {
  const candidates = [];
  if (BASE_URL) candidates.push(BASE_URL);
  for (const host of ["http://127.0.0.1", "http://localhost"]) {
    const base = `${host}:${DEV_PORT}`;
    if (!candidates.includes(base)) candidates.push(base);
  }

  for (const base of candidates) {
    for (const probe of ["index.html", "chat-dual-window-demo.html"]) {
      try {
        const res = await fetch(`${base}/${probe}`, { method: "HEAD" });
        if (res.ok) return base.replace(/\/$/, "");
      } catch {
        /* next */
      }
    }
  }

  throw new Error(
    `Dev server not reachable (tried ${candidates.join(", ")}). ` +
      `Run: npm run build:pages && npm run dev  →  ${STANDARD_LOCAL_BASE}/`
  );
}

/**
 * スクショ報告用に URL をログ出力する。
 * @param {string} label
 * @param {string} pathnameWithQuery
 */
export function logScreenshotUrl(label, pathnameWithQuery) {
  const url = devUrl(pathnameWithQuery);
  console.log(`[screenshot] ${label}: ${url}`);
  return url;
}
