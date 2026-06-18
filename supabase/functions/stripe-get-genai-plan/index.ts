import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getGenAiPlanForUser } from "../_shared/apply-genai-plan.ts";
import { getGenAiEntitlementsForUser } from "../_shared/apply-genai-entitlements.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const userId = String(body.user_id ?? body.userId ?? "").trim();
    if (!userId) return jsonResponse({ error: "user_id が必要です" }, 400);

    const [planResult, entitlements] = await Promise.all([
      getGenAiPlanForUser(userId),
      getGenAiEntitlementsForUser(userId),
    ]);

    if (!planResult.ok) {
      return jsonResponse({ error: planResult.error }, planResult.status ?? 500);
    }

    return jsonResponse({
      ok: true,
      plan: {
        ...planResult.plan,
        live2dUnlimited: entitlements.live2dUnlimited,
        twoDLive: entitlements.live2dUnlimited,
        live2dStatus: entitlements.live2dStatus,
        live2dCurrentPeriodEnd: entitlements.live2dCurrentPeriodEnd,
        live2dCancelScheduled: entitlements.live2dCancelScheduled,
        tickets3dRemaining: entitlements.tickets3dRemaining,
        tickets3dTotalPurchased: entitlements.tickets3dTotalPurchased,
      },
      entitlements: {
        ...entitlements,
        twoDLive: entitlements.live2dUnlimited,
      },
    });
  } catch (err) {
    console.error("[stripe-get-genai-plan]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
