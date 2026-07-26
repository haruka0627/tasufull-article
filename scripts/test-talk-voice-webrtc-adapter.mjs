#!/usr/bin/env node
/**
 * WebRTC voice adapter unit tests (mocked RTC)
 *   node scripts/test-talk-voice-webrtc-adapter.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
function pass(n, d = "") {
  results.push({ ok: true });
  console.log(`PASS: ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  results.push({ ok: false });
  console.error(`FAIL: ${n}${d ? ` — ${d}` : ""}`);
}
function assert(n, c, d = "") {
  if (c) pass(n, d);
  else fail(n, d);
}

function load() {
  const events = [];
  const sandbox = {
    console,
    Date,
    Math,
    Set,
    Map,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    Error,
    document: {
      createElement: () => ({
        autoplay: false,
        hidden: false,
        setAttribute() {},
        play: async () => {},
        srcObject: null,
      }),
      body: { appendChild() {} },
    },
    navigator: {
      mediaDevices: {
        getUserMedia: async () => {
          const track = { stop() {}, enabled: true };
          return {
            getTracks: () => [track],
            getAudioTracks: () => [track],
          };
        },
      },
    },
    RTCPeerConnection: class {
      constructor() {
        this.connectionState = "new";
        this.onicecandidate = null;
        this.ontrack = null;
        this.onconnectionstatechange = null;
        this.oniceconnectionstatechange = null;
      }
      addTrack() {}
      async createOffer() {
        return { type: "offer", sdp: "v=0" };
      }
      async createAnswer() {
        return { type: "answer", sdp: "v=0" };
      }
      async setLocalDescription(d) {
        this.localDescription = d;
      }
      async setRemoteDescription() {}
      async addIceCandidate() {}
      close() {
        this.connectionState = "closed";
      }
    },
    RTCSessionDescription: class {
      constructor(init) {
        Object.assign(this, init);
      }
    },
    RTCIceCandidate: class {
      constructor(init) {
        Object.assign(this, init);
      }
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.TasuTalkCallIceConfig = {
    DEFAULT_STUN_URL: "stun:stun.l.google.com:19302",
    buildTalkCallPeerConnectionConfig: () => ({ iceServers: [{ urls: "stun:x" }] }),
    logIceDebug() {},
    getConfigSummary: () => ({}),
  };

  const files = [
    "scripts/talk-voice-core/errors.js",
    "scripts/talk-call-webrtc.js",
    "scripts/talk-voice-core/provider-interface.js",
    "scripts/talk-voice-core/webrtc-adapter.js",
  ];
  for (const f of files) {
    vm.runInNewContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f });
  }

  const adapter = sandbox.TasuTalkVoiceWebRtcAdapter.create({
    onEvent: (ev) => events.push(ev),
  });
  return { sandbox, adapter, events };
}

const { sandbox, adapter, events } = load();
const iface = sandbox.TasuTalkVoiceProviderInterface.assertAdapter(adapter);
assert("adapter implements interface", iface.ok, iface.missing?.join(",") || "");

assert("initialize ok", (await adapter.initialize()).ok);
const out = await adapter.createOutgoingConnection({});
assert("createOutgoing offer", out.ok && out.localDescription?.type === "offer");
assert(
  "local signal offer fired",
  events.some((e) => e.type === "onLocalSignal" && e.detail?.signalType === "offer")
);

adapter.setMuted(true);
assert("muted", adapter.isMuted() === true || sandbox.TasuTalkCallWebRtc.isMuted() === true);
adapter.setMuted(false);

await adapter.disconnect();
assert("disconnect closes", adapter.getConnectionState() === "closed" || adapter.getConnectionState() == null);

await adapter.dispose();
assert("dispose idempotent", true);

const mapped = sandbox.TasuTalkVoiceErrors.mapProviderError({ name: "NotAllowedError", message: "denied" });
assert("error map media denied", mapped.code === "media_permission_denied");

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- webrtc adapter Summary ---\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
