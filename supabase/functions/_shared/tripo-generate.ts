/**
 * Tripo Image-to-3D（test_generate 用）
 * チケット消費・Stripe 連携なし
 */
import {
  getTripoApiBase,
  getTripoApiKey,
} from "./tripo-client.ts";

export type TripoTestGenerateResult =
  | {
      ok: true;
      taskId: string;
      status: string;
      modelUrl: string | null;
      previewUrl: string | null;
      downloadUrl: string | null;
      generationTimeMs: number;
      creditsUsed: number;
      traceId: string | null;
      timedOut?: false;
    }
  | {
      ok: false;
      error: string;
      taskId?: string | null;
      status?: string | null;
      traceId?: string | null;
      timedOut?: boolean;
      partial?: boolean;
    };

type TripoJson = Record<string, unknown>;

function unwrapTripoData(body: TripoJson | null): TripoJson | null {
  if (!body) return null;
  if (body.code === 0 && body.data && typeof body.data === "object") {
    return body.data as TripoJson;
  }
  return body;
}

function parseTripoError(body: TripoJson | null, fallback: string): string {
  if (!body) return fallback;
  const nested =
    body.data && typeof body.data === "object" ? (body.data as TripoJson) : body;
  return String(
    nested.message || nested.suggestion || body.message || body.error || fallback
  );
}

async function tripoRequest(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: TripoJson;
  } = {}
): Promise<{ res: Response; traceId: string | null; body: TripoJson | null }> {
  const apiKey = getTripoApiKey();
  const url = `${getTripoApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const traceId = res.headers.get("X-Tripo-Trace-ID") || res.headers.get("x-tripo-trace-id");
  let body: TripoJson | null = null;
  try {
    body = (await res.json()) as TripoJson;
  } catch {
    body = null;
  }
  return { res, traceId, body };
}

function detectImageFormat(bytes: Uint8Array, mimeHint?: string): "png" | "jpeg" | "webp" {
  const hint = String(mimeHint || "").toLowerCase();
  if (hint.includes("png")) return "png";
  if (hint.includes("webp")) return "webp";
  if (hint.includes("jpeg") || hint.includes("jpg")) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "webp";
  return "jpeg";
}

function parseDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/i);
  if (!m) return null;
  const mime = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

async function uploadImageDirect(bytes: Uint8Array, mimeHint?: string): Promise<string> {
  const format = detectImageFormat(bytes, mimeHint);
  const contentType =
    format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
  const form = new FormData();
  const blob = new Blob([bytes], { type: contentType });
  form.append("file", blob, `tasu-upload.${format}`);

  const apiKey = getTripoApiKey();
  const url = `${getTripoApiBase()}/upload`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  let body: TripoJson | null = null;
  try {
    body = (await res.json()) as TripoJson;
  } catch {
    body = null;
  }
  const data = unwrapTripoData(body);
  const token = String(data?.image_token || data?.file_token || "");
  if (!res.ok || !token) {
    throw new Error(parseTripoError(body, `画像アップロード失敗 (HTTP ${res.status})`));
  }
  return token;
}

async function resolveFilePayload(input: {
  imageUrl?: string;
  imageData?: string;
}): Promise<TripoJson> {
  const url = String(input.imageUrl || "").trim();
  if (url && /^https?:\/\//i.test(url)) {
    return { url };
  }

  const dataUrl = String(input.imageData || "").trim();
  if (dataUrl.startsWith("data:")) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) throw new Error("imageData の data URL が不正です");
    const fileToken = await uploadImageDirect(parsed.bytes, parsed.mime);
    return { file_token: fileToken };
  }

  if (url) {
    return { url };
  }

  throw new Error("imageUrl または imageData が必要です");
}

export async function createImageToModelTask(input: {
  imageUrl?: string;
  imageData?: string;
  modelVersion?: string;
}): Promise<{ taskId: string; traceId: string | null }> {
  const filePayload = await resolveFilePayload(input);
  const body: TripoJson = {
    type: "image_to_model",
    model_version: input.modelVersion || "v2.5-20250123",
    texture: true,
    pbr: true,
    file: filePayload,
  };

  const { res, traceId, body: raw } = await tripoRequest("/task", {
    method: "POST",
    body,
  });
  const data = unwrapTripoData(raw);
  const taskId = String(data?.task_id || data?.taskId || "");
  if (!res.ok || !taskId) {
    throw new Error(parseTripoError(raw, "image_to_model タスク作成に失敗しました"));
  }
  return { taskId, traceId };
}

export async function getTripoTask(taskId: string) {
  const { res, traceId, body } = await tripoRequest(`/task/${encodeURIComponent(taskId)}`, {
    method: "GET",
  });
  const data = unwrapTripoData(body);
  if (!res.ok || !data) {
    throw new Error(parseTripoError(body, `タスク取得失敗 (HTTP ${res.status})`));
  }
  return { data, traceId };
}

const FINAL_STATUSES = new Set([
  "success",
  "failed",
  "banned",
  "expired",
  "cancelled",
  "unknown",
]);

function extractOutputUrls(data: TripoJson) {
  const output =
    data.output && typeof data.output === "object" ? (data.output as TripoJson) : {};
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = output[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  const modelUrl = pick("model", "pbr_model", "base_model", "glb", "model_url");
  const previewUrl = pick(
    "rendered_image",
    "preview",
    "preview_url",
    "thumbnail",
    "image"
  );
  const downloadUrl = modelUrl || pick("fbx", "download_url", "model_mesh");
  return { modelUrl, previewUrl, downloadUrl, output };
}

export async function pollTripoTaskOnce(taskId: string) {
  const { data, traceId } = await getTripoTask(taskId);
  const status = String(data.status || "unknown");
  const urls = extractOutputUrls(data);
  const creditsUsed = Math.max(0, Number(data.consumed_credit) || 0);
  return {
    taskId,
    status,
    done: FINAL_STATUSES.has(status),
    success: status === "success",
    creditsUsed,
    traceId,
    ...urls,
    raw: data,
  };
}

export async function waitForTripoTask(
  taskId: string,
  options: { maxWaitMs?: number; pollIntervalMs?: number } = {}
) {
  const maxWaitMs = Math.min(
    Math.max(options.maxWaitMs ?? 90_000, 5_000),
    100_000
  );
  const pollIntervalMs = Math.max(options.pollIntervalMs ?? 6_000, 3_000);
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const snap = await pollTripoTaskOnce(taskId);
    if (snap.done) return snap;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  const last = await pollTripoTaskOnce(taskId);
  return { ...last, timedOut: !last.done };
}

export function isTestGenerateEnabled(): boolean {
  const v = String(Deno.env.get("GENAI_3D_TEST_GENERATE_ENABLED") || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function runTripoTestGenerate(input: {
  imageUrl?: string;
  imageData?: string;
  modelVersion?: string;
  maxWaitMs?: number;
}): Promise<TripoTestGenerateResult> {
  const started = Date.now();
  let traceId: string | null = null;
  let taskId = "";

  try {
    const created = await createImageToModelTask(input);
    taskId = created.taskId;
    traceId = created.traceId;

    const serverWaitMs = Math.min(
      Math.max(Number(input.maxWaitMs) || 0, 0),
      55_000
    );

    if (serverWaitMs > 0) {
      const result = await waitForTripoTask(taskId, { maxWaitMs: serverWaitMs });
      traceId = result.traceId || traceId;

      if (result.success) {
        return {
          ok: true,
          taskId,
          status: result.status,
          modelUrl: result.modelUrl,
          previewUrl: result.previewUrl,
          downloadUrl: result.downloadUrl || result.modelUrl,
          generationTimeMs: Date.now() - started,
          creditsUsed: result.creditsUsed,
          traceId,
        };
      }

      if (result.status === "failed" || result.status === "banned") {
        const errMsg =
          String((result.raw as TripoJson)?.message || "") ||
          `Tripo タスクが ${result.status} で終了しました`;
        return { ok: false, error: errMsg, taskId, status: result.status, traceId };
      }

      if (!result.done) {
        return {
          ok: false,
          error: "生成処理中です。task_poll で完了を確認してください。",
          taskId,
          status: result.status,
          traceId,
          timedOut: Boolean(result.timedOut),
          partial: true,
        };
      }
    }

    const snap = await pollTripoTaskOnce(taskId);
    traceId = snap.traceId || traceId;
    if (snap.success) {
      return {
        ok: true,
        taskId,
        status: snap.status,
        modelUrl: snap.modelUrl,
        previewUrl: snap.previewUrl,
        downloadUrl: snap.downloadUrl || snap.modelUrl,
        generationTimeMs: Date.now() - started,
        creditsUsed: snap.creditsUsed,
        traceId,
      };
    }

    return {
      ok: false,
      error: "生成処理中です。task_poll で完了を確認してください。",
      taskId,
      status: snap.status,
      traceId,
      partial: true,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      taskId: taskId || null,
      traceId,
    };
  }
}
