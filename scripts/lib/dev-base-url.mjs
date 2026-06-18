/**
 * ローカル検証用 dev サーバー URL（ベンチ確認は 5500 固定）
 * - 正: http://localhost:5500 （Live Server / 静的配信）
 * - 上書き: BASE_URL または BENCH_BASE_URL
 */
export const DEV_PORT = Number(process.env.BENCH_DEV_PORT || process.env.DEV_PORT || 5500);

function resolveBaseUrl() {
  const fallback = `http://localhost:${DEV_PORT}`;
  const env = String(process.env.BASE_URL || process.env.BENCH_BASE_URL || "").replace(/\/$/, "");
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
 * ベンチ用 dev サーバー（既定 5500）が応答するか確認する。
 * @returns {Promise<string>} 到達できた BASE_URL
 */
export async function requireDevServer() {
  const candidates = [];
  if (BASE_URL) candidates.push(BASE_URL);
  for (const host of ["http://localhost", "http://127.0.0.1"]) {
    const base = `${host}:${DEV_PORT}`;
    if (!candidates.includes(base)) candidates.push(base);
  }

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/chat-dual-window-demo.html`, { method: "HEAD" });
      if (res.ok) return base.replace(/\/$/, "");
    } catch {
      /* next */
    }
  }

  throw new Error(
    `Bench dev server not reachable (tried ${candidates.join(", ")}). ` +
      `Start Live Server on port ${DEV_PORT} for this repo root.`
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
