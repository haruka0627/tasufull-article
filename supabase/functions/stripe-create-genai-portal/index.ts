import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getStripeCustomerIdForUser } from "../_shared/apply-genai-plan.ts";

function resolveReturnUrl(req: Request, body: Record<string, unknown>): string {
  const fromBody = String(body.returnUrl ?? body.return_url ?? "").trim();
  if (fromBody) {
    if (/^https?:\/\//i.test(fromBody)) return fromBody.replace(/\/$/, "");
    const siteOrigin = String(Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
    const base = siteOrigin || (() => {
      try {
        return new URL(req.headers.get("referer") || "").origin;
      } catch {
        return "http://localhost:5173";
      }
    })();
    const path = fromBody.startsWith("/") ? fromBody : `/${fromBody}`;
    return `${base}${path}`;
  }

  const siteOrigin = String(Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
  if (siteOrigin) return `${siteOrigin}/gen-ai-workspace.html`;
  try {
    return `${new URL(req.headers.get("referer") || "").origin}/gen-ai-workspace.html`;
  } catch {
    return "http://localhost:5173/gen-ai-workspace.html";
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) return jsonResponse({ error: "STRIPE_SECRET_KEY が未設定です" }, 500);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const userId = String(body.userId ?? body.user_id ?? "").trim();

    if (!userId) {
      return jsonResponse(
        { ok: false, error: "user_id が必要です", url: "" },
        400
      );
    }

    const customerResult = await getStripeCustomerIdForUser(userId);
    if (!customerResult.ok) {
      return jsonResponse(
        {
          ok: false,
          error: customerResult.error,
          url: "",
          code: customerResult.code,
        },
        customerResult.status ?? 404
      );
    }

    const returnUrl = `${resolveReturnUrl(req, body)}?genai_portal=return`;

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerResult.customerId,
      return_url: returnUrl,
      locale: "ja",
    });

    if (!session.url) {
      return jsonResponse({ ok: false, error: "Portal URL の生成に失敗しました", url: "" }, 500);
    }

    return jsonResponse({ ok: true, url: session.url });
  } catch (err) {
    console.error("[stripe-create-genai-portal]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error: message, url: "" }, 500);
  }
});
