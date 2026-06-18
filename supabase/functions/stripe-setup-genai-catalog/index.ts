/**
 * Stripe 生成AIカタログの idempotent セットアップ（商品・価格・Webhook）
 * stripe_products テーブルは使わず Stripe API で作成します。
 */
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  GENAI_ADDON_PLANS,
  type GenAiAddonPlanId,
} from "../_shared/genai-checkout-plans.ts";
import {
  GENAI_PLANS,
  GENAI_STRIPE_PRODUCT_IDS,
  resolveStripePriceId,
  type GenAiPlanId,
} from "../_shared/genai-plans.ts";
import { resolveStripePriceIdForCheckout } from "../_shared/genai-checkout-plans.ts";

async function findOrCreateGenAiPrice(stripe: Stripe, planId: GenAiPlanId) {
  const plan = GENAI_PLANS[planId];

  async function validatePrice(priceId: string) {
    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      const product = price.product as Stripe.Product | string;
      const productObj =
        typeof product === "string" ? await stripe.products.retrieve(product) : product;
      if (price.active && productObj.active) {
        return { productId: productObj.id, priceId: price.id, created: false };
      }
    } catch {
      /* recreate below */
    }
    return null;
  }

  const configuredPriceId = resolveStripePriceId(planId);
  if (configuredPriceId) {
    const valid = await validatePrice(configuredPriceId);
    if (valid) return valid;
  }

  const search = await stripe.products.search({
    query: `metadata['genai_plan']:'${planId}' AND active:'true'`,
    limit: 5,
  });

  for (const candidate of search.data) {
    const prices = await stripe.prices.list({ product: candidate.id, active: true, limit: 20 });
    const existing = prices.data.find(
      (p) =>
        p.currency === "jpy" &&
        p.unit_amount === plan.amountJpy &&
        p.recurring?.interval === "month"
    );
    if (existing) {
      const valid = await validatePrice(existing.id);
      if (valid) return valid;
    }
  }

  const product = await stripe.products.create({
    name: plan.label,
    active: true,
    metadata: {
      genai_plan: planId,
      tasful_product_id: GENAI_STRIPE_PRODUCT_IDS[planId],
      order_type: "genai_subscription",
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "jpy",
    unit_amount: plan.amountJpy,
    recurring: { interval: "month" },
    metadata: { genai_plan: planId },
  });

  return { productId: product.id, priceId: price.id, created: true };
}

async function findOrCreateAddonPrice(stripe: Stripe, planId: GenAiAddonPlanId) {
  const def = GENAI_ADDON_PLANS[planId];

  async function validatePrice(priceId: string) {
    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      const product = price.product as Stripe.Product | string;
      const productObj =
        typeof product === "string" ? await stripe.products.retrieve(product) : product;
      if (price.active && productObj.active) {
        return { productId: productObj.id, priceId: price.id, lookupKey: price.lookup_key, created: false };
      }
    } catch {
      /* recreate */
    }
    return null;
  }

  const configured = resolveStripePriceIdForCheckout(planId);
  if (configured) {
    const valid = await validatePrice(configured);
    if (valid) return valid;
  }

  const byLookup = await stripe.prices.list({
    lookup_keys: [def.lookupKey],
    active: true,
    limit: 1,
  });
  if (byLookup.data[0]) {
    const valid = await validatePrice(byLookup.data[0].id);
    if (valid) return valid;
  }

  const search = await stripe.products.search({
    query: `metadata['genai_plan']:'${planId}' AND active:'true'`,
    limit: 5,
  });

  for (const candidate of search.data) {
    const prices = await stripe.prices.list({ product: candidate.id, active: true, limit: 20 });
    const existing = prices.data.find((p) => {
      if (p.currency !== "jpy" || p.unit_amount !== def.amountJpy) return false;
      if (def.mode === "subscription") return p.recurring?.interval === "month";
      return !p.recurring;
    });
    if (existing) {
      const valid = await validatePrice(existing.id);
      if (valid) return valid;
    }
  }

  const product = await stripe.products.create({
    name: def.label,
    active: true,
    metadata: {
      genai_plan: planId,
      tasful_product_id: def.stripeProductRef,
      order_type: def.orderType,
    },
  });

  const priceParams: Stripe.PriceCreateParams = {
    product: product.id,
    currency: "jpy",
    unit_amount: def.amountJpy,
    lookup_key: def.lookupKey,
    metadata: { genai_plan: planId },
  };
  if (def.mode === "subscription") {
    priceParams.recurring = { interval: "month" };
  }

  const price = await stripe.prices.create(priceParams);

  return {
    productId: product.id,
    priceId: price.id,
    lookupKey: def.lookupKey,
    created: true,
  };
}

async function ensureGenAiWebhook(stripe: Stripe, webhookUrl: string) {
  const events = [
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ];

  const listed = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = listed.data.find((e) => e.url === webhookUrl);

  if (existing) {
    const needsUpdate = events.some((ev) => !existing.enabled_events.includes(ev));
    if (needsUpdate) {
      await stripe.webhookEndpoints.update(existing.id, {
        enabled_events: [...new Set([...existing.enabled_events, ...events])],
      });
    }
    return {
      id: existing.id,
      url: existing.url,
      enabled_events: [...new Set([...existing.enabled_events, ...events])],
      secret: null as string | null,
      created: false,
      note: "既存 Webhook。Secret は Dashboard / 初回作成時のみ取得可。STRIPE_WEBHOOK_SECRET を使用。",
    };
  }

  const created = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: events,
    description: "TASFUL GenAI + Featured subscriptions",
  });

  return {
    id: created.id,
    url: created.url,
    enabled_events: created.enabled_events,
    secret: created.secret,
    created: true,
    note: "新規 Webhook 作成。secret を STRIPE_WEBHOOK_SECRET に設定してください。",
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) return jsonResponse({ error: "STRIPE_SECRET_KEY が未設定です" }, 500);
    if (!stripeSecret.startsWith("sk_test_")) {
      return jsonResponse({ error: "テストモード (sk_test_) のみセットアップ可能です" }, 403);
    }

    const setupToken = Deno.env.get("GENAI_SETUP_TOKEN") || "";
    if (setupToken) {
      const provided = req.headers.get("x-genai-setup-token") || "";
      if (provided !== setupToken) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
    const webhookUrl = `${supabaseUrl}/functions/v1/stripe-webhook`;

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const basic = await findOrCreateGenAiPrice(stripe, "genai_basic_300");
    const pro = await findOrCreateGenAiPrice(stripe, "genai_pro_980");
    const live2d = await findOrCreateAddonPrice(stripe, "genai_2d_live_300");
    const ticket3d = await findOrCreateAddonPrice(stripe, "genai_3d_generate_500");
    const webhook = await ensureGenAiWebhook(stripe, webhookUrl);

    return jsonResponse({
      ok: true,
      products: {
        genai_basic_300: {
          productId: basic.productId,
          priceId: basic.priceId,
          created: basic.created,
        },
        genai_pro_980: {
          productId: pro.productId,
          priceId: pro.priceId,
          created: pro.created,
        },
        genai_2d_live_300: {
          productId: live2d.productId,
          priceId: live2d.priceId,
          lookupKey: live2d.lookupKey,
          mode: "subscription",
          created: live2d.created,
        },
        genai_3d_generate_500: {
          productId: ticket3d.productId,
          priceId: ticket3d.priceId,
          lookupKey: ticket3d.lookupKey,
          mode: "payment",
          created: ticket3d.created,
        },
      },
      webhook,
      secrets_to_set: {
        STRIPE_GENAI_PRICE_BASIC_300: basic.priceId,
        STRIPE_GENAI_PRICE_PRO_980: pro.priceId,
        STRIPE_GENAI_PRICE_2D_LIVE_300: live2d.priceId,
        STRIPE_GENAI_PRICE_3D_GENERATE_500: ticket3d.priceId,
        ...(webhook.secret ? { STRIPE_WEBHOOK_SECRET: webhook.secret } : {}),
      },
      webhook_endpoint_url: webhookUrl,
      note: "stripe-webhook で featured + genai（Basic/Pro/2D Live/3Dチケット）を処理",
    });
  } catch (err) {
    console.error("[stripe-setup-genai-catalog]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
