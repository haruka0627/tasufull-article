/**
 * Local-only Materials upload writer sidecar.
 * Reuses user-upload-register-v1 (no duplicate writer / index / DB).
 * Binds 127.0.0.1 only. Pages Function forwards here because workerd cwd is `/`.
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as registerMod from "./user-upload-register-v1.mjs";
import {
  executeUserRegisterAction,
  MATERIALS_LOCAL_WRITE_TOKEN,
  MATERIALS_LOCAL_WRITER_PORT,
} from "../../../deploy/cloudflare/functions/_shared/materials-user-register.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function isLoopback(addr) {
  const ip = String(addr || "");
  return ip === "127.0.0.1" || ip === "::1" || ip === ":ffff:127.0.0.1" || ip === "::ffff:127.0.0.1";
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

export function startMaterialsLocalWriterServer(opts = {}) {
  const port = Number(opts.port || process.env.MATERIALS_LOCAL_WRITE_PORT || MATERIALS_LOCAL_WRITER_PORT);
  const token = String(opts.token || process.env.MATERIALS_LOCAL_WRITE_TOKEN || MATERIALS_LOCAL_WRITE_TOKEN);

  const server = http.createServer(async (req, res) => {
    if (!isLoopback(req.socket.remoteAddress)) {
      send(res, 403, { ok: false, code: "LOCAL_WRITE_REMOTE_DENIED" });
      return;
    }
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      send(res, 200, { ok: true, service: "materials-local-writer", port, root: ROOT });
      return;
    }
    if (url.pathname !== "/write") {
      send(res, 404, { ok: false, code: "not_found" });
      return;
    }
    const got = String(req.headers["x-tasful-materials-local-write-token"] || "");
    if (!got || got !== token) {
      send(res, 403, { ok: false, code: "LOCAL_WRITE_TOKEN_DENIED" });
      return;
    }
    const userId = String(req.headers["x-tasful-authenticated-user-id"] || "").trim();
    if (!userId) {
      send(res, 401, { ok: false, code: "UNAUTHENTICATED_UPLOAD_BLOCKED" });
      return;
    }
    if (req.method !== "GET" && req.method !== "POST") {
      send(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }

    let payload;
    try {
      if (req.method === "GET") {
        payload = {
          action: String(url.searchParams.get("action") || "list_drafts").trim().toLowerCase(),
          slug: String(url.searchParams.get("slug") || "").trim(),
          claimedUserId: "",
          fileBuffer: null,
        };
      } else {
        const body = await readJson(req);
        payload = {
          action: String(body.action || url.searchParams.get("action") || "draft").trim().toLowerCase(),
          slug: String(body.slug || "").trim(),
          title: String(body.title || ""),
          description: String(body.description || ""),
          categoryId: String(body.category_id || body.categoryId || "").trim(),
          tags: body.tags,
          visibility: String(body.visibility || "").trim(),
          rightsConfirmed: body.rights_confirmed === true || body.rightsConfirmed === true,
          claimedUserId: "",
          fileBuffer: body.file_base64 ? Buffer.from(String(body.file_base64), "base64") : null,
          fileName: String(body.file_name || body.fileName || ""),
          mimeType: String(body.mime || body.mimeType || ""),
        };
      }
    } catch {
      send(res, 400, { ok: false, code: "malformed_metadata" });
      return;
    }

    try {
      const response = await executeUserRegisterAction(
        registerMod,
        { ok: true, userId, via: "function_forward" },
        payload,
        "local_writer_sidecar",
        req.method,
      );
      const text = await response.text();
      res.writeHead(response.status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(text);
    } catch (err) {
      send(res, 500, { ok: false, code: "local_writer_failed", error: String(err?.message || err) });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        server,
        port,
        token,
        close() {
          return new Promise((done) => {
            server.close(() => done());
          });
        },
      });
    });
  });
}

export async function ensureMaterialsLocalWriterServer(opts = {}) {
  const port = Number(opts.port || process.env.MATERIALS_LOCAL_WRITE_PORT || MATERIALS_LOCAL_WRITER_PORT);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    if (res.ok) {
      return { port, adopted: true, close: async () => {} };
    }
  } catch {
    /* start */
  }
  const started = await startMaterialsLocalWriterServer({ ...opts, port });
  return { ...started, adopted: false };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const started = await startMaterialsLocalWriterServer();
  console.log(JSON.stringify({ ok: true, port: started.port, bind: "127.0.0.1" }));
}
