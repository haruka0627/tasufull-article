#!/usr/bin/env node
/**
 * TLV Business Simulator — Excel + 月次還元判断レポート生成
 *   node scripts/generate-tlv-business-simulator.mjs
 *
 * 本番送金・Stripe API 呼び出しは行いません（reports/ と scripts/ のみ）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import {
  runPayoutDecision,
  defaultMonthlyInputs,
  defaultSampleCreators,
  baselineMonthlyInputs,
  BASE_RATE_CANDIDATES,
  buildRankProgressReport,
  ENGINE_VERSION,
  formatResidualPoolMarkdown,
  buildCreatorRankExplanationReport,
  formatCreatorRankExplanationMarkdown,
  buildPayoutEngineV2FinalSpec,
  formatPayoutEngineV2FinalSpecMarkdown,
  finalSpecToExcelRows,
  getGuaranteedRates,
} from "./tlv-payout-engine.mjs";
import {
  runHighPayoutThresholdAnalysis,
  formatThresholdMarkdown,
} from "./tlv-high-payout-thresholds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "reports", "tlv-business-simulator");
const OUTPUT_DIR = path.join(OUT_DIR, "output");

function loadXlsx() {
  const tryPaths = [
    import.meta.url,
    pathToFileURL(path.join(__dirname, "package.json")),
    pathToFileURL(path.join(ROOT, "package.json")),
  ];
  for (const base of tryPaths) {
    try {
      return createRequire(base)("xlsx");
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "xlsx not installed. Run: npm install xlsx --save-dev (repo root) or npm install xlsx in scripts/"
  );
}

/** @param {Record<string, unknown>[]} rows */
function sheetFromRows(rows) {
  const XLSX = loadXlsx();
  return XLSX.utils.json_to_sheet(rows);
}

function yen(n) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildBaselineMetrics() {
  const FX = 150;
  const CPM = 450;
  const CTR = 0.008;
  const STRIPE = 0.036;
  const FIXED = 300000;
  const AI = 15000;
  const CF_BASE_USD = 5;

  const short = { views: 80000, impPerView: 1.1, newVideos: 200, fileMb: 12, r2ReadsPerView: 8 };
  const long = { views: 35000, impPerView: 2.4, newVideos: 40, fileMb: 180, r2ReadsPerView: 15 };
  const live = { watchHours: 4800, impPerHour: 3.5, sessions: 24, avgConcurrent: 80, doGbSPerConcHour: 0.05 };

  const impShort = short.views * short.impPerView;
  const impLong = long.views * long.impPerView;
  const impLive = live.watchHours * live.impPerHour;
  const totalImp = impShort + impLong + impLive;
  const adRevenue = Math.round(totalImp * (CPM / 1000) * (1 + CTR));

  const r2StorageGb =
    (short.newVideos * short.fileMb + long.newVideos * long.fileMb) / 1024 + live.sessions * 2;
  const r2StorageUsd = Math.max(0, r2StorageGb - 10) * 0.015;
  const r2Reads =
    short.views * short.r2ReadsPerView + long.views * long.r2ReadsPerView + live.watchHours * 120;
  const r2ReadUsd = Math.max(0, r2Reads - 10_000_000) / 1_000_000 * 0.36;
  const r2WriteUsd = ((short.newVideos + long.newVideos) * 50) / 1_000_000 * 4.5;
  const storageCostJpy = Math.round((r2StorageUsd + r2ReadUsd + r2WriteUsd) * FX);

  const workerReq = short.views * 3 + long.views * 4 + live.watchHours * 200;
  const workerUsd = CF_BASE_USD + Math.max(0, workerReq - 10_000_000) / 1_000_000 * 0.3;
  const kvUsd = 0.2;
  const d1Usd = 0.5;
  const doGbS = live.avgConcurrent * live.doGbSPerConcHour * live.watchHours;
  const doUsd = Math.max(0, doGbS - 400_000) / 1_000_000 * 12.5 + 0.3;
  const imagesUsd = 0.5;
  const apiCostJpy = Math.round((workerUsd + kvUsd + d1Usd + doUsd + imagesUsd) * FX);

  const videoDeliveryJpy = Math.round(storageCostJpy * 0.45);
  const liveDeliveryJpy = Math.round(apiCostJpy * 0.55 + storageCostJpy * 0.1);
  const stripeJpy = Math.round(adRevenue * STRIPE);
  const cloudflareTotal = videoDeliveryJpy + liveDeliveryJpy + storageCostJpy + apiCostJpy;
  const totalCost = cloudflareTotal + AI + FIXED + stripeJpy;

  const baseViews = short.views + long.views;

  return {
    FX,
    CPM,
    CTR,
    STRIPE,
    FIXED,
    AI,
    short,
    long,
    live,
    impShort,
    impLong,
    impLive,
    adRevenue,
    videoDeliveryJpy,
    liveDeliveryJpy,
    storageCostJpy,
    apiCostJpy,
    stripeJpy,
    cloudflareTotal,
    totalCost,
    baseViews,
  };
}

function buildWorkbook(payoutDecision, thresholdAnalysis, finalSpec) {
  const XLSX = loadXlsx();
  const wb = XLSX.utils.book_new();
  const m = buildBaselineMetrics();
  const {
    FX,
    CPM,
    CTR,
    STRIPE,
    FIXED,
    AI,
    short,
    long,
    live,
    impShort,
    impLong,
    impLive,
    adRevenue,
    videoDeliveryJpy,
    liveDeliveryJpy,
    storageCostJpy,
    apiCostJpy,
    stripeJpy,
    totalCost,
    baseViews,
  } = m;

  const inputs = [
    { カテゴリ: "共通", 項目: "為替 USD/JPY", 値: FX, 単位: "円/USD", 備考: "変更可" },
    { カテゴリ: "共通", 項目: "月間固定費（人件・その他）", 値: FIXED, 単位: "円/月", 備考: "変更可" },
    { カテゴリ: "共通", 項目: "Cloudflare Workers 基本料", 値: 5, 単位: "USD/月", 備考: "Paid plan min" },
    { カテゴリ: "広告", 項目: "広告 CPM", 値: CPM, 単位: "円/1000imp", 備考: "変更可" },
    { カテゴリ: "広告", 項目: "広告 CTR", 値: CTR, 単位: "率", 備考: "変更可" },
    { カテゴリ: "広告", 項目: "広告収益（手入力上書き・0で自動）", 値: 0, 単位: "円/月", 備考: "0=CPMから算出" },
    { カテゴリ: "決済", 項目: "Stripe 手数料率", 値: STRIPE, 単位: "率", 備考: "日本カード想定" },
    { カテゴリ: "R2", 項目: "ストレージ", 値: 0.015, 単位: "USD/GB-mo", 備考: "Standard" },
    { カテゴリ: "R2", 項目: "Class B 読取", 値: 0.36, 単位: "USD/百万req", 備考: "変更可" },
    { カテゴリ: "R2", 項目: "Class A 書込", 値: 4.5, 単位: "USD/百万req", 備考: "変更可" },
    { カテゴリ: "Workers", 項目: "超過リクエスト", 値: 0.3, 単位: "USD/百万req", 備考: "1000万含む" },
    { カテゴリ: "Workers", 項目: "超過 CPU ms", 値: 0.02, 単位: "USD/百万ms", 備考: "3000万含む" },
    { カテゴリ: "KV", 項目: "読取超過", 値: 0.5, 単位: "USD/百万", 備考: "1000万含む" },
    { カテゴリ: "KV", 項目: "書込超過", 値: 5, 単位: "USD/百万", 備考: "100万含む" },
    { カテゴリ: "KV", 項目: "ストレージ超過", 値: 0.5, 単位: "USD/GB-mo", 備考: "1GB含む" },
    { カテゴリ: "D1", 項目: "行読取超過", 値: 0.001, 単位: "USD/百万行", 備考: "250億含む" },
    { カテゴリ: "D1", 項目: "行書込超過", 値: 1, 単位: "USD/百万行", 備考: "5000万含む" },
    { カテゴリ: "D1", 項目: "ストレージ超過", 値: 0.75, 単位: "USD/GB-mo", 備考: "5GB含む" },
    { カテゴリ: "DO", 項目: "リクエスト超過", 値: 0.15, 単位: "USD/百万", 備考: "100万含む" },
    { カテゴリ: "DO", 項目: "Duration超過", 値: 12.5, 単位: "USD/百万GB-s", 備考: "40万含む" },
    { カテゴリ: "Images", 項目: "保存", 値: 5, 単位: "USD/10万枚", 備考: "変更可" },
    { カテゴリ: "Images", 項目: "配信", 値: 1, 単位: "USD/10万枚", 備考: "変更可" },
    { カテゴリ: "AI", 項目: "AI利用料（月額見積）", 値: AI, 単位: "円/月", 備考: "変更可" },
    { カテゴリ: "ショート", 項目: "月間本数（新規）", 値: 200, 単位: "本/月", 備考: "変更可" },
    { カテゴリ: "ショート", 項目: "平均動画時間", 値: 45, 単位: "秒", 備考: "変更可" },
    { カテゴリ: "ショート", 項目: "平均ファイルサイズ", 値: 12, 単位: "MB", 備考: "変更可" },
    { カテゴリ: "ショート", 項目: "平均視聴時間", 値: 32, 単位: "秒", 備考: "変更可" },
    { カテゴリ: "ショート", 項目: "平均再生率", 値: 0.72, 単位: "率", 備考: "変更可" },
    { カテゴリ: "ショート", 項目: "月間再生数", 値: short.views, 単位: "回/月", 備考: "変更可" },
    { カテゴリ: "ショート", 項目: "広告imp/再生", 値: short.impPerView, 単位: "imp", 備考: "変更可" },
    { カテゴリ: "通常", 項目: "月間本数（新規）", 値: 40, 単位: "本/月", 備考: "変更可" },
    { カテゴリ: "通常", 項目: "平均動画時間", 値: 600, 単位: "秒", 備考: "変更可" },
    { カテゴリ: "通常", 項目: "平均ファイルサイズ", 値: 180, 単位: "MB", 備考: "変更可" },
    { カテゴリ: "通常", 項目: "平均視聴時間", 値: 240, 単位: "秒", 備考: "変更可" },
    { カテゴリ: "通常", 項目: "平均再生率", 値: 0.38, 単位: "率", 備考: "変更可" },
    { カテゴリ: "通常", 項目: "月間再生数", 値: long.views, 単位: "回/月", 備考: "変更可" },
    { カテゴリ: "通常", 項目: "広告imp/再生", 値: long.impPerView, 単位: "imp", 備考: "変更可" },
    { カテゴリ: "ライブ", 項目: "月間配信回数", 値: live.sessions, 単位: "回/月", 備考: "変更可" },
    { カテゴリ: "ライブ", 項目: "平均配信時間", 値: 90, 単位: "分/回", 備考: "変更可" },
    { カテゴリ: "ライブ", 項目: "月間視聴時間", 値: live.watchHours, 単位: "時間/月", 備考: "変更可" },
    { カテゴリ: "ライブ", 項目: "平均同時視聴（ピーク想定）", 値: live.avgConcurrent, 単位: "人", 備考: "変更可" },
    { カテゴリ: "ライブ", 項目: "広告imp/視聴時間h", 値: live.impPerHour, 単位: "imp/h", 備考: "変更可" },
    { カテゴリ: "ライブ", 項目: "DO GB-s/同時視聴/h", 値: live.doGbSPerConcHour, 単位: "GB-s", 備考: "技術仮定" },
    { カテゴリ: "還元判断", 項目: "month", 値: payoutDecision.month, 単位: "", 備考: "PayoutDecision 用" },
    { カテゴリ: "還元判断", 項目: "tax_reserve", 値: payoutDecision.reserve_summary.tax_reserve, 単位: "円", 備考: "変更可" },
    { カテゴリ: "還元判断", 項目: "development_reserve", 値: payoutDecision.reserve_summary.development_reserve, 単位: "円", 備考: "変更可" },
    { カテゴリ: "還元判断", 項目: "emergency_reserve", 値: payoutDecision.reserve_summary.emergency_reserve, 単位: "円", 備考: "変更可" },
    { カテゴリ: "還元判断", 項目: "minimum_company_profit", 値: 50000, 単位: "円", 備考: "変更可" },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(inputs), "Inputs");

  const monthlyPl = [
    { 項目: "広告収入", 金額_円: adRevenue },
    { 項目: "動画配信コスト（ショート+通常）", 金額_円: -videoDeliveryJpy },
    { 項目: "ライブ配信コスト", 金額_円: -liveDeliveryJpy },
    { 項目: "ストレージ（R2）", 金額_円: -storageCostJpy },
    { 項目: "API（Workers/KV/D1/DO/Images）", 金額_円: -apiCostJpy },
    { 項目: "AI", 金額_円: -AI },
    { 項目: "固定費", 金額_円: -FIXED },
    { 項目: "Stripe手数料", 金額_円: -stripeJpy },
    { 項目: "================", 金額_円: "" },
    { 項目: "総コスト（クリエイター分配前）", 金額_円: -totalCost },
    { 項目: "分配前利益", 金額_円: adRevenue - totalCost },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(monthlyPl), "Monthly_PL");

  const shares = BASE_RATE_CANDIDATES;
  const shareRows = shares.map((pct) => {
    const payout = Math.round(adRevenue * (pct / 100));
    const profit = adRevenue - payout - totalCost;
    return {
      クリエイター分配率: `${pct}%`,
      広告収入_円: adRevenue,
      クリエイター還元_円: payout,
      プラットフォームコスト_円: totalCost,
      利益_円: profit,
      判定: profit >= 0 ? "黒字" : "赤字",
    };
  });
  XLSX.utils.book_append_sheet(wb, sheetFromRows(shareRows), "Creator_Share");

  const scaleViews = [10000, 100000, 500000, 1000000, 5000000, 10000000];
  const scaleRows = scaleViews.map((v) => {
    const factor = v / baseViews;
    const rev = Math.round(adRevenue * factor);
    const cost = Math.round(totalCost * (0.55 + 0.45 * Math.sqrt(factor)));
    const profit55 = rev - Math.round(rev * 0.55) - cost;
    return {
      月間再生数_合計: v,
      スケール倍率: Number(factor.toFixed(2)),
      広告収入_円: rev,
      推定コスト_円: cost,
      利益_55percent還元: profit55,
      判定_55percent: profit55 >= 0 ? "黒字" : "赤字",
    };
  });
  XLSX.utils.book_append_sheet(wb, sheetFromRows(scaleRows), "Scale_Views");

  const conc = [10, 50, 100, 300, 500, 1000, 3000, 5000, 10000];
  const liveScaleRows = conc.map((c) => {
    const doCost = Math.max(0, c * 0.05 * 4800 - 400_000) / 1_000_000 * 12.5 * FX;
    const liveCost = Math.round(liveDeliveryJpy * (c / live.avgConcurrent) + doCost);
    const liveRev = Math.round((impLive / live.avgConcurrent) * c * (CPM / 1000));
    const profit60 = liveRev - Math.round(liveRev * 0.6) - liveCost - FIXED * 0.3;
    return {
      同時視聴数: c,
      ライブ広告収入_円: liveRev,
      ライブコスト_円: liveCost,
      利益_60percent還元_ライブのみ: profit60,
      判定: profit60 >= 0 ? "黒字" : "赤字",
    };
  });
  XLSX.utils.book_append_sheet(wb, sheetFromRows(liveScaleRows), "Scale_Live");

  function profitAtViews(monthlyViews, sharePct) {
    const factor = monthlyViews / baseViews;
    const rev = Math.round(adRevenue * factor);
    const cost = Math.round(totalCost * (0.55 + 0.45 * Math.sqrt(factor)));
    return rev - Math.round(rev * (sharePct / 100)) - cost;
  }
  let beViews55 = baseViews;
  while (beViews55 <= 50_000_000 && profitAtViews(beViews55, 55) < 0) beViews55 += 50_000;
  const beViewsSimple = Math.ceil(
    totalCost / ((CPM / 1000) * (1 - 0.55 - STRIPE) * (short.impPerView * 0.55 + long.impPerView * 0.45))
  );
  let liveBe60 = 10;
  while (liveBe60 <= 20_000) {
    const doCost = Math.max(0, liveBe60 * 0.05 * live.watchHours - 400_000) / 1_000_000 * 12.5 * FX;
    const liveCost = Math.round(liveDeliveryJpy * (liveBe60 / live.avgConcurrent) + doCost);
    const liveRev = Math.round((impLive / live.avgConcurrent) * liveBe60 * (CPM / 1000));
    const p = liveRev - Math.round(liveRev * 0.6) - liveCost - FIXED * 0.3;
    if (p >= 0) break;
    liveBe60 += 10;
  }
  const breakEven = [
    { 指標: "黒字化に必要な月間再生数（55%還元・スケールモデル）", 値: beViews55, 単位: "回/月" },
    { 指標: "黒字化に必要な月間再生数（55%還元・単純impモデル）", 値: beViewsSimple, 単位: "回/月" },
    { 指標: "現在設定の月間再生数", 値: baseViews, 単位: "回/月" },
    { 指標: "現在の判定（55%還元）", 値: profitAtViews(baseViews, 55) >= 0 ? "黒字" : "赤字", 単位: "" },
    { 指標: "ライブ同時視聴・黒字化目安（60%還元・ライブ単体）", 値: liveBe60, 単位: "人" },
    { 指標: "ライブ同時視聴・ベース設定", 値: live.avgConcurrent, 単位: "人" },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(breakEven), "Break_Even");

  const rec = [
    {
      区分: "最低",
      推奨分配率: "40%",
      理由: `立ち上げ期（月${(baseViews / 10000).toFixed(1)}万再生）。固定費¥${FIXED.toLocaleString()}が支配的。還元より黒字化優先。`,
    },
    {
      区分: "平均",
      推奨分配率: "55%",
      理由: `スケールモデルで黒字化は約${(beViews55 / 10000).toFixed(0)}万再生/月。還元と収支のバランス点。`,
    },
    {
      区分: "推奨",
      推奨分配率: "60%",
      理由: "ひろ方針「最大還元」と黒字の交点。月312万再生超で黒字維持可能な標準レート。",
    },
    {
      区分: "最大",
      推奨分配率: "65%",
      理由: "月500万再生超で黒字維持の上限目安。それ以上の還元は危険圏。",
    },
    {
      区分: "危険圏",
      推奨分配率: "70%以上",
      理由: `ベース再生では全率赤字。月1000万再生またはライブ同時${liveBe60}人超が前提。`,
    },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(rec), "Recommendation");

  const unit = [
    {
      種別: "ショート",
      月間再生: short.views,
      広告imp: Math.round(impShort),
      収入_円: Math.round(impShort * CPM / 1000),
      配信コスト_円: Math.round(videoDeliveryJpy * 0.55),
    },
    {
      種別: "通常動画",
      月間再生: long.views,
      広告imp: Math.round(impLong),
      収入_円: Math.round(impLong * CPM / 1000),
      配信コスト_円: Math.round(videoDeliveryJpy * 0.45),
    },
    {
      種別: "ライブ",
      月間視聴h: live.watchHours,
      広告imp: Math.round(impLive),
      収入_円: Math.round(impLive * CPM / 1000),
      配信コスト_円: liveDeliveryJpy,
    },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(unit), "By_Type");

  const pd = payoutDecision;
  const payoutDecisionRows = [
    { 項目: "engine_version", 値: pd.engine_version ?? ENGINE_VERSION },
    { 項目: "month", 値: pd.month },
    { 項目: "gross_revenue", 値: pd.gross_revenue },
    { 項目: "total_cost", 値: pd.total_cost },
    { 項目: "reserve_total", 値: pd.reserve_total },
    { 項目: "required_company_keep", 値: pd.required_company_keep },
    { 項目: "payout_pool", 値: pd.payout_pool },
    { 項目: "profit_before_payout", 値: pd.profit_before_payout },
    { 項目: "profit_after_payout", 値: pd.profit_after_payout },
    { 項目: "max_platform_payout_rate", 値: `${pd.max_platform_payout_rate}%` },
    { 項目: "top_creator_max", 値: pd.headcount_simulation?.top_creator_max_affordable ?? 0 },
    { 項目: "elite_max", 値: pd.headcount_simulation?.elite_max_affordable ?? 0 },
    { 項目: "safety_status", 値: pd.safety_status },
    { 項目: "total_payout", 値: pd.total_payout },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(payoutDecisionRows), "PayoutDecision");

  const rankRows = pd._creator_rows_full.map((r) => ({
    creator_id: r.creator_id,
    creator_name: r.creator_name,
    revenue_generated: r.revenue_generated,
    rank: r.rank,
    payout_rate: `${r.payout_rate}%`,
    rate_guaranteed: r.rate_guaranteed ? "YES" : "NO",
    payout_amount: r.payout_amount,
    next_rank: r.next_rank ?? "",
    gap_message: r.gap_message,
    reason: r.reason,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(rankRows), "CreatorRanks");

  const conditionLineRows = Object.entries(pd.condition_lines.ranks).map(([rank, cond]) => ({
    ランク: rank,
    還元率: `${cond.payout_rate}%`,
    最低発生収益: cond.min_monthly_revenue,
    最低再生数: cond.min_views,
    最低エンゲージメント: cond.min_engagement_score,
    最低ライブh: cond.min_live_hours ?? 0,
    プラットフォーム最低総収益: cond.min_platform_gross_revenue ?? "",
    今月最大人数: cond.max_slots ?? "",
    達成後保証: cond.rate_guaranteed_on_achievement ? "YES" : "NO",
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(conditionLineRows), "ConditionLines");

  const progressRows = pd.creator_payouts.map((p) => ({
    creator_name: p.creator_name,
    rank: p.rank,
    payout_rate: `${p.payout_rate}%`,
    next_rank: p.next_rank ?? "最高",
    gap_revenue: p.gap_to_next_rank?.monthly_revenue ?? 0,
    gap_views: p.gap_to_next_rank?.views ?? 0,
    gap_message: p.gap_message,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(progressRows), "RankProgress");

  const stripeRows = pd._creator_rows_full
    .filter((r) => r.payout_amount > 0)
    .map((r) => ({
      creator_id: r.creator_id,
      creator_name: r.creator_name,
      stripe_connect_account_id: r.stripe_connect_account_id,
      payout_amount_jpy: r.payout_amount,
      currency: "jpy",
      description: `TLV ${pd.month} creator revenue share`,
      internal_note: `${r.rank} / ${r.payout_rate}%${r.rate_guaranteed ? " guaranteed" : ""}`,
    }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(stripeRows), "StripeConnectExport");

  const operatorRows = [
    { セクション: "エンジン", 内容: `Ver ${pd.engine_version ?? ENGINE_VERSION}` },
    { セクション: "収益", 内容: yen(pd.gross_revenue) },
    { セクション: "コスト", 内容: yen(pd.total_cost) },
    { セクション: "会社に残す金額", 内容: yen(pd.required_company_keep) },
    { セクション: "還元可能額", 内容: yen(pd.payout_pool) },
    { セクション: "最大還元率（加重）", 内容: `${pd.max_platform_payout_rate}%` },
    { セクション: "Top Creator 上限人数", 内容: pd.headcount_simulation?.top_creator_max_affordable ?? 0 },
    { セクション: "Elite Creator 上限人数", 内容: pd.headcount_simulation?.elite_max_affordable ?? 0 },
    { セクション: "安全ステータス", 内容: pd.safety_status },
    { セクション: "AI運営コメント", 内容: pd.operator_comment.replace(/\n/g, " / ") },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(operatorRows), "OperatorReport");

  const thresholdRows = thresholdAnalysis.thresholds.map((t) => ({
    目標還元率: `${t.target_rate}%`,
    適用ランク: t.applies_to_tier,
    必要月間総収益_円: t.required_monthly_gross_revenue,
    必要還元プール_円: t.required_payout_pool,
    必要分配前利益_円: t.required_profit_before_payout,
    会社に残す金額_円: t.company_keep_amount,
    最大適用人数: t.max_creators_at_target_rate,
    特別1人_必要総収益_円: t.top_contributor_one?.required_monthly_gross_revenue ?? "",
    特別複数_必要総収益_円: t.top_contributor_multiple?.required_monthly_gross_revenue ?? "",
    参照月達成可否: t.current_month.achievable ? "達成可能" : "未達",
    参照月収益ギャップ_円: t.current_month.revenue_gap,
    保証ルール: t.guarantee_rule ?? "",
    LP見出し: t.lp_copy?.headline ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(thresholdRows), "HighPayoutThresholds");

  const residual = payoutDecision.residual_pool_allocation;
  const residualRows = [
    ...residual.guaranteed_layer.payouts.map((p) => ({
      層: "guaranteed",
      creator_name: p.creator_name,
      rank: p.rank,
      original_rate: p.guaranteed_rate,
      adjusted_rate: p.guaranteed_rate,
      gross_creator_revenue: p.gross_creator_revenue,
      payout_amount: p.payout_amount,
      adjustment_reason: p.adjustment_reason,
    })),
    ...residual.variable_layer.payouts.map((p) => ({
      層: "variable",
      creator_name: p.creator_name,
      rank: p.rank,
      original_rate: p.original_rate,
      adjusted_rate: p.adjusted_rate,
      gross_creator_revenue: p.gross_creator_revenue,
      payout_amount: p.payout_amount,
      adjustment_reason: p.adjustment_reason,
    })),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(residualRows), "ResidualPoolAllocation");

  const residualSummaryRows = [
    { 項目: "payout_pool", 値: residual.payout_pool },
    { 項目: "guaranteed_total", 値: residual.guaranteed_layer.total },
    { 項目: "residual_pool", 値: residual.residual_pool },
    { 項目: "variable_total", 値: residual.variable_layer.total },
    { 項目: "allocation_mode", 値: residual.variable_layer.allocation_mode },
    { 項目: "variable_scale", 値: residual.variable_layer.variable_scale },
    { 項目: "narrative", 値: residual.summary.narrative },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(residualSummaryRows), "ResidualPoolSummary");

  const creatorExplain = buildCreatorRankExplanationReport(payoutDecision);
  const creatorExplainRows = creatorExplain.creators.map((c) => ({
    creator_id: c.creator_id,
    creator_name: c.creator_name,
    current_rank: c.current_rank,
    original_rate: c.original_rate,
    adjusted_rate: c.adjusted_rate,
    payout_amount: c.payout_amount,
    gross_creator_revenue: c.gross_creator_revenue,
    next_rank: c.next_rank ?? "",
    next_rank_required_revenue: c.next_rank_required_revenue ?? "",
    gap_to_next_rank: c.gap_to_next_rank,
    adjustment_reason: c.adjustment_reason,
    guarantee_status: c.guarantee_status,
    gap_message: c.gap_message,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(creatorExplainRows), "CreatorRankExplanation");

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(finalSpecToExcelRows(finalSpec)),
    "PayoutEngineV2Spec"
  );

  return wb;
}

function writeJsonOutput(decision) {
  const { _creator_rows_full, _alloc_meta, ...publicDecision } = decision;
  const outPath = path.join(OUTPUT_DIR, "monthly-payout-decision.json");
  fs.writeFileSync(outPath, JSON.stringify(publicDecision, null, 2) + "\n", "utf8");
  return outPath;
}

function writeConditionLinesOutput(decision) {
  const outPath = path.join(OUTPUT_DIR, "condition-lines.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        engine_version: decision.engine_version,
        month: decision.month,
        philosophy: decision.philosophy,
        condition_lines: decision.condition_lines,
        marketing_copy: decision.marketing_copy,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  return outPath;
}

function writeRankProgressOutput(decision) {
  const report = buildRankProgressReport(decision);
  const outPath = path.join(OUTPUT_DIR, "rank-progress.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return outPath;
}

function writeResidualPoolOutputs(decision) {
  const report = decision.residual_pool_allocation;
  const jsonPath = path.join(OUTPUT_DIR, "residual-pool-allocation.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  const mdPath = path.join(OUT_DIR, "residual-pool-allocation.md");
  fs.writeFileSync(mdPath, formatResidualPoolMarkdown(report), "utf8");
  return { jsonPath, mdPath };
}

function writeCreatorRankExplanationOutputs(decision) {
  const report = buildCreatorRankExplanationReport(decision);
  const jsonPath = path.join(OUTPUT_DIR, "creator-rank-explanation.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  const mdPath = path.join(OUT_DIR, "creator-rank-explanation.md");
  fs.writeFileSync(mdPath, formatCreatorRankExplanationMarkdown(report), "utf8");
  return { jsonPath, mdPath, report };
}

function writeFinalSpecOutputs(finalSpec) {
  const jsonPath = path.join(OUTPUT_DIR, "payout-engine-v2-final-spec.json");
  fs.writeFileSync(jsonPath, JSON.stringify(finalSpec, null, 2) + "\n", "utf8");
  const mdPath = path.join(OUT_DIR, "payout-engine-v2-final-spec.md");
  fs.writeFileSync(mdPath, formatPayoutEngineV2FinalSpecMarkdown(finalSpec), "utf8");
  return { jsonPath, mdPath };
}

function writeCsvOutput(decision) {
  const headers = [
    "creator_id",
    "creator_name",
    "stripe_connect_account_id",
    "payout_amount_jpy",
    "currency",
    "description",
    "internal_note",
  ];
  const lines = [headers.join(",")];
  for (const r of decision._creator_rows_full.filter((x) => x.payout_amount > 0)) {
    lines.push(
      [
        csvEscape(r.creator_id),
        csvEscape(r.creator_name),
        csvEscape(r.stripe_connect_account_id),
        r.payout_amount,
        "jpy",
        csvEscape(`TLV ${decision.month} creator revenue share`),
        csvEscape(`${r.rank} / ${r.payout_rate}%`),
      ].join(",")
    );
  }
  const outPath = path.join(OUTPUT_DIR, "stripe-connect-payouts.csv");
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  return outPath;
}

function writeOperatorReportMd(decision) {
  const topCreators = decision._creator_rows_full.filter((r) => r.rank === "Top Creator");
  const eliteCreators = decision._creator_rows_full.filter((r) => r.rank === "Elite Creator");
  const cl = decision.condition_lines;

  const md = `# TLV 月次運営レポート（${decision.month}）— エンジン Ver2

> **Ver2 方針:** 全員同一還元率・毎月固定○%は禁止。AI は **条件ライン** を調整し、Top/Elite 条件達成者の還元率は **保証**（引き下げなし）。
> 目的: ${decision.philosophy}

---

## 今月の収益・コスト

| 項目 | 金額 |
|------|------|
| 総広告収益 | ${yen(decision.gross_revenue)} |
| 総コスト | ${yen(decision.total_cost)} |
| 会社確保額 | ${yen(decision.required_company_keep)} |
| 還元プール | ${yen(decision.payout_pool)} |
| 還元合計 | ${yen(decision.total_payout)} |
| 還元後利益 | ${yen(decision.profit_after_payout)} |
| 安全ステータス | \`${decision.safety_status}\` |
| 最大還元率（加重） | ${decision.max_platform_payout_rate}% |

---

## 条件ライン（AI が今月設定）

| ランク | 還元率 | 最低発生収益 | 達成後保証 |
|--------|--------|-------------|-----------|
| Starter | 28% | ¥0 | — |
| Creator | 38% | ¥${cl.ranks.Creator.min_monthly_revenue.toLocaleString("ja-JP")} | — |
| Pro | 48% | ¥${cl.ranks.Pro.min_monthly_revenue.toLocaleString("ja-JP")} | — |
| Top Creator | 70% | ¥${cl.ranks["Top Creator"].min_monthly_revenue.toLocaleString("ja-JP")} | **YES** |
| Elite Creator | 80% | ¥${cl.ranks["Elite Creator"].min_monthly_revenue.toLocaleString("ja-JP")} | **YES** |

**今月の特別ランク上限:** Top Creator ${cl.headcount_simulation.top_creator_max_affordable} 名 / Elite ${cl.headcount_simulation.elite_max_affordable} 名

---

## クリエイター別（個別還元）

| クリエイター | ランク | 還元率 | 保証 | 次ランクまで |
|-------------|--------|--------|------|-------------|
${decision._creator_rows_full
  .map(
    (r) =>
      `| ${r.creator_name} | ${r.rank} | ${r.payout_rate}% | ${r.rate_guaranteed ? "YES" : "—"} | ${r.gap_message} |`
  )
  .join("\n")}

---

## Top Creator / Elite Creator

${eliteCreators.length ? eliteCreators.map((e) => `- **${e.creator_name}**: Elite 80% 保証 — ${yen(e.payout_amount)}`).join("\n") : "- Elite Creator 該当者なし（条件ライン未達または人数上限）"}

${topCreators.length ? topCreators.map((t) => `- **${t.creator_name}**: Top 70% 保証 — ${yen(t.payout_amount)}`).join("\n") : "- Top Creator 該当者なし"}

---

## マーケティング用（公開）

- ${decision.marketing_copy.public_wording}
- ${decision.marketing_copy.top_creator}
- ${decision.marketing_copy.elite_creator}
- ${decision.marketing_copy.disclaimer}

---

## AI 運営コメント

\`\`\`
${decision.operator_comment}
\`\`\`

---

## 送金前チェックリスト

- [ ] \`safety_status\` 確認
- [ ] Top/Elite 保証対象者の条件達成記録
- [ ] 保証還元は引き下げていないこと
- [ ] CSV は送金候補のみ（実送金は別フロー）

*Generated by \`scripts/generate-tlv-business-simulator.mjs\`*
`;

  const outPath = path.join(OUTPUT_DIR, "monthly-operator-report.md");
  fs.writeFileSync(outPath, md, "utf8");
  return outPath;
}

function writeThresholdOutputs(thresholdAnalysis) {
  const jsonPath = path.join(OUTPUT_DIR, "high-payout-thresholds.json");
  fs.writeFileSync(jsonPath, JSON.stringify(thresholdAnalysis, null, 2) + "\n", "utf8");

  const mdPath = path.join(OUT_DIR, "high-payout-threshold-analysis.md");
  fs.writeFileSync(mdPath, formatThresholdMarkdown(thresholdAnalysis), "utf8");

  return { jsonPath, mdPath };
}

function verifyCreatorRankExplanation() {
  const creators = defaultSampleCreators();
  const decision = runPayoutDecision(defaultMonthlyInputs(), creators);
  const report = buildCreatorRankExplanationReport(decision);

  if (report.creators.length !== decision.creator_payouts.length) {
    throw new Error("creator-rank-explanation count mismatch");
  }

  for (let i = 0; i < report.creators.length; i++) {
    const e = report.creators[i];
    const p = decision.creator_payouts.find((x) => x.creator_id === e.creator_id);
    if (!p) throw new Error(`Missing payout for ${e.creator_id}`);
    if (e.payout_amount !== p.payout_amount) {
      throw new Error(`payout_amount mismatch for ${e.creator_id}`);
    }
    if (e.original_rate !== p.original_rate || e.adjusted_rate !== p.adjusted_rate) {
      throw new Error(`rate mismatch for ${e.creator_id}`);
    }
    const expectedStatus = p.rate_guaranteed ? "guaranteed" : "variable";
    if (e.guarantee_status !== expectedStatus) {
      throw new Error(`guarantee_status mismatch for ${e.creator_id}`);
    }
    if (p.rank === "Top Creator" || p.rank === "Elite Creator") {
      if (e.guarantee_status !== "guaranteed") {
        throw new Error(`Top/Elite must be guaranteed: ${e.creator_id}`);
      }
    } else if (e.guarantee_status !== "variable") {
      throw new Error(`General rank must be variable: ${e.creator_id}`);
    }
  }

  const high = runPayoutDecision(
    {
      ...defaultMonthlyInputs(),
      total_ad_revenue: 1_200_000,
      short_revenue: 550_000,
      normal_video_revenue: 530_000,
      live_revenue: 120_000,
      stripe_fee: 43_200,
    },
    creators
  );
  const highReport = buildCreatorRankExplanationReport(high);
  const eliteOrTop = highReport.creators.filter(
    (c) => c.current_rank === "Top Creator" || c.current_rank === "Elite Creator"
  );
  for (const c of eliteOrTop) {
    if (c.guarantee_status !== "guaranteed") {
      throw new Error(`High revenue Top/Elite not guaranteed: ${c.creator_name}`);
    }
  }

  return { ok: true, creator_count: report.creators.length, high_special: eliteOrTop.length };
}

function verifyResidualPoolAllocation() {
  const creators = defaultSampleCreators();

  const highInputs = {
    ...defaultMonthlyInputs(),
    total_ad_revenue: 1_200_000,
    short_revenue: 550_000,
    normal_video_revenue: 530_000,
    live_revenue: 120_000,
    stripe_fee: 43_200,
  };
  const high = runPayoutDecision(highInputs, creators);
  const highResidual = high.residual_pool_allocation;
  const guaranteedRateValues = new Set(Object.values(getGuaranteedRates()));
  for (const g of highResidual.guaranteed_layer.payouts) {
    if (!guaranteedRateValues.has(g.guaranteed_rate)) {
      throw new Error(`Guaranteed rate not preserved: ${g.creator_name}`);
    }
    if (g.payout_amount !== Math.round(g.gross_creator_revenue * (g.guaranteed_rate / 100))) {
      throw new Error(`Guaranteed payout mismatch: ${g.creator_name}`);
    }
  }
  for (const v of highResidual.variable_layer.payouts) {
    if (v.adjusted_rate > v.original_rate + 0.01) {
      throw new Error(`Variable rate exceeded original: ${v.creator_name}`);
    }
  }

  const normal = runPayoutDecision(defaultMonthlyInputs(), creators);
  const normalResidual = normal.residual_pool_allocation;
  if (normalResidual.guaranteed_layer.count !== 0) {
    throw new Error("Expected zero guaranteed in base sample month");
  }
  if (normalResidual.variable_layer.count !== creators.length) {
    throw new Error("Expected all creators in variable layer when no Top/Elite");
  }
  const decisionTotal = normal.creator_payouts.reduce((s, p) => s + p.payout_amount, 0);
  if (decisionTotal !== normalResidual.summary.total_payout) {
    throw new Error("residual-pool-allocation.json inconsistent with monthly-payout-decision.json");
  }

  return {
    ok: true,
    high_guaranteed: highResidual.guaranteed_layer.count,
    normal_variable_only: normalResidual.variable_layer.count,
  };
}

function verifyGuaranteeRule() {
  const highInputs = {
    ...defaultMonthlyInputs(),
    total_ad_revenue: 1_200_000,
    short_revenue: 550_000,
    normal_video_revenue: 530_000,
    live_revenue: 120_000,
    stripe_fee: 43_200,
  };
  const creators = defaultSampleCreators();
  const result = runPayoutDecision(highInputs, creators);
  const guaranteed = result._creator_rows_full.filter((r) => r.rate_guaranteed);
  if (guaranteed.length === 0) {
    throw new Error("Expected at least one guaranteed Top/Elite creator in high-revenue scenario");
  }
  for (const g of guaranteed) {
    const expected = Math.round(g.revenue_generated * (g.payout_rate / 100));
    if (g.payout_amount !== expected) {
      throw new Error(`Guarantee violated for ${g.creator_name}: ${g.payout_rate}% not preserved`);
    }
    if (g.pool_adjusted) {
      throw new Error(`Guaranteed creator ${g.creator_name} was pool-adjusted`);
    }
  }
  return { ok: true, guaranteed_count: guaranteed.length };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const monthlyInputs = defaultMonthlyInputs();
  const creators = defaultSampleCreators();
  const payoutDecision = runPayoutDecision(monthlyInputs, creators);
  const thresholdAnalysis = runHighPayoutThresholdAnalysis(
    monthlyInputs,
    creators,
    payoutDecision
  );

  const jsonPath = writeJsonOutput(payoutDecision);
  const conditionPath = writeConditionLinesOutput(payoutDecision);
  const rankProgressPath = writeRankProgressOutput(payoutDecision);
  const { jsonPath: residualJsonPath, mdPath: residualMdPath } =
    writeResidualPoolOutputs(payoutDecision);
  const { jsonPath: creatorExplainJsonPath, mdPath: creatorExplainMdPath } =
    writeCreatorRankExplanationOutputs(payoutDecision);
  const csvPath = writeCsvOutput(payoutDecision);
  const mdPath = writeOperatorReportMd(payoutDecision);
  const { jsonPath: thresholdJsonPath, mdPath: thresholdMdPath } =
    writeThresholdOutputs(thresholdAnalysis);

  const baseline = runPayoutDecision(baselineMonthlyInputs(), creators.slice(0, 3));
  const verify = verifyGuaranteeRule();
  const residualVerify = verifyResidualPoolAllocation();
  const creatorExplainVerify = verifyCreatorRankExplanation();

  const finalSpec = buildPayoutEngineV2FinalSpec({
    guarantee_rule: verify,
    residual_pool: residualVerify,
    creator_rank_explanation: creatorExplainVerify,
    baseline_safety_status: baseline.safety_status,
    reference_month: payoutDecision.month,
    all_pass:
      verify.ok && residualVerify.ok && creatorExplainVerify.ok,
  });
  const { jsonPath: finalSpecJsonPath, mdPath: finalSpecMdPath } =
    writeFinalSpecOutputs(finalSpec);

  const wb = buildWorkbook(payoutDecision, thresholdAnalysis, finalSpec);
  const XLSX = loadXlsx();
  const xlsxPath = path.join(OUT_DIR, "tlv-business-simulator.xlsx");
  XLSX.writeFile(wb, xlsxPath);

  console.log("TLV Business Simulator — generated (Ver2):");
  console.log("  Excel:", xlsxPath);
  console.log("  JSON:", jsonPath);
  console.log("  Condition lines:", conditionPath);
  console.log("  Rank progress:", rankProgressPath);
  console.log("  Residual pool JSON:", residualJsonPath);
  console.log("  Residual pool MD:", residualMdPath);
  console.log("  Creator explain JSON:", creatorExplainJsonPath);
  console.log("  Creator explain MD:", creatorExplainMdPath);
  console.log("  CSV:", csvPath);
  console.log("  Markdown:", mdPath);
  console.log("  Threshold JSON:", thresholdJsonPath);
  console.log("  Threshold MD:", thresholdMdPath);
  console.log("  Final spec JSON:", finalSpecJsonPath);
  console.log("  Final spec MD:", finalSpecMdPath);
  console.log("");
  console.log("High payout required gross revenue (sample creator mix):");
  for (const t of thresholdAnalysis.thresholds) {
    console.log(
      `  ${t.target_rate}%: ¥${t.required_monthly_gross_revenue.toLocaleString("ja-JP")} (pool ¥${t.required_payout_pool.toLocaleString("ja-JP")})`
    );
  }
  console.log("");
  console.log("Payout decision summary:");
  console.log("  engine:", payoutDecision.engine_version);
  console.log("  month:", payoutDecision.month);
  console.log("  safety_status:", payoutDecision.safety_status);
  console.log("  max_platform_payout_rate:", payoutDecision.max_platform_payout_rate + "%");
  console.log("  top_creator_slots:", payoutDecision.headcount_simulation.top_creator_max_affordable);
  console.log("  elite_slots:", payoutDecision.headcount_simulation.elite_max_affordable);
  console.log("  payout_pool:", payoutDecision.payout_pool);
  console.log("  total_payout:", payoutDecision.total_payout);
  console.log("");
  console.log("Baseline (low revenue) safety:", baseline.safety_status);
  console.log("Guarantee rule verify:", verify.ok ? `PASS (${verify.guaranteed_count} guaranteed)` : "FAIL");
  console.log(
    "Residual pool verify:",
    residualVerify.ok
      ? `PASS (high: ${residualVerify.high_guaranteed} guaranteed, normal: ${residualVerify.normal_variable_only} variable-only)`
      : "FAIL"
  );
  console.log(
    "Creator rank explanation verify:",
    creatorExplainVerify.ok
      ? `PASS (${creatorExplainVerify.creator_count} creators, ${creatorExplainVerify.high_special} Top/Elite in high scenario)`
      : "FAIL"
  );
  console.log("Ver2 final spec:", finalSpec.spec_version, "| all_pass:", finalSpec.verification_last_run.all_pass);
}

main();
