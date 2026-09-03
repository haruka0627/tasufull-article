#!/usr/bin/env node
/**
 * TLV User VRM blob URL lifecycle — unit regression (no Three/MediaPipe, no VRM download).
 */
import {
  createVrmBlobUrlOwner,
  createVrmReplacementGate,
  isBlobUrl,
} from "../one-tlv-vtuber-vrm-blob-lifecycle.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
let passed = 0;

function check(id, ok, detail) {
  if (ok) {
    passed += 1;
    console.log("PASS", id);
  } else {
    failed += 1;
    console.error("FAIL", id, detail || "");
  }
}

function mockOwner() {
  let seq = 0;
  const created = [];
  const revoked = [];
  const owner = createVrmBlobUrlOwner({
    createObjectURL(blob) {
      seq += 1;
      const url = "blob:mock-" + seq + (blob && blob.name ? "-" + blob.name : "");
      created.push(url);
      return url;
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  });
  return { owner, created, revoked };
}

// 1. new blob URL is NOT revoked before load resolves
{
  const { owner, revoked } = mockOwner();
  const url = owner.createFromBlob({ name: "a.vrm" });
  check("new_blob_not_revoked_before_commit", revoked.length === 0 && owner.getActive() === null, revoked);
  const snap = owner.snapshot();
  check("candidate_is_live_not_active", snap.liveCount === 1 && snap.activeUrl === null);
  owner.commitActive(url);
  check("commit_promotes_active", owner.getActive() === url);
  check("is_blob_url", isBlobUrl(url));
}

// 2. old URL revoked after successful replacement
{
  const { owner, revoked } = mockOwner();
  const a = owner.createFromBlob({ name: "a.vrm" });
  owner.commitActive(a);
  const b = owner.createFromBlob({ name: "b.vrm" });
  check("b_not_revoked_while_loading", !revoked.includes(b) && revoked.length === 0);
  owner.commitActive(b);
  check("old_url_revoked_after_success", revoked.includes(a) && owner.getActive() === b);
  check("old_not_double_revoked", revoked.filter((u) => u === a).length === 1);
}

// 3. failed new load revokes failed URL
{
  const { owner, revoked } = mockOwner();
  const a = owner.createFromBlob({ name: "a.vrm" });
  owner.commitActive(a);
  const b = owner.createFromBlob({ name: "b-bad.vrm" });
  owner.abandonCandidate(b);
  check("failed_candidate_revoked", revoked.includes(b));
  check("active_old_kept_on_fail", owner.getActive() === a && !revoked.includes(a));
}

// 4. active old VRM not destroyed on failed replacement (gate)
{
  const { owner } = mockOwner();
  const disposed = [];
  const gate = createVrmReplacementGate({
    blobOwner: owner,
    disposeInstance(inst) {
      disposed.push(inst);
    },
  });
  const oldInst = { id: "old" };
  const gen0 = gate.beginLoad();
  const ok0 = gate.commitSuccess({ gen: gen0, blobUrl: owner.createFromBlob({ name: "old.vrm" }), instance: oldInst });
  check("seed_old_ok", ok0.ok && gate.getCurrent() === oldInst);

  const genFail = gate.beginLoad();
  const failBlob = owner.createFromBlob({ name: "bad.vrm" });
  const failed = gate.failCandidate(genFail, failBlob, { id: "partial-new" }, { error: "UNSUPPORTED_VRM" });
  check("failed_replacement_ok_false", failed.ok === false);
  check("old_instance_still_current", gate.getCurrent() === oldInst);
  check("old_not_disposed", !disposed.includes(oldInst));
  check("partial_new_disposed", disposed.some((d) => d && d.id === "partial-new"));
}

// 5. cleanup revokes active URL once
{
  const { owner, revoked } = mockOwner();
  const disposed = [];
  const gate = createVrmReplacementGate({
    blobOwner: owner,
    disposeInstance(inst) {
      disposed.push(inst);
    },
  });
  const url = owner.createFromBlob({ name: "c.vrm" });
  const gen = gate.beginLoad();
  gate.commitSuccess({ gen, blobUrl: url, instance: { id: "c" } });
  gate.invalidateAndClear();
  gate.invalidateAndClear();
  check("cleanup_revokes_once", revoked.filter((u) => u === url).length === 1);
  check("cleanup_clears_current", gate.getCurrent() === null);
  check("cleanup_disposes_instance_once", disposed.filter((d) => d && d.id === "c").length === 1);
}

// 6. repeated switch does not leak URLs
{
  const { owner, created, revoked } = mockOwner();
  const disposed = [];
  const gate = createVrmReplacementGate({
    blobOwner: owner,
    disposeInstance(inst) {
      disposed.push(inst.id);
    },
  });
  for (let i = 0; i < 5; i++) {
    const url = owner.createFromBlob({ name: "sw-" + i + ".vrm" });
    const gen = gate.beginLoad();
    gate.commitSuccess({ gen, blobUrl: url, instance: { id: "sw-" + i } });
  }
  const snap = owner.snapshot();
  check("switch_one_live_url", snap.liveCount === 1);
  check("switch_revoked_previous_four", revoked.length === 4);
  check("switch_created_five", created.length === 5);
  check("switch_disposed_old_four", disposed.length === 4);
  gate.invalidateAndClear();
  check("switch_final_cleanup_no_live", owner.snapshot().liveCount === 0);
}

// Failed loadAsync analogue: no instance, abandon blob, keep current
{
  const { owner, revoked } = mockOwner();
  const disposed = [];
  const gate = createVrmReplacementGate({
    blobOwner: owner,
    disposeInstance(inst) {
      disposed.push(inst);
    },
  });
  const a = owner.createFromBlob({ name: "keep.vrm" });
  const g0 = gate.beginLoad();
  gate.commitSuccess({ gen: g0, blobUrl: a, instance: { id: "keep" } });
  const b = owner.createFromBlob({ name: "corrupt.vrm" });
  const g1 = gate.beginLoad();
  const r = gate.failCandidate(g1, b, null, { error: "VRM_LOAD_FAILURE" });
  check("corrupt_returns_failure", r.ok === false && r.error === "VRM_LOAD_FAILURE");
  check("corrupt_revokes_new_only", revoked.includes(b) && owner.getActive() === a);
  check("corrupt_keeps_old", gate.getCurrent().id === "keep" && disposed.length === 0);
}

// Supersede: first load finishes after second started
{
  const { owner, revoked } = mockOwner();
  const disposed = [];
  const gate = createVrmReplacementGate({
    blobOwner: owner,
    disposeInstance(inst) {
      disposed.push(inst.id);
    },
  });
  const first = owner.createFromBlob({ name: "first.vrm" });
  const genA = gate.beginLoad();
  const second = owner.createFromBlob({ name: "second.vrm" });
  const genB = gate.beginLoad();
  const lateA = gate.commitSuccess({ gen: genA, blobUrl: first, instance: { id: "first" } });
  check("superseded_first_not_committed", lateA.ok === false && lateA.superseded === true);
  check("superseded_first_revoked", revoked.includes(first));
  check("current_empty_until_b", gate.getCurrent() === null);
  const okB = gate.commitSuccess({ gen: genB, blobUrl: second, instance: { id: "second" } });
  check("second_wins", okB.ok && gate.getCurrent().id === "second");
}

// Runtime source contract
{
  const runtime = readFileSync(path.join(ROOT, "one-tlv-go-live-vtuber-basic.mjs"), "utf8");
  check("runtime_imports_blob_lifecycle", runtime.includes("one-tlv-vtuber-vrm-blob-lifecycle.mjs"));
  check("runtime_uses_beginLoad", runtime.includes("vrmGate.beginLoad"));
  check("runtime_uses_commitSuccess", runtime.includes("vrmGate.commitSuccess"));
  check("runtime_uses_failCandidate", runtime.includes("vrmGate.failCandidate"));
  check("runtime_file_createFromBlob", runtime.includes("blobUrls.createFromBlob"));
  const ensure = readFileSync(path.join(ROOT, "scripts/ensure-pages-dist.mjs"), "utf8");
  check("ensure_pages_dist_syncs_mjs", /ROOT_SYNC_EXT[\s\S]*"\.mjs"/.test(ensure));
  const loadFn = runtime.slice(runtime.indexOf("async function loadVrmFromUrl"));
  const beforeAwait = loadFn.slice(0, loadFn.indexOf("loader.loadAsync"));
  check("no_disposeVrm_before_loadAsync", !beforeAwait.includes("disposeVrm()"));
  const loadFile = runtime.slice(runtime.indexOf("async function loadVrmFile"));
  const loadFileBody = loadFile.slice(0, loadFn.indexOf("async function loadPresetVrm") > 0 ? 800 : 800);
  check(
    "loadVrmFile_no_pre_revoke_active",
    !/if \(state\.objectUrl\)[\s\S]{0,80}revokeObjectURL/.test(loadFileBody),
  );
}

console.log(JSON.stringify({ passed, failed, verdict: failed === 0 ? "PASS" : "FAIL" }));
if (failed) process.exitCode = 1;
