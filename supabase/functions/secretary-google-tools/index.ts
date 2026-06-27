/**
 * AI秘書 Phase 6-C — Google Workspace tools (Gmail read-only)
 * POST { action: "health" | "capabilities" | "gmail" | "execute" }
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  executeGmailRead,
  GMAIL_READ_METHODS,
  GMAIL_WRITE_METHODS,
  isGmailWriteMethod,
} from "../_shared/secretary-google-gmail.ts";
import {
  getSecretaryGoogleConfig,
  readVaultPublicStatus,
  resolveSecretaryUserId,
  sanitizeForClient,
} from "../_shared/secretary-google-oauth.ts";

const TOOL_STATUS = Object.freeze({
  gmail: { phase: "6-C", status: "read_only", methods: [...GMAIL_READ_METHODS] },
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
        phase: "6-C",
        service: "secretary-google-tools",
        configured: config.configured,
        mock: config.mock,
        tools: TOOL_STATUS,
        gmailWriteForbidden: [...GMAIL_WRITE_METHODS],
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
        phase: "6-C",
        googleConnected: Boolean(connection?.connected),
        googleAccountEmail: connection?.googleAccountEmail || null,
        tools: TOOL_STATUS,
        note: "Gmail read-only live · send/draft/delete blocked until Phase 6-D",
      }),
      200,
      req
    );
  }

  if (action === "gmail") {
    if (!userId) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
    }
    const method = String(body.method || "").trim();
    if (isGmailWriteMethod(method)) {
      return jsonResponse(
        { ok: false, error: "gmail_write_forbidden", method, phase: "6-D" },
        403,
        req
      );
    }
    const result = await executeGmailRead(userId, {
      method,
      q: typeof body.q === "string" ? body.q : undefined,
      messageId: typeof body.messageId === "string" ? body.messageId : undefined,
      threadId: typeof body.threadId === "string" ? body.threadId : undefined,
      maxResults: Number(body.maxResults) || undefined,
      pageToken: typeof body.pageToken === "string" ? body.pageToken : undefined,
      labelIds: Array.isArray(body.labelIds) ? body.labelIds.map(String) : undefined,
    });
    const status = result.ok ? 200 : 502;
    return jsonResponse(sanitizeForClient(result as Record<string, unknown>), status, req);
  }

  if (action === "execute") {
    const tool = String(body.tool || "").trim();
    if (tool === "gmail") {
      return jsonResponse(
        { ok: false, error: "use_action_gmail", hint: "POST action=gmail with method" },
        400,
        req
      );
    }
    if (!tool || !Object.prototype.hasOwnProperty.call(TOOL_STATUS, tool)) {
      return jsonResponse({ ok: false, error: "unknown_tool", tool }, 400, req);
    }
    const meta = TOOL_STATUS[tool as keyof typeof TOOL_STATUS];
    return jsonResponse(
      { ok: false, error: "not_implemented", tool, phase: meta.phase },
      501,
      req
    );
  }

  return jsonResponse({ ok: false, error: "unknown_action" }, 400, req);
});
