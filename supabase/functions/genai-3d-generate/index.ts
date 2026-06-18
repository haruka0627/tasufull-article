/**
 * TASFUL 生成AI — Tripo 3D
 * health_check / test_generate（開発） / generate_from_ticket / complete_generation（本番）
 */
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getGenAiEntitlementsForUser } from "../_shared/apply-genai-entitlements.ts";
import {
  handleCompleteGeneration,
  handleGenerateFromTicket,
  handleReconcileStaleGenerations,
} from "../_shared/genai-3d-production.ts";
import {
  checkTripoConnection,
  getTripoApiBase,
  isTripoGenerationEnabled,
} from "../_shared/tripo-client.ts";
import {
  isTestGenerateEnabled,
  pollTripoTaskOnce,
  runTripoTestGenerate,
} from "../_shared/tripo-generate.ts";

type RequestAction =
  | "health_check"
  | "ping"
  | "status"
  | "test_generate"
  | "task_poll"
  | "fetch_glb"
  | "generate_from_ticket"
  | "complete_generation"
  | "reconcile_stale_generations";

function parseAction(body: Record<string, unknown>): RequestAction {
  const raw = String(body.action ?? body.mode ?? "health_check")
    .trim()
    .toLowerCase();
  if (raw === "generate_from_ticket" || raw === "generate-from-ticket") {
    return "generate_from_ticket";
  }
  if (raw === "complete_generation" || raw === "complete-generation") {
    return "complete_generation";
  }
  if (raw === "reconcile_stale_generations" || raw === "reconcile-stale-generations") {
    return "reconcile_stale_generations";
  }
  if (raw === "test_generate" || raw === "test-generate") return "test_generate";
  if (raw === "task_poll" || raw === "task-poll") return "task_poll";
  if (raw === "fetch_glb" || raw === "fetch-glb") return "fetch_glb";
  if (raw === "ping") return "ping";
  if (raw === "status") return "status";
  return "health_check";
}

function resolveActionHttpStatus(result: Record<string, unknown>): number {
  if (typeof result.status === "number" && result.status >= 400) {
    return result.status;
  }
  if (result.processing) return 202;
  if (result.ok === false) return 400;
  return 200;
}

function rejectLegacyGenerateAttempt(action: string) {
  const blocked = new Set([
    "generate",
    "text_to_model",
    "image_to_model",
    "create_task",
    "run",
    "start",
  ]);
  return blocked.has(action.toLowerCase());
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const requestedAction = String(body.action ?? body.mode ?? "").trim().toLowerCase();
    const action = parseAction(body);
    const userId = String(body.user_id ?? body.userId ?? "").trim();

    if (rejectLegacyGenerateAttempt(requestedAction)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "旧 action generate は未対応です。generate_from_ticket / complete_generation を使用してください。",
          generationEnabled: isTripoGenerationEnabled(),
        },
        503
      );
    }

    if (action === "generate_from_ticket") {
      const result = await handleGenerateFromTicket({
        userId: String(body.userId ?? body.user_id ?? userId),
        characterId: String(body.characterId ?? body.character_id ?? ""),
        characterName: String(body.characterName ?? body.character_name ?? ""),
        imageUrl: String(body.imageUrl ?? body.image_url ?? "").trim() || undefined,
        imageData: String(body.imageData ?? body.image_data ?? "").trim() || undefined,
      });
      return jsonResponse(
        { action, ...result },
        resolveActionHttpStatus(result)
      );
    }

    if (action === "complete_generation") {
      const result = await handleCompleteGeneration({
        userId: String(body.userId ?? body.user_id ?? userId),
        characterId: String(body.characterId ?? body.character_id ?? ""),
        taskId: String(body.taskId ?? body.task_id ?? ""),
      });
      return jsonResponse(
        { action, ...result },
        resolveActionHttpStatus(result)
      );
    }

    if (action === "reconcile_stale_generations") {
      const result = await handleReconcileStaleGenerations({
        userId: String(body.userId ?? body.user_id ?? userId),
      });
      return jsonResponse(
        { action, ...result },
        resolveActionHttpStatus(result)
      );
    }

    if (action === "test_generate") {
      if (!isTestGenerateEnabled()) {
        return jsonResponse(
          {
            ok: false,
            error:
              "test_generate は無効です。Supabase Secret に GENAI_3D_TEST_GENERATE_ENABLED=true を設定してください。",
          },
          503
        );
      }

      const result = await runTripoTestGenerate({
        imageUrl: String(body.imageUrl ?? body.image_url ?? "").trim() || undefined,
        imageData: String(body.imageData ?? body.image_data ?? "").trim() || undefined,
        modelVersion: String(body.modelVersion ?? body.model_version ?? "").trim() || undefined,
        maxWaitMs: Number(body.maxWaitMs ?? body.max_wait_ms) || undefined,
      });

      if (!result.ok) {
        const partial = Boolean(result.partial || result.timedOut);
        return jsonResponse(
          {
            ok: false,
            connected: true,
            action,
            error: result.error,
            taskId: result.taskId ?? null,
            status: result.status ?? null,
            traceId: result.traceId ?? null,
            timedOut: Boolean(result.timedOut),
            partial,
            generationEnabled: false,
          },
          partial && result.taskId ? 202 : result.timedOut ? 504 : 502
        );
      }

      return jsonResponse({
        ok: true,
        connected: true,
        action,
        taskId: result.taskId,
        status: result.status,
        modelUrl: result.modelUrl,
        previewUrl: result.previewUrl,
        downloadUrl: result.downloadUrl,
        generationTime: result.generationTimeMs,
        generationTimeMs: result.generationTimeMs,
        creditsUsed: result.creditsUsed,
        traceId: result.traceId,
        generationEnabled: false,
        message: "Tripo 初回テスト生成が完了しました",
      });
    }

    if (action === "fetch_glb") {
      const url = String(body.url ?? body.modelUrl ?? "").trim();
      if (!/^https:\/\/tripo-data\.[a-z0-9.-]+\//i.test(url)) {
        return jsonResponse({ ok: false, error: "tripo-data の GLB URL のみ取得できます" }, 400);
      }
      const upstream = await fetch(url);
      if (!upstream.ok) {
        return jsonResponse(
          { ok: false, error: `GLB 取得失敗 (HTTP ${upstream.status})` },
          502
        );
      }
      const bytes = await upstream.arrayBuffer();
      return new Response(bytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "model/gltf-binary",
          "Content-Length": String(bytes.byteLength),
        },
      });
    }

    if (action === "task_poll") {
      const taskId = String(body.taskId ?? body.task_id ?? "").trim();
      if (!taskId) {
        return jsonResponse({ ok: false, error: "taskId が必要です" }, 400);
      }
      const snap = await pollTripoTaskOnce(taskId);
      return jsonResponse({
        ok: true,
        action,
        taskId: snap.taskId,
        status: snap.status,
        done: snap.done,
        success: snap.success,
        modelUrl: snap.modelUrl,
        previewUrl: snap.previewUrl,
        downloadUrl: snap.downloadUrl,
        creditsUsed: snap.creditsUsed,
        traceId: snap.traceId,
        generationEnabled: false,
      });
    }

    const tripoHealth = await checkTripoConnection();

    let entitlements: Awaited<ReturnType<typeof getGenAiEntitlementsForUser>> | null = null;
    if (userId && (action === "status" || body.include_entitlements === true)) {
      entitlements = await getGenAiEntitlementsForUser(userId);
    }

    if (!tripoHealth.ok) {
      return jsonResponse(
        {
          ok: false,
          connected: false,
          action,
          tripo: {
            configured: Boolean(Deno.env.get("TRIPO_API_KEY")?.trim()),
            apiBase: getTripoApiBase(),
            httpStatus: tripoHealth.httpStatus,
            error: tripoHealth.error,
            traceId: tripoHealth.traceId,
          },
          generationEnabled: false,
          entitlements,
        },
        tripoHealth.httpStatus >= 400 && tripoHealth.httpStatus < 600
          ? tripoHealth.httpStatus
          : 502
      );
    }

    return jsonResponse({
      ok: true,
      connected: true,
      action,
      message: "Tripo API 接続を確認しました（生成は無効）",
      tripo: {
        configured: true,
        apiBase: getTripoApiBase(),
        httpStatus: tripoHealth.httpStatus,
        balanceChecked: tripoHealth.balanceChecked,
        balanceAvailable: tripoHealth.balanceAvailable,
        authMethod: tripoHealth.authMethod,
        traceId: tripoHealth.traceId,
      },
      generationEnabled: isTripoGenerationEnabled(),
      testGenerateEnabled: isTestGenerateEnabled(),
      entitlements,
      tickets3dRemaining: entitlements?.tickets3dRemaining ?? null,
    });
  } catch (err) {
    console.error("[genai-3d-generate]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
