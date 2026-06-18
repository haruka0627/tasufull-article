/**
 * ST+ AIマッチング — 本番データ返却の自動確認
 * 実行: node scripts/verify-ai-matching.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const MODES = [
  {
    id: "business-search",
    label: "業者探しAI",
    input: "東京都 エアコン清掃 予算5万円 即日対応",
    handler: "searchBusinessListings",
    mustHave: ["【整理した条件】", "【おすすめ候補】", "詳細:"],
    optional: ["カテゴリ", "対応地域", "料金"],
    emptyPhrase: "条件を少し広げてください",
    maxItems: 5,
  },
  {
    id: "product-search",
    label: "商品探しAI",
    input: "古着 ジャケット 予算1万円 配送可 在庫あり",
    handler: "searchProductListings",
    mustHave: ["【整理した条件】", "【おすすめ候補】", "詳細:"],
    optional: ["商品", "店舗", "価格", "カテゴリ"],
    emptyPhrase: "条件を少し広げてください",
    maxItems: 5,
  },
  {
    id: "job-search",
    label: "求人探しAI",
    input: "東京都 動画編集 正社員 月給30万円以上 週5日 募集中",
    handler: "searchJobListings",
    mustHave: ["【整理した条件】", "【おすすめ候補】", "詳細:"],
    optional: ["会社名", "勤務地", "給与"],
    emptyPhrase: "条件を少し広げてください",
    maxItems: 5,
  },
  {
    id: "skill-search",
    label: "スキル探しAI",
    input: "動画編集 ショート動画 予算1万円 オンライン 3日以内 高評価",
    handler: "searchSkillListings",
    mustHave: ["【整理した条件】", "【おすすめ候補】", "詳細:"],
    optional: ["出品者", "料金", "カテゴリ"],
    emptyPhrase: "条件を少し広げてください",
    maxItems: 5,
  },
  {
    id: "worker-search",
    label: "ワーカー探しAI",
    input: "東京都 軽作業 搬入 即日 時給2000円 資格不要",
    handler: "searchWorkerListings",
    mustHave: ["【整理した条件】", "【おすすめ候補】", "詳細:"],
    optional: ["ワーカー", "対応カテゴリ", "料金"],
    emptyPhrase: "条件を少し広げてください",
    maxItems: 5,
  },
];

const SCRIPT_CHAIN = [
  "chat-supabase-config.js",
  "tasu-supabase-client.js",
  "listing-tags.js",
  "product-listing-fields.js",
  "job-listing-fields.js",
  "worker-listing-fields.js",
  "listings-db.js",
  "business-categories.js",
  "business-wording.js",
  "listing-renderer.js",
  "business-listings-db.js",
  "shop-store-products-db.js",
  "ai-modes.js",
  "ai-search.js",
  "ai-workspace-chat.js",
];

function countCandidates(reply) {
  if (!reply || reply.includes("該当する") && reply.includes("見つかりません")) {
    return 0;
  }
  const m = reply.match(/【おすすめ候補】[^]*$/);
  if (!m) return 0;
  const block = m[0];
  const numbered = block.match(/^\d+\.\s/gm);
  return numbered ? numbered.length : 0;
}

function isMockReply(reply) {
  return /（デモ・|デモ・業務サービス|を想定）/.test(reply || "");
}

function loadConfig() {
  const configPath = path.join(ROOT, "chat-supabase-config.js");
  if (!fs.existsSync(configPath)) {
    return { url: "", anonKey: "" };
  }
  const text = fs.readFileSync(configPath, "utf8");
  const url = text.match(/url:\s*["']([^"']+)["']/)?.[1]?.trim() || "";
  const anonKey =
    text.match(/anonKey:\s*["']([^"']+)["']/)?.[1]?.trim() ||
    text.match(/anon_key:\s*["']([^"']+)["']/)?.[1]?.trim() ||
    "";
  return { url, anonKey };
}

function makeStorage() {
  const data = {};
  return {
    getItem(k) {
      return data[k] ?? null;
    },
    setItem(k, v) {
      data[k] = String(v);
    },
    removeItem(k) {
      delete data[k];
    },
    clear() {
      Object.keys(data).forEach((k) => delete data[k]);
    },
    get length() {
      return Object.keys(data).length;
    },
    key(i) {
      return Object.keys(data)[i] ?? null;
    },
  };
}

function runScript(ctx, relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing script: ${relPath}`);
  }
  const code = fs.readFileSync(full, "utf8");
  try {
    vm.runInContext(code, ctx, { filename: full, timeout: 30000 });
  } catch (err) {
    throw new Error(`${relPath}: ${err.message}`);
  }
}

async function bootstrap() {
  const storage = makeStorage();
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    fetch: globalThis.fetch,
    URL: globalThis.URL,
    location: { href: "http://127.0.0.1/ai-workspace.html", protocol: "http:", search: "" },
    document: {
      readyState: "complete",
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} }),
      body: { classList: { contains: () => false }, appendChild: () => {} },
      addEventListener: () => {},
    },
    localStorage: storage,
    sessionStorage: makeStorage(),
    supabase: { createClient },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);

  for (const rel of SCRIPT_CHAIN) {
    runScript(ctx, rel);
  }

  return sandbox;
}

async function probeSupabaseCounts(cfg) {
  if (!cfg.url || !cfg.anonKey) {
    return { configured: false };
  }
  const sb = createClient(cfg.url, cfg.anonKey);
  const probes = {};

  const biz = await sb
    .from("business_listings")
    .select("id", { count: "exact", head: true })
    .eq("publish_status", "public");
  probes.business_listings = biz.error ? `err:${biz.error.message}` : biz.count ?? 0;

  for (const type of ["product", "job", "skill", "worker"]) {
    const res = await sb
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("listing_type", type)
      .eq("publish_status", "public");
    probes[`listings_${type}`] = res.error ? `err:${res.error.message}` : res.count ?? 0;
  }

  const shop = await sb
    .from("shop_store_products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  probes.shop_store_products = shop.error ? `err:${shop.error.message}` : shop.count ?? 0;

  return { configured: true, probes };
}

async function runModeTest(window, mode) {
  const ctx = {
    modeId: mode.id,
    userText: mode.input,
    messages: [{ role: "user", content: mode.input }],
    mode: window.TasuAiModes.getMode(mode.id),
  };

  const fn = window.TasuAiSearch[mode.handler];
  if (typeof fn !== "function") {
    return { ok: false, error: `handler missing: ${mode.handler}` };
  }

  const reply = await fn(ctx);
  const checks = [];

  if (reply == null) {
    checks.push({ pass: false, note: "null returned (mock fallback path)" });
    return { ok: false, reply: null, checks };
  }

  const count = countCandidates(reply);
  const resultMustHave =
    count > 0
      ? mode.mustHave
      : mode.mustHave.filter((t) => t !== "【おすすめ候補】" && t !== "詳細:");

  for (const token of resultMustHave) {
    checks.push({
      pass: reply.includes(token),
      note: `contains "${token}"`,
    });
  }
  checks.push({
    pass: count <= mode.maxItems,
    note: `candidate count ${count} <= ${mode.maxItems}`,
  });

  if (count > 0) {
    checks.push({
      pass: !isMockReply(reply),
      note: "not demo/mock wording",
    });
    for (const token of mode.optional) {
      checks.push({
        pass: reply.includes(token),
        note: `optional field hint "${token}"`,
      });
    }
    if (/detail-(business-service|product|shop-product|job|skill|worker)\.html/.test(reply)) {
      checks.push({ pass: true, note: "detail URL present" });
    } else {
      checks.push({ pass: false, note: "detail URL missing" });
    }
  } else {
    checks.push({
      pass: reply.includes(mode.emptyPhrase),
      note: "empty-result guidance",
    });
  }

  const ok = checks.every((c) => c.pass);
  return { ok, reply, count, checks };
}

async function testMockFallback(window) {
  const orig = window.TasuListingStore.fetchPublishedListings;
  const origBiz = window.TasuBusinessListings.fetchPublishedBusinessListings;
  window.TasuListingStore.fetchPublishedListings = async () => {
    throw new Error("simulated fetch failure");
  };
  window.TasuBusinessListings.fetchPublishedBusinessListings = async () => {
    throw new Error("simulated fetch failure");
  };

  const skillReply = await window.TasuAiSearch.searchSkillListings({
    modeId: "skill-search",
    userText: "動画編集 予算1万円 オンライン",
    messages: [{ role: "user", content: "動画編集 予算1万円 オンライン" }],
  });

  window.TasuListingStore.fetchPublishedListings = orig;
  window.TasuBusinessListings.fetchPublishedBusinessListings = origBiz;

  const mockViaChat = await window.TasuAiChat.mockGenerateReply(
    "skill-search",
    "動画編集 予算1万円 オンライン 3日以内",
    [{ role: "user", content: "動画編集" }],
    window.TasuAiModes.getMode("skill-search")
  );

  return {
    searchReturnsNull: skillReply === null,
    mockHasDemo: /デモ|おすすめ候補/.test(mockViaChat || ""),
  };
}

async function testSupportModes(window) {
  const guide = await window.TasuAiChat.mockGenerateReply(
    "tasful-guide",
    "会員登録",
    [],
    window.TasuAiModes.getMode("tasful-guide")
  );
  const listing = await window.TasuAiChat.mockGenerateReply(
    "listing-support",
    "スキルを出品したい",
    [{ role: "user", content: "デザインのスキルを出品" }],
    window.TasuAiModes.getMode("listing-support")
  );
  return {
    guideOk: /会員|登録|post\.html/.test(guide || ""),
    listingOk: /【おすすめカテゴリ】|タイトル案/.test(listing || ""),
  };
}

async function main() {
  console.log("=== ST+ AIマッチング 本番データ確認 ===\n");

  const cfg = loadConfig();
  console.log("Supabase config:", cfg.url ? `${cfg.url} (key set)` : "(not configured)");

  const probes = await probeSupabaseCounts(cfg);
  if (probes.configured) {
    console.log("DB row counts (public/active):", probes.probes);
  } else {
    console.log("DB probes skipped — localStorage fallback may be used in browser");
  }
  console.log("");

  let window;
  try {
    window = await bootstrap();
  } catch (err) {
    console.error("Bootstrap failed:", err.message);
    process.exit(1);
  }

  const supabaseOk = window.TasuSupabase?.isConfigured?.();
  console.log("TasuSupabase.isConfigured:", supabaseOk);
  console.log("");

  let allPass = true;

  for (const mode of MODES) {
    console.log(`--- ${mode.label} (${mode.id}) ---`);
    console.log(`入力: ${mode.input}`);
    try {
      const result = await runModeTest(window, mode);
      if (result.error) {
        console.log("ERROR:", result.error);
        allPass = false;
      } else {
        for (const c of result.checks) {
          console.log(`  ${c.pass ? "OK" : "NG"}: ${c.note}`);
        }
        if (result.reply) {
          const preview = result.reply.split("\n").slice(0, 12).join("\n");
          console.log("--- reply preview ---");
          console.log(preview);
          if (result.reply.split("\n").length > 12) console.log("...(truncated)");
        }
        if (!result.ok) allPass = false;
      }
    } catch (err) {
      console.log("EXCEPTION:", err.message);
      allPass = false;
    }
    console.log("");
  }

  console.log("--- DB取得エラー → モックフォールバック ---");
  try {
    const fb = await testMockFallback(window);
    console.log(`  searchSkillListings on fetch error returns null: ${fb.searchReturnsNull ? "OK" : "NG"}`);
    console.log(`  mockGenerateReply provides fallback: ${fb.mockHasDemo ? "OK" : "NG"}`);
    if (!fb.searchReturnsNull || !fb.mockHasDemo) allPass = false;
  } catch (err) {
    console.log("  EXCEPTION:", err.message);
    allPass = false;
  }
  console.log("");

  console.log("--- サポート系AI（非破壊） ---");
  try {
    const sup = await testSupportModes(window);
    console.log(`  TASFUL使い方AI: ${sup.guideOk ? "OK" : "NG"}`);
    console.log(`  掲載サポートAI: ${sup.listingOk ? "OK" : "NG"}`);
    if (!sup.guideOk || !sup.listingOk) allPass = false;
  } catch (err) {
    console.log("  EXCEPTION:", err.message);
    allPass = false;
  }
  console.log("");

  console.log("--- タブ / モード定義 ---");
  const groups = window.TasuAiModes.listModeGroups();
  const matching = groups.find((g) => g.id === "matching");
  console.log(
    `  AIマッチングタブ: ${matching?.modes?.map((m) => m.id).join(", ") || "(none)"}`
  );
  console.log(`  isMatchingMode(business-search): ${window.TasuAiModes.isMatchingMode("business-search")}`);

  console.log("");
  console.log(allPass ? "RESULT: ALL CHECKS PASSED" : "RESULT: SOME CHECKS FAILED");
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
