import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  AI_MEDIA_GEN_KILL_SWITCH_ENV,
  handleWorkspaceMediaGenerate,
  isMediaGenEdgeEnabled,
  mediaGenDisabledFailure,
  type MediaGenerateBody,
} from "../_shared/ai-workspace-media-generate.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, req);
  }

  if (!isMediaGenEdgeEnabled(Deno.env.get(AI_MEDIA_GEN_KILL_SWITCH_ENV))) {
    const disabled = mediaGenDisabledFailure();
    return jsonResponse(disabled.body, disabled.status, req);
  }

  let body: MediaGenerateBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400, req);
  }

  return handleWorkspaceMediaGenerate(req, "video", body);
});
