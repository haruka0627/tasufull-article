/**
 * AI秘書 Phase 6-G — Google Contacts read-only API (People API · Edge · server-side only)
 * Allowed: people.connections.list · people.searchContacts · people.get
 * Forbidden: create · update · delete
 */
import {
  ensureGoogleAccessToken,
  isSecretaryGoogleMockMode,
} from "./secretary-google-oauth.ts";

const PEOPLE_BASE = "https://people.googleapis.com/v1";
const PERSON_FIELDS =
  "names,emailAddresses,phoneNumbers,organizations,biographies,metadata";

export const CONTACTS_READ_METHODS = Object.freeze([
  "people.connections.list",
  "people.searchContacts",
  "people.get",
]);

export const CONTACTS_WRITE_METHODS = Object.freeze([
  "people.createContact",
  "people.updateContact",
  "people.deleteContact",
  "people.batchCreateContacts",
  "people.batchUpdateContacts",
  "people.batchDeleteContacts",
  "people.updateContactPhoto",
  "people.deleteContactPhoto",
]);

export type ContactsReadRequest = {
  method: string;
  resourceName?: string;
  query?: string;
  maxResults?: number;
  pageToken?: string;
};

export type ContactCard = {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
  company: string;
  notes: string;
};

function trim(value: unknown, max = 4000): string {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeQuery(q: string): string {
  return trim(q, 200).replace(/[\r\n\0]/g, " ");
}

export function isContactsReadMethod(method: string): boolean {
  return CONTACTS_READ_METHODS.includes(String(method || "").trim());
}

export function isContactsWriteMethod(method: string): boolean {
  return CONTACTS_WRITE_METHODS.includes(String(method || "").trim());
}

function pickName(raw: Record<string, unknown>): string {
  const names = Array.isArray(raw.names) ? raw.names : [];
  const first = names[0] as Record<string, unknown> | undefined;
  return trim(first?.displayName || first?.unstructuredName || raw.resourceName, 300) || "（名前なし）";
}

function pickStrings(items: unknown, key: string, max = 5): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, max)
    .map((row) => trim((row as Record<string, unknown>)?.[key], 200))
    .filter(Boolean);
}

function pickCompany(raw: Record<string, unknown>): string {
  const orgs = Array.isArray(raw.organizations) ? raw.organizations : [];
  const first = orgs[0] as Record<string, unknown> | undefined;
  return trim(first?.name || first?.title, 300);
}

function pickNotes(raw: Record<string, unknown>): string {
  const bios = Array.isArray(raw.biographies) ? raw.biographies : [];
  const first = bios[0] as Record<string, unknown> | undefined;
  return trim(first?.value, 2000);
}

export function normalizeContact(raw: Record<string, unknown>): ContactCard {
  const id = trim(raw.resourceName, 300);
  return {
    id,
    name: pickName(raw),
    emails: pickStrings(raw.emailAddresses, "value"),
    phones: pickStrings(raw.phoneNumbers, "value"),
    company: pickCompany(raw),
    notes: pickNotes(raw),
  };
}

const MOCK_CONTACTS: ContactCard[] = [
  {
    id: "people/mock_c_1",
    name: "田中 太郎",
    emails: ["tanaka@example.com"],
    phones: ["090-1234-5678"],
    company: "Example Corp",
    notes: "Platform パートナー担当",
  },
  {
    id: "people/mock_c_2",
    name: "佐藤 花子",
    emails: ["sato@partner.co.jp", "h.sato@partner.co.jp"],
    phones: ["03-5555-0101"],
    company: "Partner Co.",
    notes: "Connect 審査窓口",
  },
  {
    id: "people/mock_c_3",
    name: "運営チーム",
    emails: ["ops@tasful.local"],
    phones: [],
    company: "TASFUL",
    notes: "内部連絡用",
  },
];

function filterMockContacts(query: string): ContactCard[] {
  const q = sanitizeQuery(query).toLowerCase();
  if (!q) return [...MOCK_CONTACTS];
  return MOCK_CONTACTS.filter((c) => {
    const hay = [c.name, c.company, c.notes, ...c.emails, ...c.phones].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

async function peopleFetch(
  accessToken: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; error?: string }> {
  const url = new URL(`${PEOPLE_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
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

async function executeMockContacts(req: ContactsReadRequest) {
  const method = trim(req.method);
  const q = sanitizeQuery(req.query || "");
  const maxResults = Math.min(Math.max(Number(req.maxResults) || 25, 1), 50);

  if (method === "people.connections.list") {
    const contacts = filterMockContacts("").slice(0, maxResults);
    return { ok: true, mock: true, contacts, resultSizeEstimate: contacts.length };
  }

  if (method === "people.searchContacts") {
    const contacts = filterMockContacts(q).slice(0, maxResults);
    return { ok: true, mock: true, query: q || undefined, contacts, resultSizeEstimate: contacts.length };
  }

  if (method === "people.get") {
    const id = trim(req.resourceName, 300);
    const hit = MOCK_CONTACTS.find((c) => c.id === id) || filterMockContacts(q)[0] || MOCK_CONTACTS[0];
    return { ok: true, mock: true, contact: hit };
  }

  return { ok: false, error: "unknown_contacts_method" };
}

async function executeLiveContacts(accessToken: string, req: ContactsReadRequest) {
  const method = trim(req.method);
  const maxResults = Math.min(Math.max(Number(req.maxResults) || 25, 1), 50);
  const pageToken = trim(req.pageToken, 200) || undefined;

  if (method === "people.connections.list") {
    const res = await peopleFetch(accessToken, "/people/me/connections", {
      personFields: PERSON_FIELDS,
      pageSize: maxResults,
      pageToken,
      sortOrder: "LAST_MODIFIED_DESCENDING",
    });
    if (!res.ok) return res;
    const connections = Array.isArray(res.data?.connections) ? res.data?.connections : [];
    const contacts = connections.map((row) => normalizeContact(row as Record<string, unknown>));
    return {
      ok: true,
      contacts,
      resultSizeEstimate: contacts.length,
      nextPageToken: trim(res.data?.nextPageToken, 200) || null,
      totalItems: Number(res.data?.totalItems) || contacts.length,
    };
  }

  if (method === "people.searchContacts") {
    const query = sanitizeQuery(req.query || "");
    if (!query) return { ok: false, error: "query_required" };
    const res = await peopleFetch(accessToken, "/people:searchContacts", {
      query,
      readMask: PERSON_FIELDS,
      pageSize: maxResults,
      pageToken,
    });
    if (!res.ok) return res;
    const results = Array.isArray(res.data?.results) ? res.data?.results : [];
    const contacts = results
      .map((row) => (row as Record<string, unknown>).person as Record<string, unknown>)
      .filter(Boolean)
      .map((person) => normalizeContact(person));
    return {
      ok: true,
      query,
      contacts,
      resultSizeEstimate: contacts.length,
      nextPageToken: trim(res.data?.nextPageToken, 200) || null,
    };
  }

  if (method === "people.get") {
    const resourceName = trim(req.resourceName, 300);
    if (!resourceName) return { ok: false, error: "resource_name_required" };
    const path = resourceName.startsWith("/") ? resourceName : `/${resourceName}`;
    const res = await peopleFetch(accessToken, path, { personFields: PERSON_FIELDS });
    if (!res.ok) return res;
    return { ok: true, contact: normalizeContact(res.data || {}) };
  }

  return { ok: false, error: "unknown_contacts_method" };
}

export async function executeContactsRead(userId: string, req: ContactsReadRequest) {
  const method = trim(req.method);
  if (!method) return { ok: false, error: "method_required" };
  if (isContactsWriteMethod(method)) {
    return { ok: false, error: "contacts_read_only", method, phase: "6-G" };
  }
  if (!isContactsReadMethod(method)) {
    return { ok: false, error: "contacts_method_not_allowed", method };
  }

  if (isSecretaryGoogleMockMode()) {
    return executeMockContacts(req);
  }

  const token = await ensureGoogleAccessToken(userId);
  if (!token.ok || !token.accessToken) {
    return { ok: false, error: token.error || "not_connected" };
  }

  return executeLiveContacts(token.accessToken, req);
}
