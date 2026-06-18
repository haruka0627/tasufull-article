/**
 * Tripo 3D 本番フロー（チケット消費は success 完了時のみ）
 */
import { getServiceSupabase } from "./apply-featured-listing.ts";
import {
  consume3dGenerateTicket,
  getGenAiEntitlementsForUser,
} from "./apply-genai-entitlements.ts";
import { checkTripoConnection } from "./tripo-client.ts";
import {
  createImageToModelTask,
  pollTripoTaskOnce,
} from "./tripo-generate.ts";

export type GenerationRow = {
  id: string;
  user_id: string;
  character_id: string;
  task_id: string;
  status: string;
  model_url: string | null;
  preview_url: string | null;
  download_url: string | null;
  credits_used: number;
  ticket_consumed: boolean;
  error_message: string | null;
  character_name: string | null;
  created_at: string;
  completed_at: string | null;
};

function requireUserId(raw: unknown): string {
  const id = String(raw || "").trim();
  if (!id) throw new Error("userId が必要です");
  return id;
}

function requireCharacterId(raw: unknown): string {
  const id = String(raw || "").trim();
  if (!id) throw new Error("characterId が必要です");
  return id;
}

function requireTaskId(raw: unknown): string {
  const id = String(raw || "").trim();
  if (!id) throw new Error("taskId が必要です");
  return id;
}

async function getGenerationByTask(
  userId: string,
  taskId: string
): Promise<GenerationRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("gen_ai_3d_generations")
    .select("*")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) {
    console.error("[genai-3d-production] read generation:", error);
    throw new Error(error.message);
  }
  return (data as GenerationRow) || null;
}

function successPayload(
  row: GenerationRow,
  entitlements: Awaited<ReturnType<typeof getGenAiEntitlementsForUser>>,
  extra: Record<string, unknown> = {}
) {
  return {
    ok: true,
    status: "success",
    taskId: row.task_id,
    generationId: row.id,
    modelUrl: row.model_url,
    previewUrl: row.preview_url,
    downloadUrl: row.download_url || row.model_url,
    creditsUsed: row.credits_used,
    ticketConsumed: row.ticket_consumed,
    tickets3dRemaining: entitlements.tickets3dRemaining,
    tickets3dTotalUsed: entitlements.tickets3dTotalUsed,
    ...extra,
  };
}

export async function handleGenerateFromTicket(input: {
  userId: string;
  characterId: string;
  characterName?: string;
  imageUrl?: string;
  imageData?: string;
}) {
  const userId = requireUserId(input.userId);
  const characterId = requireCharacterId(input.characterId);
  const imageUrl = String(input.imageUrl || "").trim() || undefined;
  const imageData = String(input.imageData || "").trim() || undefined;
  if (!imageUrl && !imageData) {
    return { ok: false, error: "imageUrl または imageData が必要です", status: 400 };
  }

  const entitlements = await getGenAiEntitlementsForUser(userId);
  if (entitlements.tickets3dRemaining < 1) {
    return {
      ok: false,
      error: "3D生成チケットがありません",
      code: "no_tickets",
      tickets3dRemaining: 0,
      status: 402,
    };
  }

  const tripoHealth = await checkTripoConnection();
  if (!tripoHealth.ok) {
    return {
      ok: false,
      error: tripoHealth.error || "Tripo API に接続できません",
      status: 502,
    };
  }

  const { taskId, traceId } = await createImageToModelTask({ imageUrl, imageData });
  const supabase = getServiceSupabase();
  const { data: row, error: insErr } = await supabase
    .from("gen_ai_3d_generations")
    .insert({
      user_id: userId,
      character_id: characterId,
      task_id: taskId,
      status: "processing",
      character_name: String(input.characterName || "").trim() || null,
      ticket_consumed: false,
    })
    .select("*")
    .single();

  if (insErr) {
    console.error("[genai-3d-production] insert generation:", insErr);
    if (insErr.code === "23505") {
      return { ok: false, error: "同じ taskId が既に登録されています", status: 409 };
    }
    return { ok: false, error: insErr.message, status: 500 };
  }

  const after = await getGenAiEntitlementsForUser(userId);
  return {
    ok: true,
    action: "generate_from_ticket",
    taskId,
    generationId: row.id,
    status: "processing",
    traceId,
    ticketConsumed: false,
    tickets3dRemaining: after.tickets3dRemaining,
    message: "Tripo 3D生成を開始しました（チケットは未消費）",
  };
}

export async function handleCompleteGeneration(input: {
  userId: string;
  characterId: string;
  taskId: string;
}) {
  const userId = requireUserId(input.userId);
  const characterId = requireCharacterId(input.characterId);
  const taskId = requireTaskId(input.taskId);

  let row = await getGenerationByTask(userId, taskId);
  if (!row) {
    return { ok: false, error: "生成記録が見つかりません", status: 404 };
  }
  if (row.character_id !== characterId) {
    return { ok: false, error: "characterId が一致しません", status: 403 };
  }

  const entitlements = await getGenAiEntitlementsForUser(userId);

  if (row.status === "success" && row.ticket_consumed) {
    return successPayload(row, entitlements, { idempotent: true });
  }

  if (row.status === "failed") {
    return {
      ok: false,
      status: "failed",
      taskId,
      error: row.error_message || "Tripo 生成に失敗しました",
      ticketConsumed: false,
      tickets3dRemaining: entitlements.tickets3dRemaining,
    };
  }

  const snap = await pollTripoTaskOnce(taskId);
  const supabase = getServiceSupabase();
  const createdMs = Date.parse(String(row.created_at || ""));
  const ageMs = Number.isFinite(createdMs) ? Date.now() - createdMs : 0;
  const STALE_PROCESSING_MS = 30 * 60 * 1000;

  if (!snap.done) {
    if (ageMs > STALE_PROCESSING_MS) {
      const expiredMsg = "生成が長時間完了しませんでした（expired）";
      await supabase
        .from("gen_ai_3d_generations")
        .update({
          status: "expired",
          error_message: expiredMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("user_id", userId)
        .eq("status", "processing");

      return {
        ok: false,
        action: "complete_generation",
        status: "expired",
        taskId,
        error: expiredMsg,
        ticketConsumed: false,
        tickets3dRemaining: entitlements.tickets3dRemaining,
        traceId: snap.traceId,
      };
    }

    return {
      ok: true,
      action: "complete_generation",
      status: snap.status,
      taskId,
      processing: true,
      done: false,
      ticketConsumed: false,
      tickets3dRemaining: entitlements.tickets3dRemaining,
      traceId: snap.traceId,
    };
  }

  if (!snap.success) {
    const errMsg =
      snap.status === "failed" || snap.status === "banned"
        ? `Tripo タスクが ${snap.status} で終了しました`
        : `Tripo タスクが完了しませんでした: ${snap.status}`;
    await supabase
      .from("gen_ai_3d_generations")
      .update({
        status: "failed",
        error_message: errMsg,
        completed_at: new Date().toISOString(),
        credits_used: snap.creditsUsed,
      })
      .eq("id", row.id)
      .eq("user_id", userId)
      .neq("status", "success");

    return {
      ok: false,
      status: snap.status,
      taskId,
      error: errMsg,
      ticketConsumed: false,
      tickets3dRemaining: entitlements.tickets3dRemaining,
      traceId: snap.traceId,
    };
  }

  row = await getGenerationByTask(userId, taskId);
  if (row?.status === "success" && row.ticket_consumed) {
    const ent = await getGenAiEntitlementsForUser(userId);
    return successPayload(row, ent, { idempotent: true });
  }

  const consume = await consume3dGenerateTicket(userId);
  if (!consume.ok) {
    const latest = await getGenerationByTask(userId, taskId);
    if (latest?.status === "success" && latest.ticket_consumed) {
      const ent = await getGenAiEntitlementsForUser(userId);
      return successPayload(latest, ent, { idempotent: true });
    }
    const failMsg = consume.error || "チケットを消費できませんでした";
    await supabase
      .from("gen_ai_3d_generations")
      .update({
        status: "failed",
        error_message: failMsg,
        completed_at: new Date().toISOString(),
        credits_used: snap.creditsUsed,
      })
      .eq("id", row!.id)
      .eq("user_id", userId)
      .eq("ticket_consumed", false)
      .neq("status", "success");

    return {
      ok: false,
      error: failMsg,
      status: "failed",
      httpStatus: consume.status || 402,
      taskId,
      ticketConsumed: false,
      tickets3dRemaining: entitlements.tickets3dRemaining,
    };
  }

  const { data: updated, error: updErr } = await supabase
    .from("gen_ai_3d_generations")
    .update({
      status: "success",
      model_url: snap.modelUrl,
      preview_url: snap.previewUrl,
      download_url: snap.downloadUrl || snap.modelUrl,
      credits_used: snap.creditsUsed,
      ticket_consumed: true,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", row!.id)
    .eq("user_id", userId)
    .eq("ticket_consumed", false)
    .neq("status", "success")
    .select("*")
    .maybeSingle();

  if (updErr) {
    console.error("[genai-3d-production] finalize success:", updErr);
    return { ok: false, error: updErr.message, status: 500, taskId };
  }

  if (!updated) {
    const latest = await getGenerationByTask(userId, taskId);
    if (latest?.status === "success") {
      const ent = await getGenAiEntitlementsForUser(userId);
      return successPayload(latest, ent, { idempotent: true });
    }
    return { ok: false, error: "完了処理の競合が発生しました", status: 409, taskId };
  }

  const ent = consume.entitlements || (await getGenAiEntitlementsForUser(userId));
  return successPayload(updated as GenerationRow, ent, {
    action: "complete_generation",
    traceId: snap.traceId,
  });
}

/** processing のまま残った行を1回だけ照合（再生成・二重チケット消費なし） */
export async function handleReconcileStaleGenerations(input: { userId: string }) {
  const userId = requireUserId(input.userId);
  const supabase = getServiceSupabase();
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("gen_ai_3d_generations")
    .select("task_id, character_id, status, created_at")
    .eq("user_id", userId)
    .eq("status", "processing")
    .lt("created_at", staleBefore)
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) {
    console.error("[genai-3d-production] list stale:", error);
    return { ok: false, error: error.message, status: 500 };
  }

  const results: Record<string, unknown>[] = [];
  for (const row of rows || []) {
    const taskId = String(row.task_id || "").trim();
    const characterId = String(row.character_id || "").trim();
    if (!taskId || !characterId) continue;
    const outcome = await handleCompleteGeneration({ userId, characterId, taskId });
    results.push({
      taskId,
      status: outcome.status ?? (outcome.processing ? "processing" : outcome.ok ? "success" : "failed"),
      ok: outcome.ok,
      error: outcome.error ?? null,
      idempotent: outcome.idempotent ?? false,
    });
  }

  return {
    ok: true,
    action: "reconcile_stale_generations",
    reconciled: results.length,
    results,
  };
}
