/**
 * TASFUL Page Gen — conversion outcome and internal CTA selection.
 *
 * AI may classify the desired outcome, but it never creates a URL. The
 * selected action always resolves to a registered TASFUL flow.
 */
(function (global) {
  "use strict";

  function R() {
    return global.TasuPageGenRegistry;
  }

  function A() {
    return global.TasuPageGenActions;
  }

  function P() {
    return global.TasuPageGenProvenance;
  }

  const OUTCOME = Object.freeze({
    PURCHASE: "purchase",
    BOOKING: "booking",
    REQUEST: "request",
    CONSULT: "consult",
    APPLY: "apply",
    JOIN: "join",
  });

  const OUTCOME_ACTION = Object.freeze({
    purchase: "tasful_purchase",
    booking: "tasful_booking",
    request: "tasful_request",
    consult: "talk_start",
    apply: "tasful_apply",
    join: "tasful_join",
  });

  const OUTCOME_LABEL = Object.freeze({
    purchase: "購入する",
    booking: "予約する",
    request: "依頼する",
    consult: "相談する",
    apply: "応募する",
    join: "参加する",
  });

  const VERTICAL_OUTCOME = Object.freeze({
    ec: OUTCOME.PURCHASE,
    marketplace: OUTCOME.PURCHASE,
    retail: OUTCOME.PURCHASE,
    travel: OUTCOME.BOOKING,
    local_service: OUTCOME.BOOKING,
    construction: OUTCOME.REQUEST,
    jobs: OUTCOME.APPLY,
    events: OUTCOME.JOIN,
    used_goods: OUTCOME.PURCHASE,
    real_estate: OUTCOME.CONSULT,
  });

  function normalizeOutcome(value) {
    return Object.values(OUTCOME).includes(value) ? value : "";
  }

  function inferOutcome(doc, suggested) {
    const accepted = normalizeOutcome(suggested);
    if (accepted) return accepted;
    const kind = R().getPageKind(doc?.page_kind);
    if (kind?.outcome) return normalizeOutcome(kind.outcome) || OUTCOME.CONSULT;
    return VERTICAL_OUTCOME[doc?.vertical] || OUTCOME.CONSULT;
  }

  function buildConversion(doc, suggested) {
    const outcome = inferOutcome(doc, suggested?.outcome);
    const actionKind = OUTCOME_ACTION[outcome];
    const actionDef = A().getActionKind(actionKind);
    const action = A().normalizeAction({
      kind: actionKind,
      label: OUTCOME_LABEL[outcome],
      config: {
        route_ref: actionDef?.tasfulFlow || "",
      },
    });
    return {
      outcome,
      rationale: String(suggested?.rationale || "").slice(0, 240),
      primary_action: actionKind,
      label: OUTCOME_LABEL[outcome],
      tasful_flow: action?.tasfulFlow || "",
    };
  }

  function apply(doc, suggested) {
    const conversion = buildConversion(doc, suggested);
    const preserveActionLabel = !P().canAiWrite(doc, "actions.primary.label");
    const currentActionLabel = doc.actions?.primary?.label || "";
    doc.conversion = conversion;
    const current = doc.actions || {};
    doc.actions = A().buildActions(doc, {
      ...current,
      primary: {
        kind: conversion.primary_action,
        label: preserveActionLabel ? currentActionLabel : conversion.label,
        config: { route_ref: conversion.tasful_flow },
      },
    });
    const cta = (doc.blocks || []).find((block) => block.type === "cta");
    if (cta) {
      const index = doc.blocks.indexOf(cta);
      const labelPath = `blocks.${index}.props.label`;
      const preserveBlockLabel = !P().canAiWrite(doc, labelPath);
      cta.props = {
        ...(cta.props || {}),
        label: preserveBlockLabel ? cta.props?.label || conversion.label : conversion.label,
        // Action kind is system-owned so user text edits cannot create an
        // external conversion route.
        action: conversion.primary_action,
      };
    }
    return conversion;
  }

  function isInternalAction(action) {
    const def = A().getActionKind(action?.kind);
    return Boolean(def?.allowGenerated && def?.tasfulFlow);
  }

  global.TasuPageGenConversion = {
    OUTCOME,
    OUTCOME_ACTION,
    OUTCOME_LABEL,
    inferOutcome,
    buildConversion,
    apply,
    isInternalAction,
  };
})(typeof window !== "undefined" ? window : globalThis);
