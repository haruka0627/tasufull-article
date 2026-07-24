/**
 * AUTO-GENERATED — do not edit.
 * Source: shared/pricing/tasful-pricing-catalog.json
 * Generator: scripts/generate-pricing-config.mjs
 * Generated: 2026-07-05T01:52:12.427Z
 */

export type PricingBillingType = "fixed" | "percent" | "subscription" | "usage" | "placeholder";
export type PricingStatus = "active" | "draft" | "planned";
export type PricingSkuId = "platform_match_job_contact" | "platform_match_general_contact" | "platform_match_connect_rate" | "platform_boost_featured_7d" | "platform_boost_featured_30d" | "platform_boost_pr_30d" | "platform_sponsor_ads_placeholder" | "platform_urgent_priority_placeholder" | "platform_verified_badge_placeholder" | "platform_request_user_subscription" | "platform_request_receiver_subscription" | "platform_request_match_contact" | "tasful_ai_lite" | "tasful_ai_pro" | "tasful_ai_max_placeholder" | "tasful_ai_addon_2d_live_300" | "tasful_ai_addon_3d_generate_500" | "tasful_ai_deep_research" | "tasful_ai_video_generate" | "tasful_ai_realtime_voice" | "tasful_ai_ultra" | "tasful_ai_enterprise" | "tasful_ai_api_credit" | "builder_contact_reveal";

export type PricingLimits = {
  daily?: Record<string, number | null>;
  monthly?: Record<string, unknown>;
};

export type PricingSku = {
  sku: string;
  domain: string;
  label: string;
  description: string;
  billingType: PricingBillingType;
  amount?: number;
  currency: string;
  percent?: number;
  minimumAmount?: number;
  durationDays?: number;
  provisional: boolean;
  enabled: boolean;
  status: PricingStatus;
  stripePriceEnvKey?: string;
  limits?: PricingLimits;
  features?: string[];
};

export type PricingCatalog = {
  schemaVersion: number;
  updatedAt: string;
  defaultCurrency: string;
  skus: Record<string, PricingSku>;
};

export const TASFUL_PRICING_CATALOG = {
  "schemaVersion": 1,
  "updatedAt": "2026-07-05",
  "defaultCurrency": "JPY",
  "skus": {
    "platform_match_job_contact": {
      "sku": "platform_match_job_contact",
      "domain": "platform",
      "label": "求人やりとり開始料",
      "description": "求人（Connectなし）— 掲載者がやりとり開始時に支払う固定料金",
      "billingType": "fixed",
      "amount": 550,
      "currency": "JPY",
      "provisional": true,
      "enabled": true,
      "status": "active",
      "features": [
        "job_category",
        "poster_pays",
        "no_stripe_connect"
      ]
    },
    "platform_match_general_contact": {
      "sku": "platform_match_general_contact",
      "domain": "platform",
      "label": "やりとり開始料",
      "description": "スキル/商品/店舗/業務/ワーカー（Connectなし）— チャット開始側が支払う固定料金",
      "billingType": "fixed",
      "amount": 550,
      "currency": "JPY",
      "provisional": true,
      "enabled": true,
      "status": "active",
      "features": [
        "listing_chat_start",
        "initiator_pays"
      ]
    },
    "platform_match_connect_rate": {
      "sku": "platform_match_connect_rate",
      "domain": "platform",
      "label": "成約手数料（Connect）",
      "description": "Stripe Connect あり — 取引完了時の率課金（最低額あり）",
      "billingType": "percent",
      "percent": 5,
      "minimumAmount": 550,
      "currency": "JPY",
      "provisional": true,
      "enabled": true,
      "status": "active",
      "features": [
        "stripe_connect",
        "completion_fee"
      ]
    },
    "platform_boost_featured_7d": {
      "sku": "platform_boost_featured_7d",
      "domain": "platform",
      "label": "上位掲載（7日）",
      "description": "Platform 掲載の期間ブースト（featured）",
      "billingType": "fixed",
      "amount": 980,
      "currency": "JPY",
      "durationDays": 7,
      "provisional": true,
      "enabled": true,
      "status": "active",
      "features": [
        "featured",
        "priority_1"
      ]
    },
    "platform_boost_featured_30d": {
      "sku": "platform_boost_featured_30d",
      "domain": "platform",
      "label": "上位掲載（30日）",
      "description": "Platform 掲載の期間ブースト（featured）",
      "billingType": "fixed",
      "amount": 2980,
      "currency": "JPY",
      "durationDays": 30,
      "provisional": true,
      "enabled": true,
      "status": "active",
      "features": [
        "featured",
        "priority_2"
      ]
    },
    "platform_boost_pr_30d": {
      "sku": "platform_boost_pr_30d",
      "domain": "platform",
      "label": "PR掲載（30日）",
      "description": "Platform PR 掲載枠",
      "billingType": "fixed",
      "amount": 4980,
      "currency": "JPY",
      "durationDays": 30,
      "provisional": true,
      "enabled": true,
      "status": "active",
      "features": [
        "pr",
        "priority_3"
      ]
    },
    "platform_sponsor_ads_placeholder": {
      "sku": "platform_sponsor_ads_placeholder",
      "domain": "platform",
      "label": "スポンサー掲載（未確定）",
      "description": "TASFUL 共通スポンサー広告 — 価格未確定 · organic 非干渉",
      "billingType": "placeholder",
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "planned",
      "features": [
        "sponsor_block",
        "organic_separate"
      ]
    },
    "platform_urgent_priority_placeholder": {
      "sku": "platform_urgent_priority_placeholder",
      "domain": "platform",
      "label": "急ぎ案件優先（未確定）",
      "description": "掲載者向け急ぎバッジ期間オプション — 価格未確定",
      "billingType": "placeholder",
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "planned",
      "features": [
        "urgent_badge",
        "no_organic_boost"
      ]
    },
    "platform_verified_badge_placeholder": {
      "sku": "platform_verified_badge_placeholder",
      "domain": "platform",
      "label": "認証バッジ（バンドル予定）",
      "description": "単体 SKU なし — プラン entitlement として将来定義",
      "billingType": "placeholder",
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "planned",
      "features": [
        "kyc_badge",
        "entitlement_bundle"
      ]
    },
    "platform_request_user_subscription": {
      "sku": "platform_request_user_subscription",
      "domain": "platform",
      "label": "Platform Request — 依頼投稿サブスク",
      "description": "利用者が短い依頼を投稿し放題（月額 · 仮価格）",
      "billingType": "subscription",
      "amount": 330,
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "limits": {
        "monthly": {
          "request_posts": null
        }
      },
      "features": [
        "platform_request",
        "poster_subscription",
        "short_form_post"
      ]
    },
    "platform_request_receiver_subscription": {
      "sku": "platform_request_receiver_subscription",
      "domain": "platform",
      "label": "Platform Request — 通知受信サブスク",
      "description": "業者・ワーカーが条件合致の依頼通知を受信（月額 · 仮価格）",
      "billingType": "subscription",
      "amount": 550,
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "limits": {
        "monthly": {
          "notification_fanout": null
        }
      },
      "features": [
        "platform_request",
        "receiver_subscription",
        "match_notify"
      ]
    },
    "platform_request_match_contact": {
      "sku": "platform_request_match_contact",
      "domain": "platform",
      "label": "Platform Request — Talk開始 / 連絡先開示",
      "description": "依頼マッチ後の Talk 開始または連絡先開示（都度 · 仮価格）",
      "billingType": "fixed",
      "amount": 550,
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "features": [
        "platform_request",
        "talk_start",
        "contact_reveal",
        "initiator_pays"
      ]
    },
    "tasful_ai_lite": {
      "sku": "tasful_ai_lite",
      "domain": "tasful_ai",
      "label": "TASFUL AI Lite",
      "description": "Gemini 特化 · 月額サブスク（genai_basic_300 相当）",
      "billingType": "subscription",
      "amount": 300,
      "currency": "JPY",
      "provisional": true,
      "enabled": true,
      "status": "active",
      "stripePriceEnvKey": "STRIPE_GENAI_PRICE_BASIC_300",
      "limits": {
        "daily": {
          "text_turn": 30,
          "voice_turn": 30,
          "image_turn": 10,
          "deep_research_turn": 0,
          "video_minute": 0,
          "realtime_voice_minute": 0
        }
      },
      "features": [
        "gemini_only",
        "routing_manual"
      ]
    },
    "tasful_ai_pro": {
      "sku": "tasful_ai_pro",
      "domain": "tasful_ai",
      "label": "TASFUL AI Pro",
      "description": "マルチ AI ルーティング · 月額サブスク（genai_pro_980 相当）",
      "billingType": "subscription",
      "amount": 980,
      "currency": "JPY",
      "provisional": true,
      "enabled": true,
      "status": "active",
      "stripePriceEnvKey": "STRIPE_GENAI_PRICE_PRO_980",
      "limits": {
        "daily": {
          "text_turn": 100,
          "voice_turn": 100,
          "image_turn": 30,
          "deep_research_turn": 0,
          "video_minute": 0,
          "realtime_voice_minute": 0
        }
      },
      "features": [
        "multi_model",
        "routing_manual",
        "routing_auto"
      ]
    },
    "tasful_ai_max_placeholder": {
      "sku": "tasful_ai_max_placeholder",
      "domain": "tasful_ai",
      "label": "TASFUL AI Max（未実装）",
      "description": "フル機能 · Fair Use 拡張 — Stripe SKU 未実装",
      "billingType": "subscription",
      "amount": 2980,
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "limits": {
        "daily": {
          "text_turn": null,
          "voice_turn": null,
          "image_turn": null,
          "deep_research_turn": null,
          "video_minute": null,
          "realtime_voice_minute": null
        },
        "monthly": {
          "fair_use_policy": "cursor_style"
        }
      },
      "features": [
        "multi_model",
        "routing_auto",
        "fair_use_extended"
      ]
    },
    "tasful_ai_addon_2d_live_300": {
      "sku": "tasful_ai_addon_2d_live_300",
      "domain": "tasful_ai",
      "label": "TASFUL AI 2D Live",
      "description": "画像アニメ（2D Live）を無制限で利用",
      "billingType": "subscription",
      "amount": 300,
      "currency": "JPY",
      "provisional": true,
      "enabled": true,
      "status": "active",
      "stripePriceEnvKey": "STRIPE_GENAI_PRICE_2D_LIVE_300",
      "features": [
        "addon_2d_live",
        "legacy_id:genai_2d_live_300"
      ]
    },
    "tasful_ai_addon_3d_generate_500": {
      "sku": "tasful_ai_addon_3d_generate_500",
      "domain": "tasful_ai",
      "label": "TASFUL AI 3D Generate",
      "description": "3D生成チケット +1（3D生成APIは準備中）",
      "billingType": "fixed",
      "amount": 500,
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "stripePriceEnvKey": "STRIPE_GENAI_PRICE_3D_GENERATE_500",
      "features": [
        "addon_3d_generate",
        "legacy_id:genai_3d_generate_500",
        "api_not_ready"
      ]
    },
    "tasful_ai_deep_research": {
      "sku": "tasful_ai_deep_research",
      "domain": "tasful_ai",
      "label": "Deep Research（未確定）",
      "description": "Deep Research 機能 — 価格・上限は設計中（課金導線なし）",
      "billingType": "placeholder",
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "limits": {
        "daily": {
          "deep_research_turn": null
        }
      },
      "features": [
        "deep_research",
        "future_addon"
      ]
    },
    "tasful_ai_video_generate": {
      "sku": "tasful_ai_video_generate",
      "domain": "tasful_ai",
      "label": "Video Generate（未確定）",
      "description": "動画生成クォータ — 価格・上限は設計中（課金導線なし）",
      "billingType": "placeholder",
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "limits": {
        "daily": {
          "video_minute": null
        }
      },
      "features": [
        "video_generate",
        "future_addon"
      ]
    },
    "tasful_ai_realtime_voice": {
      "sku": "tasful_ai_realtime_voice",
      "domain": "tasful_ai",
      "label": "Realtime Voice（未確定）",
      "description": "リアルタイム音声 — 価格・上限は設計中（課金導線なし）",
      "billingType": "placeholder",
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "limits": {
        "daily": {
          "realtime_voice_minute": null
        }
      },
      "features": [
        "realtime_voice",
        "future_addon"
      ]
    },
    "tasful_ai_ultra": {
      "sku": "tasful_ai_ultra",
      "domain": "tasful_ai",
      "label": "TASFUL AI Ultra（未確定）",
      "description": "上位プラン候補 — Stripe SKU 未実装（課金導線なし）",
      "billingType": "placeholder",
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "limits": {
        "daily": {
          "text_turn": null,
          "voice_turn": null,
          "image_turn": null,
          "deep_research_turn": null,
          "video_minute": null,
          "realtime_voice_minute": null
        }
      },
      "features": [
        "multi_model",
        "fair_use_extended",
        "future_tier"
      ]
    },
    "tasful_ai_enterprise": {
      "sku": "tasful_ai_enterprise",
      "domain": "tasful_ai",
      "label": "TASFUL AI Enterprise（未確定）",
      "description": "法人向けプラン候補 — 価格・契約は設計中（課金導線なし）",
      "billingType": "placeholder",
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "limits": {
        "monthly": {
          "seat_policy": "contact_sales"
        }
      },
      "features": [
        "enterprise",
        "sso_candidate",
        "future_tier"
      ]
    },
    "tasful_ai_api_credit": {
      "sku": "tasful_ai_api_credit",
      "domain": "tasful_ai",
      "label": "API Credit（未確定）",
      "description": "API 従量クレジット — 単価・パックは設計中（課金導線なし）",
      "billingType": "usage",
      "currency": "JPY",
      "provisional": true,
      "enabled": false,
      "status": "draft",
      "limits": {
        "monthly": {
          "api_credit_units": null
        }
      },
      "features": [
        "api_credit",
        "usage_metered",
        "future_addon"
      ]
    },
    "builder_contact_reveal": {
      "sku": "builder_contact_reveal",
      "domain": "builder",
      "label": "連絡先開示料",
      "description": "Builder worker/vendor 検索 — Contact Reveal 都度課金（1件）",
      "billingType": "fixed",
      "amount": 550,
      "currency": "JPY",
      "provisional": true,
      "enabled": true,
      "status": "active",
      "features": [
        "contact_reveal",
        "per_reveal"
      ]
    }
  }
} as PricingCatalog;

const SKU_MAP: Record<string, PricingSku> = TASFUL_PRICING_CATALOG.skus;

export function getPricingSku(skuId: string): PricingSku | null {
  const id = String(skuId || "").trim();
  if (!id) return null;
  return SKU_MAP[id] ?? null;
}

export function isPricingProvisional(skuId: string): boolean {
  return getPricingSku(skuId)?.provisional === true;
}

export function isPricingEnabled(skuId: string): boolean {
  return getPricingSku(skuId)?.enabled === true;
}

export function calcPricingPercentFee(skuId: string, gmvYen: number): number | null {
  const row = getPricingSku(skuId);
  if (!row || row.billingType !== "percent") return null;
  const gmv = Math.max(0, Number(gmvYen) || 0);
  const pct = Number(row.percent) || 0;
  const min = Math.max(0, Number(row.minimumAmount) || 0);
  const raw = Math.floor(gmv * (pct / 100));
  return Math.max(min, raw);
}

export function getPricingFixedAmount(skuId: string): number | null {
  const row = getPricingSku(skuId);
  if (!row) return null;
  if (row.billingType === "fixed" || row.billingType === "subscription") {
    return Number(row.amount);
  }
  return null;
}

export function resolveStripePriceEnvKey(skuId: string): string {
  return String(getPricingSku(skuId)?.stripePriceEnvKey || "").trim();
}

export function formatPricingYen(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return "¥" + n.toLocaleString("ja-JP");
}
