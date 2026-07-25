/**
 * TASFUL AI — Marketplace catalog search (Phase 1)
 * - No AI Provider
 * - Anon/JWT client only (no service role)
 * - Public marketplace products only
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  MAX_BODY_BYTES,
  type SearchIntent,
  validateSearchBody,
} from "./schema.ts";

const LISTING_SELECT =
  "id,title,description,tags,price_amount,image_url,thumbnail_url,category,form_data,publish_status,listing_type";
const SHOP_SELECT =
  "id,company_name,title,description,business_category,service_area,tags,publish_status,rating,review_count";
const PRODUCT_SELECT =
  "id,listing_id,product_name,product_category,product_description,product_image_url,price,stock_status,stock_quantity,is_active,same_day_shipping,delivery_method,display_order";

const DETAIL_ALLOW = new Set([
  "detail-product.html",
  "detail-shop-product.html",
]);

type CatalogResult = {
  id: string;
  vertical: "marketplace";
  type: string;
  kind: string;
  title: string;
  summary?: string;
  imageUrl?: string;
  priceLabel?: string;
  rating?: number;
  reviewCount?: number;
  locationLabel?: string;
  availabilityLabel?: string;
  detailUrl: string;
  primaryActionLabel: string;
  badges?: string[];
  _priceYen?: number | null;
  _score?: number;
};

function err(code: string, message: string, status: number, req: Request) {
  return jsonResponse(
    { ok: false, error: { code, message } },
    status,
    req,
    { "Cache-Control": "no-store" },
  );
}

function ok(body: unknown, req: Request, status = 200) {
  return jsonResponse(body, status, req, { "Cache-Control": "no-store" });
}

function createAnonClient(req: Request): SupabaseClient | null {
  const url = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  if (!url || !anonKey) return null;

  const auth = req.headers.get("Authorization")?.trim() || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  // Prefer caller JWT when present; otherwise anon (public catalog). Never service role.
  const token = bearer && bearer !== anonKey ? bearer : anonKey;

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function parsePriceYen(raw: unknown, amount: unknown): number | null {
  const text = String(raw ?? "").trim();
  const man = text.match(/(\d+)\s*万/);
  if (man) return Number(man[1]) * 10000;
  const yen = text.match(/([\d,]+)\s*円/);
  if (yen) return Number(yen[1].replace(/,/g, ""));
  if (amount != null && Number.isFinite(Number(amount))) return Number(amount);
  const plain = Number(String(raw ?? "").replace(/[^\d.]/g, ""));
  if (text && Number.isFinite(plain) && plain > 0) return plain;
  return null;
}

function formatPriceLabel(raw: unknown, amount: unknown): string {
  const text = String(raw ?? "").trim();
  if (text) return text.slice(0, 80);
  if (amount != null && Number.isFinite(Number(amount))) {
    return `¥${Number(amount).toLocaleString("ja-JP")}`;
  }
  return "";
}

function tokens(query: string): string[] {
  return query
    .split(/[\s、。・\/]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2)
    .slice(0, 12);
}

function scoreHay(hay: string, intent: SearchIntent): number {
  const tks = tokens(intent.query);
  if (!tks.length) return 0;
  let score = 0;
  for (const t of tks) {
    if (hay.includes(t)) score += 3;
  }
  if (intent.location) {
    const loc = intent.location.toLowerCase();
    if (hay.includes(loc) || (loc.includes("東京") && /東京|都内/.test(hay))) {
      score += 2;
    }
  }
  return score;
}

function buildDetailUrl(page: string, params: Record<string, string>, q?: string): string {
  if (!DETAIL_ALLOW.has(page)) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = String(v || "").trim();
    if (!val) continue;
    if (/[^\w\-.:]/u.test(k)) continue;
    sp.set(k, val);
  }
  sp.set("from", "ai");
  const safeQ = String(q || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (safeQ && !/@|電話|TEL|〒|住所/i.test(safeQ)) {
    sp.set("q", safeQ);
  }
  const qs = sp.toString();
  return qs ? `${page}?${qs}` : page;
}

function omitEmpty<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const key of Object.keys(out)) {
    const v = out[key];
    if (v == null || v === "" || (typeof v === "number" && !Number.isFinite(v))) {
      delete out[key];
    }
  }
  return out;
}

function listingToResult(
  row: Record<string, unknown>,
  intent: SearchIntent,
): CatalogResult | null {
  if (String(row.publish_status || "") !== "public") return null;
  if (String(row.listing_type || "") !== "product") return null;
  const id = String(row.id || "").trim();
  const title = String(row.title || "").trim();
  if (!id || !title) return null;

  const fd =
    row.form_data && typeof row.form_data === "object" && !Array.isArray(row.form_data)
      ? (row.form_data as Record<string, unknown>)
      : {};
  const priceLabel = formatPriceLabel(
    fd.price ?? fd.price_text,
    row.price_amount,
  );
  const priceYen = parsePriceYen(fd.price ?? fd.price_text, row.price_amount);
  const summary = String(row.description || fd.description || "")
    .trim()
    .slice(0, 200);
  const imageUrl = String(row.image_url || row.thumbnail_url || "").trim();
  const locationLabel = String(
    fd.service_area || fd.area || fd.delivery_method || "",
  ).trim();
  const availabilityLabel = String(fd.stock_count || fd.stock_status || "").trim();
  const detailUrl = buildDetailUrl("detail-product.html", { id }, intent.query);
  if (!detailUrl) return null;

  const hay = [
    title,
    summary,
    row.tags,
    row.category,
    priceLabel,
    locationLabel,
  ]
    .join(" ")
    .toLowerCase();
  const score = scoreHay(hay, intent);
  if (tokens(intent.query).length && score <= 0) return null;

  return omitEmpty({
    id,
    vertical: "marketplace" as const,
    type: "product",
    kind: "product",
    title: title.slice(0, 120),
    summary: summary || undefined,
    imageUrl: imageUrl || undefined,
    priceLabel: priceLabel || undefined,
    locationLabel: locationLabel || undefined,
    availabilityLabel: availabilityLabel || undefined,
    detailUrl,
    primaryActionLabel: "購入ページへ",
    _priceYen: priceYen,
    _score: score,
  }) as CatalogResult;
}

function shopProductToResult(
  shop: Record<string, unknown>,
  product: Record<string, unknown>,
  intent: SearchIntent,
): CatalogResult | null {
  if (String(shop.publish_status || "") !== "public") return null;
  if (String(shop.business_category || "") !== "shop_store") return null;
  if (product.is_active === false) return null;

  const shopId = String(shop.id || "").trim();
  const productId = String(product.id || "").trim();
  const title = String(product.product_name || "").trim();
  if (!shopId || !productId || !title) return null;

  const priceLabel = formatPriceLabel(product.price, null);
  const priceYen = parsePriceYen(product.price, null);
  const summary = String(product.product_description || "")
    .trim()
    .slice(0, 200);
  const imageUrl = String(product.product_image_url || "").trim();
  const locationLabel = String(shop.service_area || "").trim();
  const stock = String(product.stock_status || product.stock_quantity || "").trim();
  const rating =
    shop.rating != null && Number.isFinite(Number(shop.rating)) && Number(shop.rating) > 0
      ? Number(shop.rating)
      : undefined;
  const reviewCount =
    shop.review_count != null &&
    Number.isFinite(Number(shop.review_count)) &&
    Number(shop.review_count) > 0
      ? Number(shop.review_count)
      : undefined;

  const detailUrl = buildDetailUrl(
    "detail-shop-product.html",
    { shopId, productId },
    intent.query,
  );
  if (!detailUrl) return null;

  const hay = [
    title,
    summary,
    product.product_category,
    shop.company_name,
    shop.title,
    shop.tags,
    priceLabel,
    locationLabel,
  ]
    .join(" ")
    .toLowerCase();
  const score = scoreHay(hay, intent);
  if (tokens(intent.query).length && score <= 0) return null;

  return omitEmpty({
    id: productId,
    vertical: "marketplace" as const,
    type: "shop_product",
    kind: "shop_product",
    title: title.slice(0, 120),
    summary: summary || undefined,
    imageUrl: imageUrl || undefined,
    priceLabel: priceLabel || undefined,
    rating,
    reviewCount,
    locationLabel: locationLabel || undefined,
    availabilityLabel: stock || undefined,
    detailUrl,
    primaryActionLabel: "購入ページへ",
    _priceYen: priceYen,
    _score: score,
  }) as CatalogResult;
}

function applyPriceFilter(items: CatalogResult[], intent: SearchIntent): CatalogResult[] {
  return items.filter((item) => {
    const yen = item._priceYen;
    if (yen == null) return true;
    if (intent.priceMin != null && yen < intent.priceMin) return false;
    if (intent.priceMax != null && yen > intent.priceMax) return false;
    return true;
  });
}

function sortResults(items: CatalogResult[], intent: SearchIntent): CatalogResult[] {
  const list = [...items];
  if (intent.sort === "price_asc") {
    list.sort((a, b) => (a._priceYen ?? 1e15) - (b._priceYen ?? 1e15));
  } else if (intent.sort === "price_desc") {
    list.sort((a, b) => (b._priceYen ?? -1) - (a._priceYen ?? -1));
  } else if (intent.sort === "rating") {
    list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (intent.sort === "recent") {
    /* keep fetch order */
  } else {
    list.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  }
  return list;
}

function stripInternal(item: CatalogResult): Record<string, unknown> {
  const { _priceYen: _p, _score: _s, ...rest } = item;
  return omitEmpty(rest as Record<string, unknown>);
}

async function searchMarketplace(
  client: SupabaseClient,
  intent: SearchIntent,
): Promise<{ results: CatalogResult[]; truncated: boolean }> {
  const fetchLimit = 40;
  const results: CatalogResult[] = [];

  const listingsRes = await client
    .from("listings")
    .select(LISTING_SELECT)
    .eq("listing_type", "product")
    .eq("publish_status", "public")
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (!listingsRes.error && Array.isArray(listingsRes.data)) {
    for (const row of listingsRes.data) {
      const item = listingToResult(row as Record<string, unknown>, intent);
      if (item) results.push(item);
    }
  }

  const shopsRes = await client
    .from("business_listings")
    .select(SHOP_SELECT)
    .eq("business_category", "shop_store")
    .eq("publish_status", "public")
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  const shops = !shopsRes.error && Array.isArray(shopsRes.data)
    ? (shopsRes.data as Record<string, unknown>[])
    : [];
  const shopMap = new Map(shops.map((s) => [String(s.id), s]));

  if (shops.length) {
    const ids = shops.map((s) => String(s.id)).filter(Boolean).slice(0, 40);
    const productsRes = await client
      .from("shop_store_products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .in("listing_id", ids)
      .order("display_order", { ascending: true })
      .limit(100);

    if (!productsRes.error && Array.isArray(productsRes.data)) {
      for (const product of productsRes.data as Record<string, unknown>[]) {
        const shop = shopMap.get(String(product.listing_id || ""));
        if (!shop) continue;
        const item = shopProductToResult(shop, product, intent);
        if (item) results.push(item);
      }
    }
  }

  const filtered = applyPriceFilter(results, intent);
  const sorted = sortResults(filtered, intent);
  const truncated = sorted.length > intent.limit;
  return {
    results: sorted.slice(0, intent.limit),
    truncated,
  };
}

async function readJsonBody(req: Request): Promise<
  { ok: true; body: unknown } | { ok: false; response: Response }
> {
  const contentType = (req.headers.get("Content-Type") || "").toLowerCase();
  if (contentType && !contentType.includes("application/json")) {
    return {
      ok: false,
      response: err("invalid_content_type", "application/json required", 400, req),
    };
  }

  const lenHeader = req.headers.get("Content-Length");
  if (lenHeader) {
    const len = Number(lenHeader);
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return {
        ok: false,
        response: err("payload_too_large", "Request body too large", 413, req),
      };
    }
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: err("payload_too_large", "Request body too large", 413, req),
    };
  }
  if (!raw.trim()) {
    return {
      ok: false,
      response: err("invalid_input", "Request body is required", 400, req),
    };
  }

  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return {
      ok: false,
      response: err("invalid_json", "Invalid JSON body", 400, req),
    };
  }
}

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return err("method_not_allowed", "Method not allowed", 405, req);
  }

  // Ignore body user_id / claimed identity — public catalog only.
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const validated = validateSearchBody(parsed.body);
  if (!validated.ok) {
    return err(validated.code, validated.message, 400, req);
  }

  const intent = validated.value;
  if (!intent.query || intent.query.length < 1) {
    return ok(
      {
        ok: true,
        results: [],
        meta: { count: 0, truncated: false },
      },
      req,
    );
  }

  const client = createAnonClient(req);
  if (!client) {
    return err("config_error", "Search is temporarily unavailable", 500, req);
  }

  try {
    const { results, truncated } = await searchMarketplace(client, intent);
    return ok(
      {
        ok: true,
        results: results.map(stripInternal),
        meta: { count: results.length, truncated },
      },
      req,
    );
  } catch (e) {
    console.error("[ai-tasful-search]", e instanceof Error ? e.name : "error");
    return err("search_unavailable", "Search is temporarily unavailable", 500, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
