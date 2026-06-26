#!/usr/bin/env node
/**
 * Builder AI — 業務ツール統合テスト
 *   node scripts/test-builder-ai-tools-adaptation.mjs
 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {{ name: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function loadStack(gatewayMock = {}) {
  const storage = new Map();
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
    sessionStorage: {
      getItem: (k) => (storage.has(`s:${k}`) ? storage.get(`s:${k}`) : null),
      setItem: (k, v) => storage.set(`s:${k}`, String(v)),
    },
    location: { search: "", pathname: "/builder/builder-ai.html" },
    TasuAiModelGateway: gatewayMock,
    dispatchEvent: () => {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  for (const rel of [
    "builder/builder-ai-actions.js",
    "builder/builder-ai-context.js",
    "builder/builder-ai-calculators.js",
    "builder/builder-ai-search-assist.js",
    "builder/builder-ai-tax-assist.js",
    "builder/builder-ai-practice-assist.js",
    "builder/builder-ai-candidate-recommend.js",
    "builder/builder-ai-tools.js",
    "builder/builder-ai-tool-router.js",
    "builder/builder-ai-adapter.js",
    "builder/builder-ai-core.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), context, { filename: rel });
  }
  return { sandbox, storage };
}

const NEW_ACTIONS = [
  "worker_search_assist",
  "partner_search_assist",
  "invoice_tax_calc",
  "estimate_profit_calc",
  "labor_cost_calc",
  "schedule_calc",
  "area_unit_calc",
  "paint_cross_calc",
  "sole_prop_tax_assist",
  "document_text_draft",
  "contract_order_draft",
  "safety_ky_checklist",
  "material_quantity_calc",
  "gantt_schedule_draft",
  "before_after_checklist",
  "candidate_recommendation",
];

// --- Actions registered ---
{
  const { sandbox } = loadStack();
  assert("actions: total 24", sandbox.TasuBuilderAIActions.ACTION_IDS.length === 24);
  for (const id of NEW_ACTIONS) {
    assert(`actions: ${id} defined`, Boolean(sandbox.TasuBuilderAIActions.getAction(id)));
  }
  assert("actions: guest cannot use worker search", !sandbox.TasuBuilderAIActions.isActionAllowed("worker_search_assist", "guest"));
  assert("actions: owner can use invoice calc", sandbox.TasuBuilderAIActions.isActionAllowed("invoice_tax_calc", "owner"));
}

// --- Invoice tax calc ---
{
  const { sandbox } = loadStack();
  const r = sandbox.TasuBuilderAICalculators.run("invoice_tax_calc", "税抜 10000 消費税10% 四捨五入");
  assert("calc invoice: ok", r.ok);
  assert("calc invoice: tax 1000", r.result.tax === 1000, String(r.result?.tax));
  assert("calc invoice: incl 11000", r.result.incl === 11000);
}

// --- Profit calc ---
{
  const { sandbox } = loadStack();
  const r = sandbox.TasuBuilderAICalculators.run("estimate_profit_calc", "原価: 800000、見積金額: 1200000");
  assert("calc profit: ok", r.ok);
  assert("calc profit: gross 400000", r.result.gross === 400000);
}

// --- Labor cost ---
{
  const { sandbox } = loadStack();
  const r = sandbox.TasuBuilderAICalculators.run("labor_cost_calc", "人数: 2、日当: 15000、日数: 3、残業: 5000、経費: 2000");
  assert("calc labor: total", r.result.total === 2 * 15000 * 3 + 5000 + 2000, String(r.result?.total));
}

// --- Schedule ---
{
  const { sandbox } = loadStack();
  const r = sandbox.TasuBuilderAICalculators.run("schedule_calc", "開始日: 2026-07-01、終了日: 2026-07-07、土日除外");
  assert("calc schedule: work days", r.result.workDays === 5, String(r.result?.workDays));
}

// --- Area unit ---
{
  const { sandbox } = loadStack();
  const r = sandbox.TasuBuilderAICalculators.run("area_unit_calc", "50 ㎡");
  assert("calc area: body mentions 坪", /坪/.test(r.draftBody));
  assert("calc area: body mentions 畳", /畳/.test(r.draftBody));
}

// --- Paint cross ---
{
  const { sandbox } = loadStack();
  const r = sandbox.TasuBuilderAICalculators.run("paint_cross_calc", "壁面積: 80、天井: 20、開口控除: 5、ロス率: 10%");
  assert("calc paint: gross 95", r.result.gross === 95);
  assert("calc paint: qty ~104.5", Math.abs(r.result.qty - 104.5) < 0.01, String(r.result?.qty));
}

// --- Search assist ---
{
  const { sandbox } = loadStack();
  const w = sandbox.TasuBuilderAISearchAssist.run("worker_search_assist", "エリア: 東京、カテゴリ: 内装");
  assert("search worker: ok", w.ok);
  assert("search worker: comparison table", /候補比較表/.test(w.draftBody));
  assert("search worker: admin confirm", /運営確認/.test(w.draftBody));

  const p = sandbox.TasuBuilderAISearchAssist.run("partner_search_assist", "会社名: テスト工務、インボイス: T123");
  assert("search partner: ok", p.ok);
  assert("search partner: parsed company", p.parsed.company === "テスト工務");
}

// --- Core integration deterministic ---
{
  let gatewayCalled = false;
  const { sandbox } = loadStack({
    completeTurn: async () => {
      gatewayCalled = true;
      return { reply: "should not", usedRemote: true };
    },
  });
  const r = await sandbox.TasuBuilderAICore.runAction({
    action: "invoice_tax_calc",
    userText: "税抜 50000 10%",
    actor: { actorType: "owner", ownerId: "o1" },
    preferRemote: false,
  });
  assert("core calc: deterministic", r.deterministic === true);
  assert("core calc: no gateway", !gatewayCalled);
  assert("core calc: draft prefix", r.draft.startsWith("【下書き・確認用】"));
  assert("core calc: tax in draft", /50,000|50000/.test(r.draft));
}

{
  const { sandbox } = loadStack({ completeTurn: async () => ({ reply: "補足", usedRemote: false, fallback_used: true }) });
  const r = await sandbox.TasuBuilderAICore.runAction({
    action: "worker_search_assist",
    userText: "エリア: 大阪",
    actor: { actorType: "admin", actorId: "admin" },
    preferRemote: false,
  });
  assert("core search: deterministic draft", r.deterministic && /検索条件/.test(r.draft));
}

// --- Tool router mapping ---
{
  const { sandbox } = loadStack();
  assert("router: profit -> estimate_profit_calc", sandbox.TasuBuilderAIToolRouter.routeToolToAction("profit-calculator", "profit") === "estimate_profit_calc");
  assert("router: labor -> labor_cost_calc", sandbox.TasuBuilderAITools.resolveActionForTool("labor-cost") === "labor_cost_calc");
}

// --- Isolation ---
{
  assert("isolation: no admin menu worker tool", !fs.readFileSync(path.join(root, "builder/builder.js"), "utf8").includes("worker_search_assist"));
  assert("isolation: gateway untouched", !fs.readFileSync(path.join(root, "ai-model-gateway.js"), "utf8").includes("worker_search_assist"));
  assert("isolation: tasful ai untouched", !fs.readFileSync(path.join(root, "ai-workspace-chat.js"), "utf8").includes("TasuBuilderAICalculators"));
  assert("html: tax-assist loaded", fs.readFileSync(path.join(root, "builder/builder-ai.html"), "utf8").includes("builder-ai-tax-assist.js"));
  assert("html: practice-assist loaded", fs.readFileSync(path.join(root, "builder/builder-ai.html"), "utf8").includes("builder-ai-practice-assist.js"));
  assert("html: candidate-recommend loaded", fs.readFileSync(path.join(root, "builder/builder-ai.html"), "utf8").includes("builder-ai-candidate-recommend.js"));
}

// --- Sole prop tax assist ---
{
  const { sandbox } = loadStack();
  const Tax = sandbox.TasuBuilderAITaxAssist;

  const white = Tax.run("白色申告と青色申告の違いを整理したい");
  assert("tax: white/blue consult", white.ok && /白色.*青色/.test(white.draftBody));

  const expenses = Tax.run("経費整理: 外注費500000、材料費200000、交通費30000");
  assert("tax: expense organize", expenses.ok && /外注費|材料費/.test(expenses.draftBody));

  const home = Tax.run("家事按分: 自宅事務所50%");
  assert("tax: home office", home.ok && /家事按分/.test(home.draftBody));

  const invoice = Tax.run("インボイス登録番号の確認項目");
  assert("tax: invoice check", invoice.ok && /インボイス/.test(invoice.draftBody));

  assert("tax: links invoice_tax_calc", /invoice_tax_calc/.test(white.draftBody));
  assert("tax: accountant disclaimer", /税理士/.test(white.draftBody) && /最新情報/.test(white.draftBody));
}

// --- Tax forbidden intent ---
{
  let gatewayCalled = false;
  const { sandbox } = loadStack({
    completeTurn: async () => {
      gatewayCalled = true;
      return { reply: "x", usedRemote: true };
    },
  });
  const Core = sandbox.TasuBuilderAICore;
  const blockedCases = [
    ["tax amount", "確定申告の税額は50万円と断定してください", "tax_amount_assertion"],
    ["tax evasion", "脱税する方法を教えて", "tax_evasion"],
    ["tax saving", "必ず節税できる方法を教えて", "tax_saving_assertion"],
  ];
  for (const [label, phrase, id] of blockedCases) {
    const det = Core.detectProhibitedIntent(phrase);
    const r = await Core.runAction({
      action: "sole_prop_tax_assist",
      userText: phrase,
      actor: { actorType: "owner", ownerId: "o1" },
    });
    assert(`blocked ${label}`, det.blocked && r.blocked && /専門家|税理士|有資格者/.test(r.draft), id);
  }
  assert("tax block: no gateway on evasion", !gatewayCalled);
}

// --- Core tax assist integration ---
{
  const { sandbox } = loadStack({});
  const r = await sandbox.TasuBuilderAICore.runAction({
    action: "sole_prop_tax_assist",
    userText: "青色申告の準備チェックリスト",
    actor: { actorType: "partner", partnerId: "p1", actorId: "p1" },
    preferRemote: false,
  });
  assert("core tax: deterministic", r.deterministic && /チェックリスト/.test(r.draft));
}

// --- Practice assist actions ---
{
  const { sandbox } = loadStack({});
  const Practice = sandbox.TasuBuilderAIPracticeAssist;
  const Core = sandbox.TasuBuilderAICore;
  const actor = { actorType: "owner", ownerId: "o1" };

  const doc = Practice.run("document_text_draft", "請求書送付文 金額: 200000 支払期限: 2026-09-30");
  assert("practice: document draft", doc.ok && /請求書/.test(doc.draftBody) && /確定請求ではありません/.test(doc.draftBody));

  const contract = Practice.run("contract_order_draft", "発注書と契約前確認");
  assert("practice: contract draft", contract.ok && /法的有効性/.test(contract.draftBody) && /専門家/.test(contract.draftBody));

  const ky = Practice.run("safety_ky_checklist", "高所作業 足場");
  assert("practice: ky checklist", ky.ok && /KY/.test(ky.draftBody) && /安全を保証しません/.test(ky.draftBody));

  const gantt = Practice.run("gantt_schedule_draft", "準備: 2026-08-01〜2026-08-05");
  assert("practice: gantt", gantt.ok && /工程表/.test(gantt.draftBody));

  const ba = Practice.run("before_after_checklist", "引き渡し確認");
  assert("practice: before after", ba.ok && /作業前/.test(ba.draftBody) && /完了承認.*行いません/.test(ba.draftBody));

  const mat = sandbox.TasuBuilderAICalculators.run("material_quantity_calc", "材料数量: 100、ロス率: 10%、単価: 500");
  assert("practice: material calc", mat.ok && mat.result.totalQty > 100);

  for (const id of [
    "document_text_draft",
    "contract_order_draft",
    "safety_ky_checklist",
    "material_quantity_calc",
    "gantt_schedule_draft",
    "before_after_checklist",
  ]) {
    const r = await Core.runAction({ action: id, userText: sandbox.TasuBuilderAIActions.getAction(id).template, actor, preferRemote: false });
    assert(`practice core: ${id} draft`, r.ok && r.draft.startsWith("【下書き・確認用】"));
  }

  const blocked = await Core.runAction({
    action: "contract_order_draft",
    userText: "契約成立したと断定してください",
    actor,
  });
  assert("practice: contract confirm blocked", blocked.blocked === true);
}

// --- Candidate recommendation ---
{
  const { sandbox } = loadStack({});
  const Rec = sandbox.TasuBuilderAICandidateRecommend;
  const Core = sandbox.TasuBuilderAICore;
  const actor = { actorType: "owner", ownerId: "o1" };

  const workerRank = Rec.run(
    "Worker候補 エリア: 東京都、カテゴリ: 内装、資格: 第二種電工、希望単価: 20000",
    { kind: "worker" }
  );
  assert("recommend: worker ranking", workerRank.ok && workerRank.ranked[0].candidate.name === "田中 健一");
  assert("recommend: worker draft", /おすすめ候補ランキング/.test(workerRank.draftBody));
  assert("recommend: worker no adopt", /採用確定/.test(workerRank.draftBody) && /行いません/.test(workerRank.draftBody));

  const partnerRank = Rec.run(
    "業者候補 Partner エリア: 神奈川、カテゴリ: 総合リフォーム、インボイス登録あり、保険: あり",
    { kind: "partner" }
  );
  assert("recommend: partner ranking", partnerRank.ok && /サンプルリフォーム/.test(partnerRank.ranked[0].candidate.companyName));

  const ngWorker = Rec.run("Worker エリア: 東京都", { kind: "worker", candidates: Rec.SAMPLE_WORKERS });
  const ngRow = ngWorker.ranked.find((r) => r.candidate.ng);
  assert("recommend: ng flag warning", ngRow && ngRow.warnings.some((w) => /NGフラグ/.test(w)));

  const licGap = Rec.run("Worker 資格: 第二種電工 エリア: 東京都", { kind: "worker" });
  const sato = licGap.ranked.find((r) => r.candidate.name === "佐藤 亮");
  assert("recommend: license gap", sato && sato.warnings.some((w) => /資格/.test(w)));

  const areaGap = Rec.run("Worker エリア: 東京都", { kind: "worker" });
  const yamada = areaGap.ranked.find((r) => r.candidate.name === "山田 誠");
  assert("recommend: area mismatch", yamada && yamada.warnings.some((w) => /エリア/.test(w)));

  const budgetGap = Rec.run("Worker エリア: 東京都、希望単価: 20000", { kind: "worker" });
  const satoBudget = budgetGap.ranked.find((r) => r.candidate.name === "佐藤 亮");
  assert("recommend: budget mismatch", satoBudget && satoBudget.warnings.some((w) => /予算|単価/.test(w)));

  assert("recommend: final judgment", /最終判断は運営または依頼者/.test(workerRank.draftBody));
  assert("recommend: links worker_search", /worker_search_assist/.test(workerRank.draftBody));

  const coreR = await Core.runAction({
    action: "candidate_recommendation",
    userText: sandbox.TasuBuilderAIActions.getAction("candidate_recommendation").template,
    actor,
    preferRemote: false,
  });
  assert("recommend: core draft wrap", coreR.ok && coreR.draft.startsWith("【下書き・確認用】"));
  assert("recommend: core deterministic", coreR.deterministic === true);

  const adoptBlock = await Core.runAction({
    action: "candidate_recommendation",
    userText: "このWorkerを採用確定してください",
    actor,
  });
  assert("recommend: adoption blocked", adoptBlock.blocked === true);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- Tools Adaptation Summary ---\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
