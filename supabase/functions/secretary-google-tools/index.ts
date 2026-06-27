/**
 * AI秘書 Phase 6-H — Google Workspace tools (Gmail + Calendar + Contacts + Drive)
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  executeDriveRead,
  DRIVE_READ_METHODS,
  DRIVE_WRITE_METHODS,
  isDriveWriteMethod,
} from "../_shared/secretary-google-drive.ts";
import {
  executeContactsRead,
  CONTACTS_READ_METHODS,
  CONTACTS_WRITE_METHODS,
  isContactsWriteMethod,
} from "../_shared/secretary-google-contacts.ts";
import {
  executeCalendarRead,
  executeCalendarWrite,
  CALENDAR_READ_METHODS,
  CALENDAR_WRITE_ALLOWED_PHASE6F,
  CALENDAR_WRITE_METHODS,
  isCalendarWriteBlockedPhase6F,
  isCalendarWriteMethod,
} from "../_shared/secretary-google-calendar.ts";
import {
  executeGmailRead,
  executeGmailWrite,
  GMAIL_READ_METHODS,
  GMAIL_WRITE_ALLOWED_PHASE6D,
  GMAIL_WRITE_METHODS,
  isGmailWriteBlockedPhase6D,
  isGmailWriteMethod,
} from "../_shared/secretary-google-gmail.ts";
import {
  getSecretaryGoogleConfig,
  readVaultPublicStatus,
  resolveSecretaryUserId,
  sanitizeForClient,
} from "../_shared/secretary-google-oauth.ts";

const TOOL_STATUS = Object.freeze({
  gmail: {
    phase: "6-D",
    status: "read_write_human_gate",
    readMethods: [...GMAIL_READ_METHODS],
    writeMethods: [...GMAIL_WRITE_ALLOWED_PHASE6D],
  },
  calendar: {
    phase: "6-F",
    status: "read_write_human_gate",
    readMethods: [...CALENDAR_READ_METHODS],
    writeMethods: [...CALENDAR_WRITE_ALLOWED_PHASE6F],
  },
  contacts: {
    phase: "6-G",
    status: "read_only",
    readMethods: [...CONTACTS_READ_METHODS],
    writeMethods: [],
  },
  drive: {
    phase: "6-H",
    status: "read_only",
    readMethods: [...DRIVE_READ_METHODS],
    writeMethods: [],
  },
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
        phase: "6-H",
        service: "secretary-google-tools",
        configured: config.configured,
        mock: config.mock,
        tools: TOOL_STATUS,
        gmailWriteAllowed: [...GMAIL_WRITE_ALLOWED_PHASE6D],
        gmailWriteForbidden: GMAIL_WRITE_METHODS.filter((m) => isGmailWriteBlockedPhase6D(m)),
        calendarWriteAllowed: [...CALENDAR_WRITE_ALLOWED_PHASE6F],
        calendarWriteForbidden: CALENDAR_WRITE_METHODS.filter((m) => isCalendarWriteBlockedPhase6F(m)),
        humanGateRequired: true,
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
        phase: "6-H",
        googleConnected: Boolean(connection?.connected),
        googleAccountEmail: connection?.googleAccountEmail || null,
        tools: TOOL_STATUS,
        note: "Calendar write requires Human Gate · Gmail write requires Human Gate",
      }),
      200,
      req
    );
  }

  if (action === "calendar_read") {
    if (!userId) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
    }
    const method = String(body.method || "").trim();
    if (isCalendarWriteMethod(method)) {
      return jsonResponse({ ok: false, error: "calendar_read_only", method, phase: "6-E" }, 403, req);
    }
    const result = await executeCalendarRead(userId, {
      method,
      calendarId: typeof body.calendarId === "string" ? body.calendarId : undefined,
      eventId: typeof body.eventId === "string" ? body.eventId : undefined,
      preset: typeof body.preset === "string" ? body.preset : undefined,
      timeMin: typeof body.timeMin === "string" ? body.timeMin : undefined,
      timeMax: typeof body.timeMax === "string" ? body.timeMax : undefined,
      q: typeof body.q === "string" ? body.q : undefined,
      maxResults: Number(body.maxResults) || undefined,
      pageToken: typeof body.pageToken === "string" ? body.pageToken : undefined,
    });
    const status = result.ok ? 200 : result.error === "calendar_read_only" ? 403 : 502;
    return jsonResponse(sanitizeForClient(result as Record<string, unknown>), status, req);
  }

  if (action === "calendar_write") {
    if (!userId) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
    }
    const method = String(body.method || "").trim();
    if (isCalendarWriteBlockedPhase6F(method)) {
      return jsonResponse({ ok: false, error: "calendar_write_forbidden", method, phase: "6-F+" }, 403, req);
    }
    const attendees = Array.isArray(body.attendees) ? body.attendees.map(String) : undefined;
    const result = await executeCalendarWrite(userId, {
      method,
      humanGateApproved: body.humanGateApproved === true,
      pendingId: typeof body.pendingId === "string" ? body.pendingId : undefined,
      calendarId: typeof body.calendarId === "string" ? body.calendarId : undefined,
      eventId: typeof body.eventId === "string" ? body.eventId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      start: typeof body.start === "string" ? body.start : undefined,
      end: typeof body.end === "string" ? body.end : undefined,
      allDay: body.allDay === true,
      location: typeof body.location === "string" ? body.location : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      attendees,
      timeZone: typeof body.timeZone === "string" ? body.timeZone : undefined,
    });
    const status = result.ok ? 200 : result.error === "human_gate_required" ? 403 : 502;
    return jsonResponse(sanitizeForClient(result as Record<string, unknown>), status, req);
  }

  if (action === "contacts_read") {
    if (!userId) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
    }
    const method = String(body.method || "").trim();
    if (isContactsWriteMethod(method)) {
      return jsonResponse({ ok: false, error: "contacts_read_only", method, phase: "6-G" }, 403, req);
    }
    const result = await executeContactsRead(userId, {
      method,
      resourceName: typeof body.resourceName === "string" ? body.resourceName : undefined,
      query: typeof body.query === "string" ? body.query : undefined,
      maxResults: Number(body.maxResults) || undefined,
      pageToken: typeof body.pageToken === "string" ? body.pageToken : undefined,
    });
    const status = result.ok ? 200 : result.error === "contacts_read_only" ? 403 : 502;
    return jsonResponse(sanitizeForClient(result as Record<string, unknown>), status, req);
  }

  if (action === "drive_read") {
    if (!userId) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
    }
    const method = String(body.method || "").trim();
    if (isDriveWriteMethod(method)) {
      return jsonResponse({ ok: false, error: "drive_read_only", method, phase: "6-H" }, 403, req);
    }
    const result = await executeDriveRead(userId, {
      method,
      fileId: typeof body.fileId === "string" ? body.fileId : undefined,
      folderId: typeof body.folderId === "string" ? body.folderId : undefined,
      preset: typeof body.preset === "string" ? body.preset : undefined,
      q: typeof body.q === "string" ? body.q : undefined,
      mimeType: typeof body.mimeType === "string" ? body.mimeType : undefined,
      exportMimeType: typeof body.exportMimeType === "string" ? body.exportMimeType : undefined,
      maxResults: Number(body.maxResults) || undefined,
      pageToken: typeof body.pageToken === "string" ? body.pageToken : undefined,
    });
    const status = result.ok ? 200 : result.error === "drive_read_only" ? 403 : 502;
    return jsonResponse(sanitizeForClient(result as Record<string, unknown>), status, req);
  }

  if (action === "gmail") {
    if (!userId) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
    }
    const method = String(body.method || "").trim();
    if (isGmailWriteMethod(method)) {
      return jsonResponse(
        { ok: false, error: "gmail_write_use_gmail_write", method, phase: "6-D" },
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

  if (action === "gmail_write") {
    if (!userId) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
    }
    const method = String(body.method || "").trim();
    if (isGmailWriteBlockedPhase6D(method)) {
      return jsonResponse(
        { ok: false, error: "gmail_write_forbidden", method, phase: "6-D+" },
        403,
        req
      );
    }
    const result = await executeGmailWrite(userId, {
      method,
      humanGateApproved: body.humanGateApproved === true,
      pendingId: typeof body.pendingId === "string" ? body.pendingId : undefined,
      to: typeof body.to === "string" ? body.to : undefined,
      subject: typeof body.subject === "string" ? body.subject : undefined,
      body: typeof body.body === "string" ? body.body : undefined,
      threadId: typeof body.threadId === "string" ? body.threadId : undefined,
      replyToMessageId: typeof body.replyToMessageId === "string" ? body.replyToMessageId : undefined,
      draftId: typeof body.draftId === "string" ? body.draftId : undefined,
    });
    const status = result.ok ? 200 : result.error === "human_gate_required" ? 403 : 502;
    return jsonResponse(sanitizeForClient(result as Record<string, unknown>), status, req);
  }

  if (action === "execute") {
    const tool = String(body.tool || "").trim();
    if (tool === "gmail") {
      return jsonResponse(
        { ok: false, error: "use_action_gmail", hint: "POST action=gmail or gmail_write" },
        400,
        req
      );
    }
    if (tool === "calendar") {
      return jsonResponse(
        { ok: false, error: "use_action_calendar", hint: "POST action=calendar_read or calendar_write" },
        400,
        req
      );
    }
    if (tool === "contacts") {
      return jsonResponse(
        { ok: false, error: "use_action_contacts", hint: "POST action=contacts_read" },
        400,
        req
      );
    }
    if (tool === "drive") {
      return jsonResponse(
        { ok: false, error: "use_action_drive", hint: "POST action=drive_read" },
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
