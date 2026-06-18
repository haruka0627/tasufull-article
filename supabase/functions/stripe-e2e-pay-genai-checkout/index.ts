/**
 * テストモード専用: 作成済み Checkout Session をテストカードで決済完了（Hosted UI の代替）
 */
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { parseGenAiCheckoutPlanIdFromMetadata } from "../_shared/genai-checkout-plans.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret?.startsWith("sk_test_")) {
      return jsonResponse({ error: "sk_test_ モードのみ利用可能です" }, 403);
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const sessionId = String(body.session_id ?? body.sessionId ?? "").trim();
    if (!sessionId) {
      return jsonResponse({ error: "session_id が必要です" }, 400);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    let session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (session.payment_status === "paid" || session.status === "complete") {
      return jsonResponse({
        ok: true,
        already_paid: true,
        session_id: sessionId,
        payment_status: session.payment_status,
        status: session.status,
      });
    }

    if (session.mode !== "payment") {
      return jsonResponse(
        { error: "payment モードの Checkout Session のみ対応しています", mode: session.mode },
        400
      );
    }

    let piId: string | null = null;
    const piRaw = session.payment_intent;
    if (typeof piRaw === "string") piId = piRaw;
    else if (piRaw && typeof piRaw === "object" && "id" in piRaw) piId = String(piRaw.id);

    if (!piId) {
      for (let i = 0; i < 6; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["payment_intent"],
        });
        const raw = session.payment_intent;
        if (typeof raw === "string") {
          piId = raw;
          break;
        }
        if (raw && typeof raw === "object" && "id" in raw) {
          piId = String(raw.id);
          break;
        }
      }
    }

    if (!piId) {
      return jsonResponse(
        {
          error:
            "payment_intent が見つかりません。Checkout ページを開いてから stripe-e2e-pay-genai-checkout を呼んでください。",
          session_status: session.status,
        },
        400
      );
    }

    const pm = await stripe.paymentMethods.create({
      type: "card",
      card: { token: "tok_visa" },
    });

    await stripe.paymentIntents.confirm(piId, {
      payment_method: pm.id,
      return_url: session.success_url || undefined,
    });

    session = await stripe.checkout.sessions.retrieve(sessionId);

    return jsonResponse({
      ok: true,
      paid: session.payment_status === "paid",
      session_id: sessionId,
      payment_status: session.payment_status,
      status: session.status,
      genai_plan: parseGenAiCheckoutPlanIdFromMetadata(session.metadata || {}),
      user_id: session.metadata?.user_id || session.client_reference_id,
    });
  } catch (err) {
    console.error("[stripe-e2e-pay-genai-checkout]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
