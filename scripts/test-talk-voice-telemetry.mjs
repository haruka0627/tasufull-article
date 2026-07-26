import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sandbox = { console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(new URL("./talk-voice-core/telemetry.js", import.meta.url), "utf8"),
  sandbox,
);
const telemetry = sandbox.TasuTalkVoiceTelemetry;

assert.equal(
  telemetry.classifyRoute({ localCandidateType: "host", remoteCandidateType: "host", protocol: "udp" }),
  "p2p_host",
);
assert.equal(
  telemetry.classifyRoute({ localCandidateType: "srflx", remoteCandidateType: "host", protocol: "udp" }),
  "p2p_srflx",
);
assert.equal(
  telemetry.classifyRoute({ localCandidateType: "relay", remoteCandidateType: "host", protocol: "udp" }),
  "turn_udp",
);
assert.equal(
  telemetry.classifyRoute({ localCandidateType: "relay", remoteCandidateType: "host", protocol: "tcp" }),
  "turn_tcp",
);
assert.equal(
  telemetry.classifyRoute({
    localCandidateType: "relay",
    remoteCandidateType: "host",
    protocol: "tcp",
    url: "turns:turn.example:443?transport=tcp",
  }),
  "turn_tls",
);

const rows = [
  {
    id: "pair",
    type: "candidate-pair",
    selected: true,
    nominated: true,
    state: "succeeded",
    localCandidateId: "local",
    remoteCandidateId: "remote",
    currentRoundTripTime: 0.08,
    availableOutgoingBitrate: 32000,
  },
  {
    id: "local",
    type: "local-candidate",
    candidateType: "relay",
    protocol: "udp",
    relayProtocol: "udp",
    networkType: "wifi",
  },
  { id: "remote", type: "remote-candidate", candidateType: "srflx", protocol: "udp" },
  {
    id: "out",
    type: "outbound-rtp",
    kind: "audio",
    bytesSent: 5000,
    codecId: "codec",
  },
  {
    id: "in",
    type: "inbound-rtp",
    kind: "audio",
    bytesReceived: 7000,
    packetsLost: 2,
    jitter: 0.012,
    codecId: "codec",
  },
  { id: "codec", type: "codec", mimeType: "audio/opus" },
];
const stats = telemetry.normalizeStats(rows, 1000, 1500);
assert.equal(stats.route, "turn_udp");
assert.equal(stats.selectedCandidatePair, true);
assert.equal(stats.bytesSent, 5000);
assert.equal(stats.bytesReceived, 7000);
assert.equal(stats.codec, "audio/opus");
assert.equal(stats.connectTimeMs, 500);
assert.ok(!Object.hasOwn(stats, "address"), "IP addresses must not be normalized");

const cost = telemetry.aggregateCost(
  [
    { connected: true, route: "p2p_srflx", durationSeconds: 60, bytesSent: 100, bytesReceived: 200 },
    { connected: true, route: "turn_udp", durationSeconds: 120, bytesSent: 1_000_000, bytesReceived: 2_000_000 },
  ],
  {
    turnEgressCostPerGb: 10,
    turnServerMonthlyCost: 100,
    signalingMonthlyCost: 20,
    monitoringMonthlyCost: 5,
  },
);
assert.equal(cost.p2pSeconds, 60);
assert.equal(cost.turnSeconds, 120);
assert.equal(cost.turnBytes, 3_000_000);
assert.equal(cost.turnRate, 2 / 3);
assert.equal(cost.configuredMonthlyFixedCost, 125);
assert.equal(cost.measuredVariableCost, 0.03);

console.log("TALK Voice telemetry tests: PASS (route, stats, PII minimization, cost aggregation)");
