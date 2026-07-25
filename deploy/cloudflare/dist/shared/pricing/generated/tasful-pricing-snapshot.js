/**
 * AUTO-GENERATED — do not edit.
 * Source: shared/pricing/tasful-pricing-catalog.json (P1+P2 snapshot)
 * Generator: scripts/generate-pricing-config.mjs
 * Generated: 2026-07-05T01:52:12.427Z
 */
(function (global) {
  "use strict";
  global.TasuPricingSnapshot = {
    SOURCE: "shared/pricing/tasful-pricing-catalog.json",
    GENERATED_AT: "2026-07-05T01:52:12.427Z",
    skus: {
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
  }
},
  };
})(typeof window !== "undefined" ? window : globalThis);
