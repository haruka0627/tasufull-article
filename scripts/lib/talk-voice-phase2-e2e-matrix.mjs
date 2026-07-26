/**
 * Strict browser E2E matrix for TALK Voice Phase 2 Staging.
 * Plan-only module — does not open browsers or hit real TURN/network.
 *
 * Each case requires ≥2 independent BrowserContexts and real getStats()
 * evidence. Mock-only peer connections must not be marked PASS.
 */

/** @typedef {{
 *   id: string,
 *   title: string,
 *   iceTransportPolicy: 'all'|'relay',
 *   preferUrls: string[],
 *   expectRoute: string,
 *   expectCandidateType: 'host'|'srflx'|'relay',
 *   expectRelayProtocol: null|'udp'|'tcp'|'tls',
 *   forceTurnTransport?: 'udp'|'tcp'|'tls',
 * }} E2ERouteCase
 */

/** @type {E2ERouteCase[]} */
export const E2E_ROUTE_MATRIX = Object.freeze([
  {
    id: "direct_p2p",
    title: "Direct P2P (host or srflx)",
    iceTransportPolicy: "all",
    preferUrls: ["stun:"],
    expectRoute: "p2p_host|p2p_srflx",
    expectCandidateType: "host",
    expectRelayProtocol: null,
  },
  {
    id: "turn_udp",
    title: "Forced TURN UDP relay",
    iceTransportPolicy: "relay",
    preferUrls: ["turn:?transport=udp"],
    expectRoute: "turn_udp",
    expectCandidateType: "relay",
    expectRelayProtocol: "udp",
    forceTurnTransport: "udp",
  },
  {
    id: "turn_tcp",
    title: "Forced TURN TCP relay",
    iceTransportPolicy: "relay",
    preferUrls: ["turn:?transport=tcp"],
    expectRoute: "turn_tcp",
    expectCandidateType: "relay",
    expectRelayProtocol: "tcp",
    forceTurnTransport: "tcp",
  },
  {
    id: "turn_tls_443",
    title: "Forced TURN TLS 443 (turns)",
    iceTransportPolicy: "relay",
    preferUrls: ["turns:?transport=tcp"],
    expectRoute: "turn_tls",
    expectCandidateType: "relay",
    expectRelayProtocol: "tls",
    forceTurnTransport: "tls",
  },
]);

/** Assertions every case must collect from both contexts. */
export const E2E_ASSERTION_KEYS = Object.freeze([
  "selected_candidate_type_local",
  "selected_candidate_type_remote",
  "relay_protocol",
  "turn_server_host",
  "connection_route_class",
  "session_lifecycle_active_to_ended",
  "heartbeat_observed",
  "entitlement_checked",
  "telemetry_row_or_sink",
  "hangup_cleanup_ice_closed",
  "bidirectional_audio_tracks",
]);

export function describeE2EPlan() {
  return {
    contextsMinimum: 2,
    mockPassForbidden: true,
    routes: E2E_ROUTE_MATRIX,
    assertions: E2E_ASSERTION_KEYS,
    notes: [
      "Use Playwright Chromium with two independent BrowserContexts (separate cookies/storage).",
      "Authenticate both users against Staging Supabase only.",
      "Issue TURN credentials via /api/talk-voice-turn-credentials (JWT required).",
      "Filter iceServers to the transport under test before createOffer/createAnswer.",
      "PASS only when getStats() selected pair matches expectCandidateType + relay protocol.",
      "Do not PASS from mocked RTCPeerConnection or fixture-only host/host without product auth.",
    ],
  };
}
