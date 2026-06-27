import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { executeWebSearch, trimQuery } from "../_shared/web-search-provider.ts";

type RequestBody = {
  query?: string;
  num?: number;
};

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405, req);
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
    const result = await executeWebSearch(query, num, {
      WEB_SEARCH_PROVIDER: Deno.env.get("WEB_SEARCH_PROVIDER") ?? undefined,
      BRAVE_SEARCH_API_KEY: Deno.env.get("BRAVE_SEARCH_API_KEY") ?? undefined,
      SERPER_API_KEY: Deno.env.get("SERPER_API_KEY") ?? undefined,
      BRAVE_SEARCH_COUNTRY: Deno.env.get("BRAVE_SEARCH_COUNTRY") ?? undefined,
      BRAVE_SEARCH_LANG: Deno.env.get("BRAVE_SEARCH_LANG") ?? undefined,
    });

    if (!result.ok) {
      return jsonResponse(
        {
          ok: false,
          message: result.message,
          provider: result.provider,
        },
        result.httpStatus,
        req
      );
    }

    return jsonResponse(
      {
        ok: true,
        query: result.query,
        results: result.results,
        provider: result.provider,
      },
      200,
      req
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, message }, 500, req);
  }
});
