/**
 * TASFUL Page Gen — interview state machine (Phase 1 common engine)
 *
 * Deterministic slot filling. The model is never required to drive the
 * conversation: it only extracts values (optional) and writes copy later.
 * Asks "must" slots first, then a single optional "should" batch.
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  function Slots() {
    return global.TasuPageGenSlots;
  }

  function Prov() {
    return global.TasuPageGenProvenance;
  }

  const MAX_QUESTIONS_PER_TURN = 3;

  const PHASE = Object.freeze({
    MUST: "must",
    SHOULD: "should",
    READY: "ready",
  });

  /**
   * @param {object} input { surface, page_kind, vertical, doc, prefill }
   */
  function createSession(input) {
    const schema = S();
    const doc = schema.createPageDoc({
      surface: input?.surface,
      page_kind: input?.page_kind,
      vertical: input?.vertical,
      service_type: input?.service_type,
      category: input?.category,
      entity: input?.entity,
      ...(schema.isPlainObject(input?.doc) ? input.doc : {}),
    });

    const session = {
      id: schema.makeId("ivw"),
      surface: doc.surface,
      page_kind: doc.page_kind,
      doc,
      asked: [],
      skipped: [],
      shouldBatchOffered: false,
      turn: 0,
      created_at: schema.nowIso(),
    };

    if (schema.isPlainObject(input?.prefill)) {
      applyAnswers(session, input.prefill, { source: schema.SOURCE.IMPORT });
    }
    return session;
  }

  function pendingMust(session) {
    return Slots().missingSlots(session.doc, session.page_kind, Slots().IMPORTANCE.MUST);
  }

  function pendingShould(session) {
    return Slots()
      .missingSlots(session.doc, session.page_kind, Slots().IMPORTANCE.SHOULD)
      .filter((slot) => !session.skipped.includes(slot.id));
  }

  function phase(session) {
    if (pendingMust(session).length) return PHASE.MUST;
    if (!session.shouldBatchOffered && pendingShould(session).length) return PHASE.SHOULD;
    return PHASE.READY;
  }

  function toPrompt(slot) {
    return {
      slotId: slot.id,
      label: slot.label,
      question: slot.question,
      type: slot.type,
      example: slot.example,
      options: slot.options,
      required: slot.importance === Slots().IMPORTANCE.MUST,
    };
  }

  function progress(session) {
    const all = Slots().listSlots(session.page_kind);
    const must = all.filter((s) => s.importance === Slots().IMPORTANCE.MUST);
    const filledMust = must.filter((s) => Slots().isFilled(session.doc, s)).length;
    return {
      mustTotal: must.length,
      mustFilled: filledMust,
      ratio: Slots().filledRatio(session.doc, session.page_kind),
    };
  }

  /** Returns the next question batch, or done=true when generation may start. */
  function next(session) {
    const current = phase(session);
    if (current === PHASE.READY) {
      return { done: true, phase: current, question: null, progress: progress(session) };
    }
    const pending = current === PHASE.MUST ? pendingMust(session) : pendingShould(session);
    const batch = pending.slice(0, MAX_QUESTIONS_PER_TURN);
    return {
      done: false,
      phase: current,
      question: {
        id: `${session.id}_q${session.turn + 1}`,
        phase: current,
        optional: current === PHASE.SHOULD,
        slotIds: batch.map((s) => s.id),
        prompts: batch.map(toPrompt),
      },
      progress: progress(session),
    };
  }

  /**
   * @param {object} session
   * @param {object} answers { slotId: value }
   * @param {{ source?: string }} [options]
   */
  function applyAnswers(session, answers, options) {
    const schema = S();
    const source = options?.source || schema.SOURCE.USER;
    const applied = [];
    const rejected = [];

    Object.keys(answers || {}).forEach((slotId) => {
      const slot = Slots().getSlot(slotId);
      if (!slot) {
        rejected.push({ slotId, reason: "unknown_slot" });
        return;
      }
      const value = answers[slotId];
      const isEmpty = Array.isArray(value)
        ? value.length === 0
        : String(value ?? "").trim() === "";
      if (isEmpty) {
        rejected.push({ slotId, reason: "empty" });
        return;
      }
      Slots().applySlotValue(session.doc, slotId, value);
      if (source === schema.SOURCE.USER) Prov().markUser(session.doc, slot.path);
      else Prov().mark(session.doc, slot.path, { source, locked: false });
      applied.push(slotId);
      if (!session.asked.includes(slotId)) session.asked.push(slotId);
    });

    session.turn += 1;
    schema.touch(session.doc);
    return { applied, rejected, next: next(session) };
  }

  function skip(session, slotIds) {
    const ids = Array.isArray(slotIds) ? slotIds : [slotIds];
    ids.map(String).forEach((id) => {
      if (!session.skipped.includes(id)) session.skipped.push(id);
    });
    if (!pendingShould(session).length) session.shouldBatchOffered = true;
    return next(session);
  }

  /** Marks the optional batch as offered so the interview can finish. */
  function skipOptional(session) {
    session.shouldBatchOffered = true;
    return next(session);
  }

  function canGenerate(session) {
    return pendingMust(session).length === 0;
  }

  function reset(session) {
    session.asked = [];
    session.skipped = [];
    session.shouldBatchOffered = false;
    session.turn = 0;
    return session;
  }

  global.TasuPageGenInterview = {
    PHASE,
    MAX_QUESTIONS_PER_TURN,
    createSession,
    next,
    applyAnswers,
    skip,
    skipOptional,
    canGenerate,
    phase,
    progress,
    pendingMust,
    pendingShould,
    reset,
  };
})(typeof window !== "undefined" ? window : globalThis);
