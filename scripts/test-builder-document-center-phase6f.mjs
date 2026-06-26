#!/usr/bin/env node
/**
 * Builder Document Center Phase 6-F tests
 *   node scripts/test-builder-document-center-phase6f.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "builder");

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function assert(cond, label, detail) {
  if (cond) ok(label);
  else bad(label, detail);
}

const storage = {};

function loadStore() {
  const sandbox = {
    localStorage: {
      getItem(k) {
        return storage[k] ?? null;
      },
      setItem(k, v) {
        storage[k] = String(v);
      },
      removeItem(k) {
        delete storage[k];
      },
    },
    console,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8"),
    sandbox,
    { filename: "builder-project-store.js" }
  );
  return sandbox.TasuBuilderProjectStore;
}

const detailHtml = fs.readFileSync(path.join(builder, "project-detail.html"), "utf8");
const hubHtml = fs.readFileSync(path.join(builder, "project-hub.html"), "utf8");
const storeSrc = fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8");
const uiJs = fs.readFileSync(path.join(builder, "builder-ai-ui.js"), "utf8");
const hubJs = fs.readFileSync(path.join(builder, "builder-project-hub.js"), "utf8");

assert(storeSrc.includes("SCHEMA_VERSION = 7"), "SCHEMA v7");
assert(detailHtml.includes("data-builder-pd-doc-form"), "detail documents panel");
assert(hubHtml.includes("data-builder-ph-document-summary"), "hub document summary");
assert(hubHtml.includes("Document数"), "hub document columns");
assert(hubJs.includes("renderDocumentSummary"), "hub document summary render");
assert(storeSrc.includes("document_added"), "timeline document_added");
assert(storeSrc.includes("document_updated"), "timeline document_updated");
assert(storeSrc.includes("document_archived"), "timeline document_archived");
assert(storeSrc.includes("document_deleted"), "timeline document_deleted");
assert(uiJs.includes("prepareDocumentIntent"), "builder-ai prepareDocumentIntent");

const Store = loadStore();
Store.clearForTests();
Store.ensureSeed();

assert(Store.SCHEMA_VERSION === 7, "store schema 7");

const p001 = Store.getProject("PRJ-2026-001");
assert(p001?.documents?.length >= 5, "documents seed 5+", String(p001?.documents?.length));
assert(p001.documents.every((d) => d.id && d.type && d.status), "documents initial shape");

const added = Store.addDocument("PRJ-2026-001", {
  type: "memo",
  title: "テスト追加メモ",
  filename: "test-memo.txt",
  tags: ["テスト"],
});
assert(added.ok && added.document?.title === "テスト追加メモ", "addDocument");
assert(
  added.project.timeline.some((e) => e.type === "document_added"),
  "timeline document_added"
);

const updated = Store.updateDocument("PRJ-2026-001", added.document.id, {
  title: "更新メモ",
  documentReason: "テスト更新",
});
assert(updated.ok && updated.document.title === "更新メモ", "updateDocument");
assert(
  updated.project.timeline.some((e) => e.type === "document_updated"),
  "timeline document_updated"
);

const archived = Store.archiveDocument("PRJ-2026-002", "doc-002-1", "テストアーカイブ");
assert(archived.ok && archived.document.status === "archived", "archiveDocument");
assert(
  archived.project.timeline.some((e) => e.type === "document_archived"),
  "timeline document_archived"
);

const removed = Store.removeDocument("PRJ-2026-003", "doc-003-3", "テスト削除");
assert(removed.ok && removed.document.status === "deleted", "removeDocument");
assert(
  removed.project.timeline.some((e) => e.type === "document_deleted"),
  "timeline document_deleted"
);

const search = Store.searchDocuments("PRJ-2026-001", { q: "見積" });
assert(search.some((d) => d.title.includes("見積")), "search documents");

const byType = Store.getDocumentsByType("PRJ-2026-001", "photo");
assert(byType.length >= 2, "documents by type photo", String(byType.length));

const summary = Store.getDocumentSummary();
assert(summary.totalDocuments >= 5, "document summary total", String(summary.totalDocuments));
assert(summary.photoCount >= 2, "document summary photos");
assert(summary.contractCount >= 1, "document summary contracts");

const preview = Store.previewDocumentIntent("ドキュメント追加: 図面 タイトル: 平面図");
assert(preview.ok && preview.intent.type === Store.DOCUMENT_INTENT_TYPES.ADD, "previewDocumentIntent");

const apply = Store.applyDocumentIntent("PRJ-2026-002", {
  type: Store.DOCUMENT_INTENT_TYPES.ADD,
  docType: "memo",
  title: "AI テストメモ",
  reason: "AI テスト",
});
assert(apply.ok, "applyDocumentIntent");

console.log(`\n--- Phase 6-F unit ${pass}/${pass + fail} ---`);
if (fail) process.exit(1);

console.log("\nRunning phase6e regression …");
const p6e = spawnSync("node", ["scripts/test-builder-contract-completion-phase6e.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (p6e.status !== 0) {
  bad("phase6e regression");
  process.exit(1);
}
ok("phase6e regression");

console.log("\nRunning build:pages …");
const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, stdio: "inherit", shell: true });
if (build.status !== 0) {
  bad("build:pages");
  process.exit(1);
}
ok("build:pages PASS");

console.log(`\n=== ALL ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
