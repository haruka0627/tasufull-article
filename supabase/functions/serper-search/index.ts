import { handleOptions, jsonResponse } from "../_shared/cors.ts";

type SerperOrganic = {
  title?: string;
  snippet?: string;
  link?: string;
};

type RequestBody = {
  query?: string;
  num?: number;
};

function trimQuery(value: unknown, maxLen = 400): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

function sourceFromLink(link: string): string {
  try {
    const host = new URL(link).hostname.replace(/^www\./i, "");
    return host || link;
  } catch {
    return link.slice(0, 80);
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405, req);
  }

  const apiKey = Deno.env.get("SERPER_API_KEY")?.trim();
  if (!apiKey) {
    return jsonResponse({ ok: false, message: "SERPER_API_KEY is not configured" }, 503, req);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ ok: false, message: "Invalid JSON body" }, 400, req);
  }

  const query = trimQuery(body.query);
  if (!query) {
    return jsonResponse({ ok: false, message: "query is required" }, 400, req);
  }

  const num = Math.min(10, Math.max(1, Number(body.num) || 5));

  try {
    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num }),
    });

    if (!serperRes.ok) {
      const errText = await serperRes.text().catch(() => "");
      return jsonResponse(
        {
          ok: false,
          message: `Serper API error (${serperRes.status})${errText ? `: ${errText.slice(0, 200)}` : ""}`,
        },
        502,
        req
      );
    }

    const data = (await serperRes.json()) as { organic?: SerperOrganic[] };
    const organic = Array.isArray(data.organic) ? data.organic : [];

    const results = organic.slice(0, num).map((item) => {
      const link = trimQuery(item.link, 2000);
      return {
        title: trimQuery(item.title, 300),
        snippet: trimQuery(item.snippet, 800),
        link,
        source: link ? sourceFromLink(link) : "",
      };
    });

    return jsonResponse(
      {
        ok: true,
        query,
        results,
      },
      200,
      req
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, message }, 500, req);
  }
});
