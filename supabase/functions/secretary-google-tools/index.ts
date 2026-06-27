/**
 * AI秘書 Phase 6-B — Google Workspace tools Edge skeleton (no Gmail/Calendar API yet)
 * POST { action: "health" | "capabilities" }
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  getSecretaryGoogleConfig,
  readVaultPublicStatus,
  resolveSecretaryUserId,
  sanitizeForClient,
} from "../_shared/secretary-google-oauth.ts";

const TOOL_STUBS = Object.freeze({
  gmail: { phase: "6-C", status: "stub", methods: ["messages.list", "messages.send"] },
  calendar: { phase: "6-E", status: "stub", methods: ["events.list", "freebusy.query"] },
  contacts: { phase: "6-G", status: "stub", methods: ["people.searchContacts"] },
  drive: { phase: "6-H", status: "stub", methods: ["files.list"] },
});

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, req);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400, req);
  }

  const action = String(body.action || "health").trim();
  const config = getSecretaryGoogleConfig();
  const userId = resolveSecretaryUserId(req);

  if (action === "health") {
    return jsonResponse(
      sanitizeForClient({
        ok: true,
        phase: "6-B",
        service: "secretary-google-tools",
        configured: config.configured,
        mock: config.mock,
        tools: TOOL_STUBS,
      }),
      200,
      req
    );
  }

  if (action === "capabilities") {
    const connection = userId ? await readVaultPublicStatus(userId) : null;
    return jsonResponse(
      sanitizeForClient({
        ok: true,
        phase: "6-B",
        googleConnected: Boolean(connection?.connected),
        googleAccountEmail: connection?.googleAccountEmail || null,
        tools: TOOL_STUBS,
        note: "Real Google API execution starts in Phase 6-C+",
      }),
      200,
      req
    );
  }

  if (action === "execute") {
    const tool = String(body.tool || "").trim();
    if (!tool || !Object.prototype.hasOwnProperty.call(TOOL_STUBS, tool)) {
      return jsonResponse({ ok: false, error: "unknown_tool", tool }, 400, req);
    }
    return jsonResponse(
      {
        ok: false,
        error: "not_implemented",
        tool,
        phase: TOOL_STUBS[tool as keyof typeof TOOL_STUBS].phase,
      },
      501,
      req
    );
  }

  return jsonResponse({ ok: false, error: "unknown_action" }, 400, req);
});
