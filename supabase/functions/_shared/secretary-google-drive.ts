/**
 * AI秘書 Phase 6-H — Google Drive read-only API (Edge · server-side only)
 * Allowed: files.list · files.get · files.export
 * Forbidden: create · update · delete · permissions · upload
 */
import {
  ensureGoogleAccessToken,
  isSecretaryGoogleMockMode,
} from "./secretary-google-oauth.ts";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const LIST_FIELDS = "nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,parents,iconLink)";

export const DRIVE_READ_METHODS = Object.freeze([
  "files.list",
  "files.get",
  "files.export",
]);

export const DRIVE_WRITE_METHODS = Object.freeze([
  "files.create",
  "files.update",
  "files.patch",
  "files.delete",
  "files.copy",
  "files.emptyTrash",
  "files.upload",
  "permissions.create",
  "permissions.update",
  "permissions.delete",
  "permissions.batchCreate",
  "permissions.batchUpdate",
  "permissions.batchDelete",
]);

export const DRIVE_EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

export type DriveReadRequest = {
  method: string;
  fileId?: string;
  folderId?: string;
  preset?: string;
  q?: string;
  mimeType?: string;
  exportMimeType?: string;
  maxResults?: number;
  pageToken?: string;
};

export type DriveFileCard = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  modifiedTime: string;
  size: number;
  webViewLink: string;
  parents: string[];
  kind: string;
};

function trim(value: unknown, max = 4000): string {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeKeyword(q: string): string {
  return trim(q, 200).replace(/[\r\n\0'\\]/g, " ");
}

function sanitizeMimeType(m: string): string {
  return trim(m, 200).replace(/[\r\n\0'\\]/g, "");
}

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function isDriveReadMethod(method: string): boolean {
  return DRIVE_READ_METHODS.includes(String(method || "").trim());
}

export function isDriveWriteMethod(method: string): boolean {
  return DRIVE_WRITE_METHODS.includes(String(method || "").trim());
}

export function fileKindLabel(mimeType: string, isFolder: boolean): string {
  if (isFolder) return "folder";
  const m = trim(mimeType, 200);
  if (m === "application/vnd.google-apps.document") return "doc";
  if (m === "application/vnd.google-apps.spreadsheet") return "sheet";
  if (m === "application/vnd.google-apps.presentation") return "slide";
  if (m === "application/pdf") return "pdf";
  return "file";
}

export function normalizeDriveFile(raw: Record<string, unknown>): DriveFileCard {
  const mimeType = trim(raw.mimeType, 200);
  const isFolder = mimeType === FOLDER_MIME;
  const parents = Array.isArray(raw.parents) ? raw.parents.map(String) : [];
  return {
    id: trim(raw.id, 200),
    name: trim(raw.name, 500) || "（名称なし）",
    mimeType,
    isFolder,
    modifiedTime: trim(raw.modifiedTime, 80),
    size: Number(raw.size || 0) || 0,
    webViewLink: trim(raw.webViewLink, 500),
    parents,
    kind: fileKindLabel(mimeType, isFolder),
  };
}

export function buildDriveListQuery(req: DriveReadRequest): { q: string; orderBy?: string } {
  const parts: string[] = ["trashed=false"];
  const preset = trim(req.preset, 40).toLowerCase();
  const keyword = sanitizeKeyword(req.q || "");
  const mimeType = sanitizeMimeType(req.mimeType || "");
  const folderId = trim(req.folderId, 200);

  if (folderId) {
    parts.push(`'${escapeQueryValue(folderId)}' in parents`);
  } else if (preset === "folder" || preset === "root") {
    parts.push("'root' in parents");
  }

  if (mimeType) {
    parts.push(`mimeType='${escapeQueryValue(mimeType)}'`);
  }

  if (keyword) {
    parts.push(`fullText contains '${escapeQueryValue(keyword)}'`);
  }

  let orderBy: string | undefined;
  if (preset === "recent") {
    orderBy = "modifiedTime desc";
  }

  return { q: parts.join(" and "), orderBy };
}

const MOCK_FILES: DriveFileCard[] = [
  {
    id: "mock_folder_ops",
    name: "TASFUL 運営",
    mimeType: FOLDER_MIME,
    isFolder: true,
    modifiedTime: new Date(Date.now() - 86400000).toISOString(),
    size: 0,
    webViewLink: "",
    parents: ["root"],
    kind: "folder",
  },
  {
    id: "mock_doc_1",
    name: "Platform ロードマップ",
    mimeType: "application/vnd.google-apps.document",
    isFolder: false,
    modifiedTime: new Date(Date.now() - 3600000).toISOString(),
    size: 0,
    webViewLink: "",
    parents: ["mock_folder_ops"],
    kind: "doc",
  },
  {
    id: "mock_sheet_1",
    name: "Connect 審査一覧",
    mimeType: "application/vnd.google-apps.spreadsheet",
    isFolder: false,
    modifiedTime: new Date(Date.now() - 7200000).toISOString(),
    size: 0,
    webViewLink: "",
    parents: ["mock_folder_ops"],
    kind: "sheet",
  },
  {
    id: "mock_pdf_1",
    name: "運営マニュアル.pdf",
    mimeType: "application/pdf",
    isFolder: false,
    modifiedTime: new Date(Date.now() - 172800000).toISOString(),
    size: 245760,
    webViewLink: "",
    parents: ["root"],
    kind: "pdf",
  },
];

const MOCK_EXPORT_TEXT: Record<string, string> = {
  mock_doc_1: "Platform ロードマップ\n\n- Builder v1.0\n- Platform NB1M\n- TLV v1.0",
  mock_sheet_1: "会社名,ステータス\nExample Corp,審査中\nPartner Co.,承認済",
};

function filterMockFiles(req: DriveReadRequest): DriveFileCard[] {
  const { q } = buildDriveListQuery(req);
  const folderId = trim(req.folderId, 200);
  const keyword = sanitizeKeyword(req.q || "").toLowerCase();
  const mimeType = sanitizeMimeType(req.mimeType || "");
  const preset = trim(req.preset, 40).toLowerCase();

  let rows = [...MOCK_FILES];
  if (folderId) {
    rows = rows.filter((f) => f.parents.includes(folderId));
  } else if (preset === "folder" || preset === "root") {
    rows = rows.filter((f) => f.parents.includes("root"));
  }
  if (mimeType) rows = rows.filter((f) => f.mimeType === mimeType);
  if (keyword) {
    rows = rows.filter((f) => f.name.toLowerCase().includes(keyword));
  }
  if (preset === "recent" && !folderId) {
    rows = [...rows].sort((a, b) => Date.parse(b.modifiedTime) - Date.parse(a.modifiedTime));
  }
  return rows.slice(0, Math.min(Math.max(Number(req.maxResults) || 25, 1), 50));
}

async function driveFetch(
  accessToken: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; error?: string }> {
  const url = new URL(`${DRIVE_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
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
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, error: trim(text || `http_${res.status}`, 300) };
  }
  return { ok: true, status: res.status, data: { text } };
}

async function executeMockDrive(req: DriveReadRequest) {
  const method = trim(req.method);

  if (method === "files.list") {
    const files = filterMockFiles(req);
    const built = buildDriveListQuery(req);
    return {
      ok: true,
      mock: true,
      preset: trim(req.preset) || undefined,
      folderId: trim(req.folderId) || undefined,
      q: built.q,
      files,
      resultSizeEstimate: files.length,
    };
  }

  if (method === "files.get") {
    const id = trim(req.fileId, 200);
    const hit = MOCK_FILES.find((f) => f.id === id) || MOCK_FILES[0];
    return { ok: true, mock: true, file: hit };
  }

  if (method === "files.export") {
    const id = trim(req.fileId, 200);
    const text = MOCK_EXPORT_TEXT[id] || "（mock export テキスト）";
    return {
      ok: true,
      mock: true,
      fileId: id,
      exportMimeType: trim(req.exportMimeType, 120) || "text/plain",
      text: text.slice(0, 8000),
    };
  }

  return { ok: false, error: "unknown_drive_method" };
}

async function executeLiveDrive(accessToken: string, req: DriveReadRequest) {
  const method = trim(req.method);
  const maxResults = Math.min(Math.max(Number(req.maxResults) || 25, 1), 50);
  const pageToken = trim(req.pageToken, 200) || undefined;

  if (method === "files.list") {
    const built = buildDriveListQuery(req);
    const res = await driveFetch(accessToken, "/files", {
      q: built.q,
      pageSize: maxResults,
      pageToken,
      orderBy: built.orderBy,
      fields: LIST_FIELDS,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (!res.ok) return res;
    const items = Array.isArray(res.data?.files) ? res.data?.files : [];
    const files = items.map((row) => normalizeDriveFile(row as Record<string, unknown>));
    return {
      ok: true,
      preset: trim(req.preset) || undefined,
      folderId: trim(req.folderId) || undefined,
      q: built.q,
      files,
      resultSizeEstimate: files.length,
      nextPageToken: trim(res.data?.nextPageToken, 200) || null,
    };
  }

  if (method === "files.get") {
    const fileId = trim(req.fileId, 200);
    if (!fileId) return { ok: false, error: "file_id_required" };
    const res = await driveFetch(accessToken, `/files/${encodeURIComponent(fileId)}`, {
      fields: "id,name,mimeType,modifiedTime,size,webViewLink,parents,iconLink",
      supportsAllDrives: true,
    });
    if (!res.ok) return res;
    return { ok: true, file: normalizeDriveFile(res.data || {}) };
  }

  if (method === "files.export") {
    const fileId = trim(req.fileId, 200);
    if (!fileId) return { ok: false, error: "file_id_required" };
    const meta = await driveFetch(accessToken, `/files/${encodeURIComponent(fileId)}`, {
      fields: "id,mimeType,name",
      supportsAllDrives: true,
    });
    if (!meta.ok) return meta;
    const sourceMime = trim(meta.data?.mimeType, 200);
    const exportMimeType =
      sanitizeMimeType(req.exportMimeType || "") || DRIVE_EXPORT_MIME[sourceMime] || "text/plain";
    if (!DRIVE_EXPORT_MIME[sourceMime] && !req.exportMimeType) {
      return { ok: false, error: "export_not_supported", mimeType: sourceMime };
    }
    const res = await driveFetch(
      accessToken,
      `/files/${encodeURIComponent(fileId)}/export`,
      { mimeType: exportMimeType }
    );
    if (!res.ok) return res;
    const text = trim(res.data?.text, 8000);
    return {
      ok: true,
      fileId,
      name: trim(meta.data?.name, 500),
      sourceMimeType: sourceMime,
      exportMimeType,
      text,
    };
  }

  return { ok: false, error: "unknown_drive_method" };
}

export async function executeDriveRead(userId: string, req: DriveReadRequest) {
  const method = trim(req.method);
  if (!method) return { ok: false, error: "method_required" };
  if (isDriveWriteMethod(method)) {
    return { ok: false, error: "drive_read_only", method, phase: "6-H" };
  }
  if (!isDriveReadMethod(method)) {
    return { ok: false, error: "drive_method_not_allowed", method };
  }

  if (isSecretaryGoogleMockMode()) {
    return executeMockDrive(req);
  }

  const token = await ensureGoogleAccessToken(userId);
  if (!token.ok || !token.accessToken) {
    return { ok: false, error: token.error || "not_connected" };
  }

  return executeLiveDrive(token.accessToken, req);
}
