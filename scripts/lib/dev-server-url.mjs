/**
 * ローカル dev サーバー URL（Playwright / 手動確認共通）
 * file:// 直開きは不可。http://localhost または http://127.0.0.1 のみ許可。
 */
export const DEFAULT_DEV_SERVER_PORTS = Object.freeze([5173, 5500, 5174, 5176, 5199, 5200, 5188]);

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
      `${label} must not use file://. Run \`npm run dev\` and open http://localhost:5173/...`
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
  const ports = options.ports || DEFAULT_DEV_SERVER_PORTS;
  const probePath = String(options.probePath || "index.html").replace(/^\//, "");
  const hosts = options.hosts || ["http://localhost", "http://127.0.0.1"];

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
      "Run: npm run dev",
      `Then open: http://localhost:5173/${probePath}`,
      "(Live Server の場合は http://localhost:5500/... も可)",
    ].join("\n")
  );
}

export async function assertPlaywrightLocalhostPage(page) {
  const url = page.url();
  assertLocalHttpUrl(url, "Playwright page URL");
  return url;
}
