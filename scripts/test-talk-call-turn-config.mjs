#!/usr/bin/env node
/**
 * TASFUL TALK Phase5 / 5.6 — ICE / TURN 設定レイヤー単体テスト
 *
 *   node scripts/test-talk-call-turn-config.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICE_SRC = readFileSync(join(__dirname, "talk-call-ice-config.js"), "utf8");

/** @type {string[]} */
const errors = [];

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.error(`  NG  ${msg}`);
}

function assert(cond, msg) {
  if (cond) pass(msg);
  else fail(msg);
}

/**
 * @param {Record<string, unknown>} [opts]
 */
function loadIceConfig(opts = {}) {
  const env = { NODE_ENV: "test", ...(opts.env || {}) };
  const sandbox = {
    console: {
      log: (...args) => capturedLogs.push(["log", args]),
      warn: (...args) => capturedLogs.push(["warn", args]),
      debug: (...args) => capturedLogs.push(["debug", args]),
      error: (...args) => capturedLogs.push(["error", args]),
    },
    process: { env },
    globalThis: {},
    window: {},
    location: { search: opts.search || "" },
    localStorage: {
      _data: { ...(opts.localStorage || {}) },
      getItem(k) {
        return this._data[k] ?? null;
      },
      setItem(k, v) {
        this._data[k] = String(v);
      },
    },
  };
  sandbox.window = sandbox.globalThis;
  sandbox.globalThis.location = sandbox.location;
  sandbox.globalThis.localStorage = sandbox.localStorage;
  if (opts.talkCallConfig) {
    sandbox.globalThis.TASU_TALK_CALL_CONFIG = opts.talkCallConfig;
  }
  if (opts.webRtcDiagnostics) {
    sandbox.globalThis.TasuTalkCallWebRtc = {
      getConnectionDiagnostics: () => opts.webRtcDiagnostics,
    };
  }
  /** @type {Array<[string, unknown[]]>} */
  const capturedLogs = [];
  vm.createContext(sandbox);
  vm.runInContext(ICE_SRC, sandbox);
  return {
    Ice: sandbox.globalThis.TasuTalkCallIceConfig,
    logs: capturedLogs,
  };
}

function stunOnly(servers) {
  return (
    servers.length === 1 &&
    servers[0].urls === "stun:stun.l.google.com:19302" &&
    !servers[0].username &&
    !servers[0].credential
  );
}

function main() {
  console.log("TASFUL TALK Phase5/5.6 — ICE / TURN config\n");

  // 1. TURN 未設定 → STUN のみ
  {
    const { Ice } = loadIceConfig({ env: { NODE_ENV: "test" } });
    const servers = Ice.getTalkCallIceServers();
    assert(stunOnly(servers), "TURN unset: STUN-only iceServers");
    const pcCfg = Ice.buildTalkCallPeerConnectionConfig();
    assert(
      Array.isArray(pcCfg.iceServers) && stunOnly(pcCfg.iceServers),
      "TURN unset: buildTalkCallPeerConnectionConfig returns STUN-only"
    );
  }

  // 2. TURN 設定 → STUN + TURN
  {
    const secret = "phase5-test-secret-do-not-log";
    const { Ice } = loadIceConfig({
      env: {
        NODE_ENV: "test",
        TASFUL_TURN_URL: "turn:turn.example.com:3478",
        TASFUL_TURN_USERNAME: "testuser",
        TASFUL_TURN_CREDENTIAL: secret,
      },
    });
    const servers = Ice.getTalkCallIceServers();
    assert(servers.length === 2, "TURN set: two iceServers (STUN + TURN)");
    assert(servers[0].urls === "stun:stun.l.google.com:19302", "TURN set: first server is STUN");
    assert(servers[1].urls === "turn:turn.example.com:3478", "TURN set: second server is TURN URL");
    assert(servers[1].username === "testuser", "TURN set: username attached");
    assert(servers[1].credential === secret, "TURN set: credential attached in config object");
  }

  // 3. 複数 TURN URL
  {
    const { Ice } = loadIceConfig({
      env: {
        NODE_ENV: "test",
        TASFUL_TURN_URL: "turn:turn.example.com:3478, turns:turn.example.com:5349",
        TASFUL_TURN_USERNAME: "u",
        TASFUL_TURN_CREDENTIAL: "p",
      },
    });
    const servers = Ice.getTalkCallIceServers();
    assert(servers.length === 3, "Multi URL: STUN + 2 TURN entries");
    assert(servers[1].urls === "turn:turn.example.com:3478", "Multi URL: first TURN normalized");
    assert(servers[2].urls === "turns:turn.example.com:5349", "Multi URL: second TURN normalized");
  }

  // 4. 配列形式 TURN URL
  {
    const { Ice } = loadIceConfig({
      talkCallConfig: {
        turnUrl: ["turn:a.example.com:3478", "turns:b.example.com:5349"],
        turnUsername: "u",
        turnCredential: "p",
      },
    });
    const servers = Ice.getTalkCallIceServers();
    assert(servers.length === 3, "Array URL: STUN + 2 TURN");
  }

  // 5. username / credential 不足 → TURN 無効化 + warning
  {
    const { Ice, logs } = loadIceConfig({
      env: { NODE_ENV: "test", TASFUL_TURN_URL: "turn:turn.example.com:3478" },
    });
    const servers = Ice.getTalkCallIceServers();
    assert(stunOnly(servers), "Missing creds: TURN disabled, STUN only");
    const warned = logs.some(([level, args]) => level === "warn" && String(args[0]).includes("TURN"));
    assert(warned, "Missing creds: console.warn emitted");
  }

  // 6. VITE_ プレフィックス env
  {
    const { Ice } = loadIceConfig({
      env: {
        NODE_ENV: "test",
        VITE_TASFUL_TURN_URL: "turn:vite.example.com:3478",
        VITE_TASFUL_TURN_USERNAME: "vu",
        VITE_TASFUL_TURN_CREDENTIAL: "vc",
      },
    });
    const servers = Ice.getTalkCallIceServers();
    assert(servers.some((s) => s.urls === "turn:vite.example.com:3478"), "VITE_ env vars accepted");
  }

  // 7. credential がログに出ない
  {
    const secret = "super-secret-credential-xyz-12345";
    const { Ice, logs } = loadIceConfig({
      env: {
        NODE_ENV: "test",
        TASFUL_TURN_URL: "turn:turn.example.com:3478",
        TASFUL_TURN_USERNAME: "loguser",
        TASFUL_TURN_CREDENTIAL: secret,
      },
      talkCallConfig: { debug: true },
      search: "?talkCallDebug=1",
    });
    Ice.logIceDebug("test-event", { credential: secret, turnCredential: secret, username: "loguser" });
    const summary = Ice.getConfigSummary();
    const iceCfg = Ice.getIceConfig();
    const logText = JSON.stringify(logs) + JSON.stringify(summary) + JSON.stringify(iceCfg);
    assert(!logText.includes(secret), "Credential never appears in debug logs or summary");
    assert(summary.turnEnabled === true, "getConfigSummary: turnEnabled without leaking credential");
    assert(!("credential" in summary), "getConfigSummary: no credential field");
    assert(iceCfg?.hasCredential === true && !("credential" in iceCfg), "getIceConfig: flag only, no credential value");
  }

  // 8. normalizeTurnUrl — scheme 省略時 turn: 付与
  {
    const { Ice } = loadIceConfig({});
    assert(Ice._test.normalizeTurnUrl("turn.example.com:3478") === "turn:turn.example.com:3478", "normalizeTurnUrl adds turn:");
  }

  // 9. debug off by default
  {
    const { Ice } = loadIceConfig({});
    assert(Ice.isTalkCallDebugEnabled() === false, "Debug disabled by default");
  }

  // 10. debug via query / localStorage
  {
    const q = loadIceConfig({ search: "?talkCallDebug=1" });
    assert(q.Ice.isTalkCallDebugEnabled() === true, "Debug enabled via talkCallDebug=1 query");
    const ls = loadIceConfig({ localStorage: { tasu_talk_call_debug: "1" } });
    assert(ls.Ice.isTalkCallDebugEnabled() === true, "Debug enabled via localStorage key");
  }

  // 11. Phase5.6 — _test hidden in production browser
  {
    const prod = loadIceConfig({ env: { NODE_ENV: "production" }, search: "" });
    assert(prod.Ice._test === undefined, "_test hidden when not dev/test");
    assert(prod.Ice.getIceConfig === undefined, "getIceConfig hidden when not dev/test");
  }

  // 12. Phase5.6 — _test available with talkDev=1
  {
    const dev = loadIceConfig({ env: { NODE_ENV: "production" }, search: "?talkDev=1" });
    assert(typeof dev.Ice._test?.resolveTurnSettings === "function", "_test available with talkDev=1");
    assert(typeof dev.Ice.getIceConfig === "function", "getIceConfig available with talkDev=1");
  }

  // 13. Phase5.6 — allowDebug:false blocks debug
  {
    const locked = loadIceConfig({
      talkCallConfig: { allowDebug: false, debug: true },
      search: "?talkCallDebug=1",
      localStorage: { tasu_talk_call_debug: "1" },
    });
    assert(locked.Ice.isTalkCallDebugEnabled() === false, "allowDebug:false disables debug");
    assert(locked.Ice.getConfigSummary().allowDebug === false, "getConfigSummary reports allowDebug:false");
  }

  // 14. Phase5.6 — getTalkCallConnectionSummary debug-only
  {
    const off = loadIceConfig({
      webRtcDiagnostics: { hasRelay: true, candidateCounts: { relay: 1 } },
    });
    assert(off.Ice.getTalkCallConnectionSummary() === null, "connection summary null when debug off");

    const on = loadIceConfig({
      search: "?talkCallDebug=1",
      webRtcDiagnostics: {
        candidateCounts: { host: 1, srflx: 1, relay: 1, prflx: 0, unknown: 0 },
        typesSeen: ["host", "srflx", "relay"],
        hasHost: true,
        hasSrflx: true,
        hasRelay: true,
        connectionState: "connected",
        iceConnectionState: "connected",
        iceGatheringState: "complete",
      },
    });
    const conn = on.Ice.getTalkCallConnectionSummary();
    assert(conn?.hasRelay === true, "connection summary hasRelay in debug mode");
    assert(conn?.hasSrflx === true, "connection summary hasSrflx in debug mode");
    assert(conn?.hasHost === true, "connection summary hasHost in debug mode");
    assert(!("credential" in (conn || {})), "connection summary has no credential");
  }

  console.log("");
  if (errors.length) {
    console.error(`FAILED (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log("ALL PASS — talk-call-turn-config");
}

main();
