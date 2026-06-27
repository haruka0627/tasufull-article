/**
 * AI秘書 Phase 6-C — Gmail read-only API (Edge · server-side only)
 * Allowed: messages.list · messages.get · threads.get · labels.list
 * Forbidden: send · draft · delete · modify · trash
 */
import {
  ensureGoogleAccessToken,
  getSecretaryGoogleConfig,
  isSecretaryGoogleMockMode,
} from "./secretary-google-oauth.ts";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_READ_METHODS = Object.freeze([
  "messages.list",
  "messages.get",
  "threads.get",
  "labels.list",
]);

export const GMAIL_WRITE_METHODS = Object.freeze([
  "messages.send",
  "messages.insert",
  "messages.import",
  "messages.modify",
  "messages.trash",
  "messages.delete",
  "messages.batchDelete",
  "messages.batchModify",
  "drafts.create",
  "drafts.send",
  "drafts.update",
  "drafts.delete",
]);

export type GmailReadRequest = {
  method: string;
  q?: string;
  messageId?: string;
  threadId?: string;
  maxResults?: number;
  labelIds?: string[];
  pageToken?: string;
};

export type GmailAttachmentMeta = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type GmailMessageCard = {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  labelIds: string[];
  unread: boolean;
  important: boolean;
  hasAttachment: boolean;
  attachments: GmailAttachmentMeta[];
};

function trim(value: unknown, max = 4000): string {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeGmailQuery(q: string): string {
  return trim(q, 500).replace(/[\r\n\0]/g, " ");
}

export function isGmailReadMethod(method: string): boolean {
  return GMAIL_READ_METHODS.includes(String(method || "").trim());
}

export function isGmailWriteMethod(method: string): boolean {
  return GMAIL_WRITE_METHODS.includes(String(method || "").trim());
}

export function buildPresetQuery(preset: string): string {
  const p = trim(preset, 40).toLowerCase();
  if (p === "unread") return "is:unread in:inbox";
  if (p === "important") return "is:important in:inbox";
  if (p === "attachment" || p === "attachments") return "has:attachment in:inbox";
  if (p === "inbox") return "in:inbox";
  return "";
}

function headerValue(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  if (!Array.isArray(headers)) return "";
  const hit = headers.find((h) => String(h?.name || "").toLowerCase() === name.toLowerCase());
  return trim(hit?.value, 500);
}

function extractAttachmentMeta(payload: Record<string, unknown> | undefined): GmailAttachmentMeta[] {
  const out: GmailAttachmentMeta[] = [];
  function walk(part: Record<string, unknown> | undefined) {
    if (!part || typeof part !== "object") return;
    const body = part.body as Record<string, unknown> | undefined;
    const attachmentId = trim(body?.attachmentId, 200);
    const filename = trim(part.filename, 300);
    if (attachmentId && filename) {
      out.push({
        attachmentId,
        filename,
        mimeType: trim(part.mimeType, 120) || "application/octet-stream",
        size: Number(body?.size || 0) || 0,
      });
    }
    const parts = part.parts as Record<string, unknown>[] | undefined;
    if (Array.isArray(parts)) parts.forEach(walk);
  }
  walk(payload);
  return out.slice(0, 20);
}

function normalizeMessage(raw: Record<string, unknown>): GmailMessageCard {
  const payload = raw.payload as Record<string, unknown> | undefined;
  const headers = payload?.headers as Array<{ name?: string; value?: string }> | undefined;
  const labelIds = Array.isArray(raw.labelIds) ? raw.labelIds.map((x) => String(x)) : [];
  const attachments = extractAttachmentMeta(payload);
  return {
    id: String(raw.id || ""),
    threadId: String(raw.threadId || ""),
    snippet: trim(raw.snippet, 300),
    subject: headerValue(headers, "Subject") || "(件名なし)",
    from: headerValue(headers, "From") || "(不明)",
    date: headerValue(headers, "Date") || "",
    labelIds,
    unread: labelIds.includes("UNREAD"),
    important: labelIds.includes("IMPORTANT"),
    hasAttachment: attachments.length > 0 || labelIds.includes("ATTACHMENT"),
    attachments,
  };
}

const MOCK_LABELS = [
  { id: "INBOX", name: "INBOX", type: "system" },
  { id: "UNREAD", name: "UNREAD", type: "system" },
  { id: "IMPORTANT", name: "IMPORTANT", type: "system" },
  { id: "SENT", name: "SENT", type: "system" },
];

const MOCK_MESSAGES: GmailMessageCard[] = [
  {
    id: "mock_msg_001",
    threadId: "mock_thread_001",
    snippet: "【TASFUL】本日の運営サマリーをご確認ください。",
    subject: "本日の運営サマリー",
    from: "ops@tasful.example",
    date: new Date().toISOString(),
    labelIds: ["INBOX", "UNREAD", "IMPORTANT"],
    unread: true,
    important: true,
    hasAttachment: false,
    attachments: [],
  },
  {
    id: "mock_msg_002",
    threadId: "mock_thread_002",
    snippet: "Connect 本人確認の件でご連絡です。",
    subject: "Connect 審査フォロー",
    from: "partner@example.com",
    date: new Date(Date.now() - 86400000).toISOString(),
    labelIds: ["INBOX", "UNREAD"],
    unread: true,
    important: false,
    hasAttachment: true,
    attachments: [
      {
        attachmentId: "mock_att_1",
        filename: "kyc-scan.pdf",
        mimeType: "application/pdf",
        size: 245760,
      },
    ],
  },
  {
    id: "mock_msg_003",
    threadId: "mock_thread_003",
    snippet: "Platform 掲載に関する問い合わせです。",
    subject: "Re: 掲載審査について",
    from: "seller@example.com",
    date: new Date(Date.now() - 172800000).toISOString(),
    labelIds: ["INBOX"],
    unread: false,
    important: false,
    hasAttachment: false,
    attachments: [],
  },
];

function filterMockMessages(q: string, maxResults: number): GmailMessageCard[] {
  const query = sanitizeGmailQuery(q).toLowerCase();
  let list = MOCK_MESSAGES.slice();
  if (/is:unread/.test(query)) list = list.filter((m) => m.unread);
  if (/is:important/.test(query)) list = list.filter((m) => m.important);
  if (/has:attachment/.test(query)) list = list.filter((m) => m.hasAttachment);
  if (query && !/^is:|in:|has:/.test(query)) {
    list = list.filter(
      (m) =>
        m.subject.toLowerCase().includes(query) ||
        m.snippet.toLowerCase().includes(query) ||
        m.from.toLowerCase().includes(query)
    );
  }
  return list.slice(0, Math.min(Math.max(maxResults, 1), 25));
}

async function gmailFetch(
  accessToken: string,
  path: string,
  query?: Record<string, string | number | string[] | undefined>
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; error?: string }> {
  const url = new URL(`${GMAIL_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      if (k === "labelIds") {
        const arr = Array.isArray(v) ? v : [v];
        for (const id of arr) url.searchParams.append("labelIds", String(id));
        continue;
      }
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: trim((data.error as Record<string, unknown>)?.message || data.error || `http_${res.status}`, 300),
    };
  }
  return { ok: true, status: res.status, data };
}

async function executeMockGmail(req: GmailReadRequest) {
  const method = trim(req.method);
  const maxResults = Math.min(Math.max(Number(req.maxResults) || 10, 1), 25);
  const q = sanitizeGmailQuery(req.q || "");

  if (method === "labels.list") {
    return { ok: true, mock: true, labels: MOCK_LABELS };
  }
  if (method === "messages.list") {
    const messages = filterMockMessages(q, maxResults);
    return {
      ok: true,
      mock: true,
      q,
      messages,
      resultSizeEstimate: messages.length,
    };
  }
  if (method === "messages.get") {
    const id = trim(req.messageId, 120);
    const hit = MOCK_MESSAGES.find((m) => m.id === id) || MOCK_MESSAGES[0];
    return { ok: true, mock: true, message: hit };
  }
  if (method === "threads.get") {
    const threadId = trim(req.threadId, 120);
    const messages = MOCK_MESSAGES.filter((m) => m.threadId === threadId);
    return {
      ok: true,
      mock: true,
      thread: { id: threadId || "mock_thread_001", messages: messages.length ? messages : [MOCK_MESSAGES[0]] },
    };
  }
  return { ok: false, error: "unknown_gmail_method" };
}

async function executeLiveGmail(accessToken: string, req: GmailReadRequest) {
  const method = trim(req.method);
  const maxResults = Math.min(Math.max(Number(req.maxResults) || 10, 1), 25);
  const q = sanitizeGmailQuery(req.q || "");

  if (method === "labels.list") {
    const res = await gmailFetch(accessToken, "/labels");
    if (!res.ok) return res;
    const labels = Array.isArray(res.data?.labels) ? res.data?.labels : [];
    return { ok: true, labels };
  }

  if (method === "messages.list") {
    const listRes = await gmailFetch(accessToken, "/messages", {
      q: q || undefined,
      maxResults,
      pageToken: trim(req.pageToken, 200) || undefined,
      labelIds: req.labelIds,
    });
    if (!listRes.ok) return listRes;
    const refs = Array.isArray(listRes.data?.messages) ? listRes.data?.messages : [];
    const messages: GmailMessageCard[] = [];
    for (const ref of refs.slice(0, maxResults)) {
      const id = trim((ref as Record<string, unknown>)?.id, 120);
      if (!id) continue;
      const detail = await executeLiveGmail(accessToken, { method: "messages.get", messageId: id });
      if (detail.ok && (detail as { message?: GmailMessageCard }).message) {
        messages.push((detail as { message: GmailMessageCard }).message);
      }
    }
    return {
      ok: true,
      q,
      messages,
      resultSizeEstimate: Number(listRes.data?.resultSizeEstimate || messages.length),
      nextPageToken: trim(listRes.data?.nextPageToken, 200) || null,
    };
  }

  if (method === "messages.get") {
    const id = trim(req.messageId, 120);
    if (!id) return { ok: false, error: "message_id_required" };
    const res = await gmailFetch(accessToken, `/messages/${encodeURIComponent(id)}`, {
      format: "full",
    });
    if (!res.ok) return res;
    return { ok: true, message: normalizeMessage(res.data || {}) };
  }

  if (method === "threads.get") {
    const id = trim(req.threadId, 120);
    if (!id) return { ok: false, error: "thread_id_required" };
    const res = await gmailFetch(accessToken, `/threads/${encodeURIComponent(id)}`, {
      format: "full",
    });
    if (!res.ok) return res;
    const rawMessages = Array.isArray(res.data?.messages) ? res.data?.messages : [];
    const messages = rawMessages.map((m) => normalizeMessage(m as Record<string, unknown>));
    return { ok: true, thread: { id, messages } };
  }

  return { ok: false, error: "unknown_gmail_method" };
}

export async function executeGmailRead(userId: string, req: GmailReadRequest) {
  const method = trim(req.method);
  if (!method) return { ok: false, error: "method_required" };
  if (isGmailWriteMethod(method)) {
    return { ok: false, error: "gmail_write_forbidden", method, phase: "6-D" };
  }
  if (!isGmailReadMethod(method)) {
    return { ok: false, error: "gmail_method_not_allowed", method };
  }

  const config = getSecretaryGoogleConfig();
  if (isSecretaryGoogleMockMode()) {
    return executeMockGmail(req);
  }

  const token = await ensureGoogleAccessToken(userId);
  if (!token.ok || !token.accessToken) {
    return { ok: false, error: token.error || "not_connected" };
  }

  return executeLiveGmail(token.accessToken, req);
}
