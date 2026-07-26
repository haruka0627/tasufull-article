/**
 * TASFUL Page Gen — action wiring (Phase 1 common engine)
 *
 * Declarative only. Booking / payment / inquiry are described here and
 * executed by the existing surface systems (Talk, Stripe, contact reveal).
 * This module never performs a transaction and never invents amounts.
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  function R() {
    return global.TasuPageGenRegistry;
  }

  const SLOT = Object.freeze({
    PRIMARY: "primary",
    SECONDARY: "secondary",
    BOOKING: "booking",
    PAYMENT: "payment",
    INQUIRY: "inquiry",
  });

  const kinds = new Map();

  /**
   * @param {object} def
   *   id, label, slots[] (which action slots may hold it), requires[] (config keys),
   *   tasfulFlow (existing TASFUL flow id), allowGenerated
   */
  function registerActionKind(def) {
    const id = String(def?.id || "").trim();
    if (!id) throw new Error("action kind id required");
    const entry = {
      id,
      label: String(def.label || id),
      slots: Array.isArray(def.slots) ? def.slots.slice() : [SLOT.PRIMARY, SLOT.SECONDARY],
      requires: Array.isArray(def.requires) ? def.requires.slice() : [],
      externalSystem: String(def.externalSystem || ""),
      tasfulFlow: String(def.tasfulFlow || ""),
      allowGenerated: def.allowGenerated === true,
    };
    kinds.set(id, entry);
    return entry;
  }

  function getActionKind(id) {
    return kinds.get(String(id || "")) || null;
  }

  function listActionKinds() {
    return Array.from(kinds.values());
  }

  function normalizeAction(raw) {
    if (!raw) return null;
    const kindId = typeof raw === "string" ? raw : String(raw.kind || "");
    const def = getActionKind(kindId);
    if (!def) return null;
    return {
      kind: def.id,
      label: S().trimText(typeof raw === "string" ? "" : raw.label, 40) || def.label,
      config: S().isPlainObject(raw?.config) ? { ...raw.config } : {},
      tasfulFlow: def.tasfulFlow,
    };
  }

  /** Fills unset action slots from the page_kind defaults. */
  function buildActions(doc, overrides) {
    const kind = R().getPageKind(doc?.page_kind);
    const defaults = kind?.actions || {};
    const current = doc?.actions || {};
    const merged = {};
    Object.values(SLOT).forEach((slot) => {
      const chosen =
        (overrides && overrides[slot]) ||
        (current[slot] && current[slot].kind ? current[slot] : null) ||
        defaults[slot] ||
        null;
      merged[slot] = normalizeAction(chosen);
    });
    return merged;
  }

  function applyActions(doc, overrides) {
    doc.actions = buildActions(doc, overrides);
    return doc.actions;
  }

  function resolveActionForBlock(doc, requestedKind) {
    const actions = doc?.actions || {};
    if (requestedKind) {
      const found = Object.values(actions).find((a) => a && a.kind === String(requestedKind));
      if (found) return found;
      return normalizeAction(requestedKind);
    }
    return actions.primary || null;
  }

  /** Checks surface permission and required configuration keys. */
  function validateActions(doc) {
    const errors = [];
    const warnings = [];
    const actions = doc?.actions || {};
    Object.keys(actions).forEach((slot) => {
      const action = actions[slot];
      if (!action) return;
      const def = getActionKind(action.kind);
      if (!def) {
        errors.push({ code: "unknown_action", message: `未登録のアクション: ${action.kind}`, path: `actions.${slot}` });
        return;
      }
      if (!def.allowGenerated || !def.tasfulFlow) {
        errors.push({
          code: "external_action_forbidden",
          message: `${action.kind} はAI生成ページのCTAに使用できません`,
          path: `actions.${slot}`,
        });
      }
      if (!def.slots.includes(slot)) {
        errors.push({
          code: "action_slot_mismatch",
          message: `${action.kind} は ${slot} に設定できません`,
          path: `actions.${slot}`,
        });
      }
      if (doc.surface && !R().isActionAllowedOnSurface(action.kind, doc.surface)) {
        errors.push({
          code: "action_not_allowed",
          message: `${doc.surface} では ${action.kind} を利用できません`,
          path: `actions.${slot}`,
        });
      }
      def.requires.forEach((key) => {
        const value = action.config?.[key];
        if (value === undefined || value === null || String(value).trim() === "") {
          warnings.push({
            code: "action_config_missing",
            message: `${action.kind} の設定 ${key} が未入力です`,
            path: `actions.${slot}.config.${key}`,
          });
        }
      });
    });
    return { ok: errors.length === 0, errors, warnings };
  }

  // --- built-in action kinds ---------------------------------------------
  registerActionKind({
    id: "talk_start",
    label: "相談する",
    slots: [SLOT.PRIMARY, SLOT.SECONDARY, SLOT.INQUIRY],
    tasfulFlow: "tasful_talk",
    allowGenerated: true,
  });

  registerActionKind({
    id: "contact_reveal",
    label: "連絡先を見る",
    slots: [SLOT.PRIMARY, SLOT.SECONDARY],
    tasfulFlow: "builder_contact_reveal",
    allowGenerated: true,
  });

  registerActionKind({
    id: "phone",
    label: "電話する",
    slots: [SLOT.PRIMARY, SLOT.SECONDARY],
    requires: ["phone"],
    externalSystem: "tel",
    allowGenerated: false,
  });

  registerActionKind({
    id: "external_site",
    label: "公式サイトを見る",
    slots: [SLOT.PRIMARY, SLOT.SECONDARY],
    requires: ["url"],
    externalSystem: "external",
    allowGenerated: false,
  });

  registerActionKind({
    id: "inquiry_form",
    label: "お問い合わせ",
    slots: [SLOT.PRIMARY, SLOT.SECONDARY, SLOT.INQUIRY],
    tasfulFlow: "tasful_inquiry",
    allowGenerated: true,
  });

  registerActionKind({
    id: "booking_request",
    label: "予約を申し込む",
    slots: [SLOT.BOOKING, SLOT.PRIMARY],
    requires: ["booking_mode"],
    tasfulFlow: "tasful_booking",
    allowGenerated: true,
  });

  registerActionKind({
    id: "checkout",
    label: "購入手続きへ",
    slots: [SLOT.PAYMENT, SLOT.PRIMARY],
    requires: ["price_id"],
    externalSystem: "stripe",
    allowGenerated: false,
  });

  registerActionKind({
    id: "tasful_purchase",
    label: "購入する",
    slots: [SLOT.PAYMENT, SLOT.PRIMARY],
    requires: ["route_ref"],
    tasfulFlow: "tasful_marketplace_checkout",
    allowGenerated: true,
  });

  registerActionKind({
    id: "tasful_booking",
    label: "予約する",
    slots: [SLOT.BOOKING, SLOT.PRIMARY],
    requires: ["route_ref"],
    tasfulFlow: "tasful_booking",
    allowGenerated: true,
  });

  registerActionKind({
    id: "tasful_request",
    label: "依頼する",
    slots: [SLOT.PRIMARY, SLOT.INQUIRY],
    requires: ["route_ref"],
    tasfulFlow: "tasful_request",
    allowGenerated: true,
  });

  registerActionKind({
    id: "tasful_apply",
    label: "応募する",
    slots: [SLOT.PRIMARY],
    requires: ["route_ref"],
    tasfulFlow: "tasful_job_apply",
    allowGenerated: true,
  });

  registerActionKind({
    id: "tasful_join",
    label: "参加する",
    slots: [SLOT.PRIMARY],
    requires: ["route_ref"],
    tasfulFlow: "tasful_event_join",
    allowGenerated: true,
  });

  global.TasuPageGenActions = {
    SLOT,
    registerActionKind,
    getActionKind,
    listActionKinds,
    normalizeAction,
    buildActions,
    applyActions,
    resolveActionForBlock,
    validateActions,
  };
})(typeof window !== "undefined" ? window : globalThis);
