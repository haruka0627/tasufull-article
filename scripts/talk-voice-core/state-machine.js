/**
 * TASFUL talk-voice-core — call UI / orchestration state machine (pure)
 *
 * DB session status (ringing/active/ended/…) stays in signaling.
 * This machine tracks client orchestration states for fail-closed transitions.
 */
(function (global) {
  "use strict";

  const STATES = Object.freeze({
    IDLE: "idle",
    AUTHORIZING: "authorizing",
    RINGING_OUTGOING: "ringing_outgoing",
    RINGING_INCOMING: "ringing_incoming",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    RECONNECTING: "reconnecting",
    ENDING: "ending",
    ENDED: "ended",
    FAILED: "failed",
  });

  /** @type {Record<string, Set<string>>} */
  const ALLOWED = Object.freeze({
    [STATES.IDLE]: new Set([STATES.AUTHORIZING, STATES.RINGING_INCOMING]),
    [STATES.AUTHORIZING]: new Set([
      STATES.RINGING_OUTGOING,
      STATES.FAILED,
      STATES.ENDED,
      STATES.IDLE,
    ]),
    [STATES.RINGING_OUTGOING]: new Set([
      STATES.CONNECTING,
      STATES.ENDING,
      STATES.ENDED,
      STATES.FAILED,
    ]),
    [STATES.RINGING_INCOMING]: new Set([
      STATES.CONNECTING,
      STATES.ENDING,
      STATES.ENDED,
      STATES.FAILED,
    ]),
    [STATES.CONNECTING]: new Set([
      STATES.CONNECTED,
      STATES.RECONNECTING,
      STATES.ENDING,
      STATES.ENDED,
      STATES.FAILED,
    ]),
    [STATES.CONNECTED]: new Set([
      STATES.RECONNECTING,
      STATES.ENDING,
      STATES.ENDED,
      STATES.FAILED,
    ]),
    [STATES.RECONNECTING]: new Set([
      STATES.CONNECTED,
      STATES.ENDING,
      STATES.ENDED,
      STATES.FAILED,
    ]),
    [STATES.ENDING]: new Set([STATES.ENDED, STATES.FAILED]),
    [STATES.ENDED]: new Set([STATES.IDLE]),
    [STATES.FAILED]: new Set([STATES.IDLE]),
  });

  function canTransition(from, to) {
    const f = String(from || STATES.IDLE);
    const t = String(to || "");
    if (f === t) return true;
    return Boolean(ALLOWED[f]?.has(t));
  }

  function transition(from, to) {
    if (!canTransition(from, to)) {
      return {
        ok: false,
        from,
        to,
        state: from,
        error: "invalid_transition",
      };
    }
    return { ok: true, from, to, state: to, error: null };
  }

  function createMachine(initial) {
    let state = String(initial || STATES.IDLE);
    return {
      getState: () => state,
      can: (to) => canTransition(state, to),
      go(to) {
        const result = transition(state, to);
        if (result.ok) state = result.state;
        return result;
      },
      reset() {
        state = STATES.IDLE;
        return state;
      },
    };
  }

  global.TasuTalkVoiceStateMachine = {
    STATES,
    ALLOWED,
    canTransition,
    transition,
    createMachine,
  };
})(typeof window !== "undefined" ? window : globalThis);
