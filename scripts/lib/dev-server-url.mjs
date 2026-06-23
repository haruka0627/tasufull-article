/**
 * ローカル dev サーバー URL（Playwright / 手動確認共通）
 * 標準: http://127.0.0.1:8788 （wrangler pages dev / Cloudflare Pages dist）
 * file:// 直開きは不可。
 */
export const STANDARD_LOCAL_BASE = "http://127.0.0.1:8788";

export const DEFAULT_DEV_SERVER_PORTS = Object.freeze([8788]);

export function isAllowedLocalHttpUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:") return false;
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function assertLocalHttpUrl(url, label = "URL") {
  const value = String(url || "");
  if (value.startsWith("file:")) {
    throw new Error(
      `${label} must not use file://. Start \`npm run dev\` and open ${STANDARD_LOCAL_BASE}/...`
    );
  }
  if (!isAllowedLocalHttpUrl(value)) {
    throw new Error(`${label} must be http://localhost or http://127.0.0.1 — got: ${value}`);
  }
}

export function buildLocalPageUrl(base, pagePath, search = "") {
  assertLocalHttpUrl(base, "base URL");
  const path = String(pagePath || "").replace(/^\//, "");
  const q = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  return `${base.replace(/\/$/, "")}/${path}${q}`;
}

/**
 * @param {{ ports?: number[], probePath?: string, hosts?: string[] }} [options]
 */
export async function findDevServerBaseUrl(options = {}) {
  const probePath = String(options.probePath || "index.html").replace(/^\//, "");
  const ports = options.ports || DEFAULT_DEV_SERVER_PORTS;
  const hosts = options.hosts || ["http://127.0.0.1", "http://localhost"];

  for (const envKey of ["BASE_URL", "PAGES_BASE_URL", "BENCH_BASE_URL"]) {
    const envBase = String(process.env[envKey] || "").replace(/\/$/, "");
    if (!envBase || !isAllowedLocalHttpUrl(envBase)) continue;
    try {
      const res = await fetch(`${envBase}/${probePath}`, { method: "GET" });
      if (res.ok) return envBase;
    } catch {
      /* fall through to port scan */
    }
  }

  for (const host of hosts) {
    for (const port of ports) {
      const base = `${host.replace(/\/$/, "")}:${port}`;
      try {
        const res = await fetch(`${base}/${probePath}`, { method: "GET" });
        if (res.ok) return base;
      } catch {
        /* try next port */
      }
    }
  }

  throw new Error(
    [
      "No local dev server found.",
      "1) npm run build:pages",
      "2) npm run dev",
      `3) open ${STANDARD_LOCAL_BASE}/${probePath}`,
    ].join("\n")
  );
}

export async function assertPlaywrightLocalhostPage(page) {
  const url = page.url();
  assertLocalHttpUrl(url, "Playwright page URL");
  return url;
}
