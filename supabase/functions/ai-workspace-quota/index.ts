import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  handleWorkspaceQuotaAction,
  type WorkspaceQuotaBody,
} from "../_shared/ai-workspace-quota.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, req);
  }

  let body: WorkspaceQuotaBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, req);
  }

  return handleWorkspaceQuotaAction(req, body);
});
