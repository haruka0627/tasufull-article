/**
 * Web search providers — Serper (legacy) / Brave Web Search (Phase 1 drop-in).
 * Gateway contract unchanged: Edge returns normalized results → client formatContextForAi → searchContext string.
 */

export type WebSearchProviderName = "brave" | "serper";

export type WebSearchResult = {
  title: string;
  snippet: string;
  link: string;
  url: string;
  source: string;
};

export type WebSearchEnv = {
  WEB_SEARCH_PROVIDER?: string;
  BRAVE_SEARCH_API_KEY?: string;
  SERPER_API_KEY?: string;
  /** Override for tests — default JP */
  BRAVE_SEARCH_COUNTRY?: string;
  BRAVE_SEARCH_LANG?: string;
};

export function trimQuery(value: unknown, maxLen = 400): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

export function sourceFromLink(link: string): string {
  try {
    const host = new URL(link).hostname.replace(/^www\./i, "");
    return host || link;
  } catch {
    return link.slice(0, 80);
  }
}

export function normalizeWebResult(
  item: { title?: string; snippet?: string; link?: string; url?: string },
  numCap: number
): WebSearchResult | null {
  const link = trimQuery(item.link || item.url, 2000);
  if (!link) return null;
  return {
    title: trimQuery(item.title, 300),
    snippet: trimQuery(item.snippet, 800),
    link,
    url: link,
    source: sourceFromLink(link),
  };
}

/** WEB_SEARCH_PROVIDER=brave|serper; default brave when BRAVE key set, else serper. */
export function resolveWebSearchProvider(env: WebSearchEnv): WebSearchProviderName {
  const explicit = String(env.WEB_SEARCH_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (explicit === "brave" || explicit === "serper") return explicit;
  if (env.BRAVE_SEARCH_API_KEY?.trim()) return "brave";
  return "serper";
}

type BraveWebResult = {
  title?: string;
  url?: string;
  description?: string;
  extra_snippets?: string[];
};

export function parseBraveWebResponse(data: unknown, num: number): WebSearchResult[] {
  const web = (data as { web?: { results?: BraveWebResult[] } })?.web;
  const rows = Array.isArray(web?.results) ? web!.results! : [];
  const out: WebSearchResult[] = [];
  for (const item of rows) {
    if (out.length >= num) break;
    const link = trimQuery(item.url, 2000);
    if (!link) continue;
    let snippet = trimQuery(item.description, 800);
    if (!snippet && Array.isArray(item.extra_snippets) && item.extra_snippets.length) {
      snippet = trimQuery(item.extra_snippets.join(" "), 800);
    }
    out.push({
      title: trimQuery(item.title, 300),
      snippet,
      link,
      url: link,
      source: sourceFromLink(link),
    });
  }
  return out;
}

type SerperOrganic = {
  title?: string;
  snippet?: string;
  link?: string;
};

export function parseSerperResponse(data: unknown, num: number): WebSearchResult[] {
  const organic = (data as { organic?: SerperOrganic[] })?.organic;
  const rows = Array.isArray(organic) ? organic : [];
  const out: WebSearchResult[] = [];
  for (const item of rows) {
    if (out.length >= num) break;
    const normalized = normalizeWebResult(
      {
        title: item.title,
        snippet: item.snippet,
        link: item.link,
      },
      num
    );
    if (normalized) out.push(normalized);
  }
  return out;
}

export function normalizeBraveApiKey(raw: unknown): string {
  let key = String(raw ?? "").trim();
  key = key.replace(/[\r\n]+/g, "");
  if (/^Bearer\s+/i.test(key)) {
    key = key.replace(/^Bearer\s+/i, "").trim();
  }
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

export async function fetchBraveWebSearch(
  query: string,
  num: number,
  apiKey: string,
  env: WebSearchEnv = {},
  fetchFn: typeof fetch = fetch
): Promise<{ ok: true; results: WebSearchResult[] } | { ok: false; message: string; status: number }> {
  const token = normalizeBraveApiKey(apiKey);
  if (!token) {
    return { ok: false, status: 503, message: "BRAVE_SEARCH_API_KEY is empty after normalize" };
  }

  const count = Math.min(20, Math.max(1, num));
  const country = trimQuery(env.BRAVE_SEARCH_COUNTRY || "JP", 8) || "JP";
  const searchLang = trimQuery(env.BRAVE_SEARCH_LANG || "jp", 8) || "jp";
  const params = new URLSearchParams({
    q: query,
    count: String(count),
    country,
    search_lang: searchLang,
  });

  const url = `https://api.search.brave.com/res/v1/web/search?${params}`;
  const res = await fetchFn(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": token,
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      message: `Brave API error (${res.status})${errText ? `: ${errText.slice(0, 200)}` : ""}`,
    };
  }

  const data = await res.json().catch(() => ({}));
  const results = parseBraveWebResponse(data, num);
  return { ok: true, results };
}

export async function fetchSerperSearch(
  query: string,
  num: number,
  apiKey: string,
  fetchFn: typeof fetch = fetch
): Promise<{ ok: true; results: WebSearchResult[] } | { ok: false; message: string; status: number }> {
  const res = await fetchFn("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      message: `Serper API error (${res.status})${errText ? `: ${errText.slice(0, 200)}` : ""}`,
    };
  }

  const data = await res.json().catch(() => ({}));
  const results = parseSerperResponse(data, num);
  return { ok: true, results };
}

export async function executeWebSearch(
  query: string,
  num: number,
  env: WebSearchEnv,
  fetchFn: typeof fetch = fetch
): Promise<
  | { ok: true; query: string; results: WebSearchResult[]; provider: WebSearchProviderName }
  | { ok: false; message: string; httpStatus: number; provider?: WebSearchProviderName }
> {
  const provider = resolveWebSearchProvider(env);
  const cappedNum = Math.min(10, Math.max(1, num));

  if (provider === "brave") {
    const apiKey = normalizeBraveApiKey(env.BRAVE_SEARCH_API_KEY);
    if (!apiKey) {
      return {
        ok: false,
        httpStatus: 503,
        provider,
        message: "BRAVE_SEARCH_API_KEY is not configured",
      };
    }
    const out = await fetchBraveWebSearch(query, cappedNum, apiKey, env, fetchFn);
    if (!out.ok) {
      return { ok: false, httpStatus: 502, provider, message: out.message };
    }
    return { ok: true, query, results: out.results, provider };
  }

  const serperKey = env.SERPER_API_KEY?.trim();
  if (!serperKey) {
    return {
      ok: false,
      httpStatus: 503,
      provider,
      message: "SERPER_API_KEY is not configured",
    };
  }
  const out = await fetchSerperSearch(query, cappedNum, serperKey, fetchFn);
  if (!out.ok) {
    return { ok: false, httpStatus: 502, provider, message: out.message };
  }
  return { ok: true, query, results: out.results, provider };
}
