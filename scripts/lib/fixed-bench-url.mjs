/**
 * 2窓ベンチ検証 — 親URL固定（これ以外での OK 報告禁止）
 *
 * 親ページは常にこのURLのみ。reset / reconcile / iframe 遷移はページ内部で処理する。
 * ユーザーに liveFlowReset / benchReconcile / 別URL の使い分けはさせない。
 */
import { BASE_URL } from "./dev-base-url.mjs";

/** 親URLに含めてはいけないパラメータ（内部処理用・検証URLに禁止） */
export const FORBIDDEN_PARENT_BENCH_PARAMS = Object.freeze([
  "liveFlowReset",
  "benchReconcile",
]);

/** 全カテゴリ共通の親クエリ（benchPattern / demoProfile はパターン別） */
export const FIXED_BENCH_PARENT_QUERY = Object.freeze({
  talkDev: "1",
  review: "chat-demo",
  demoConnect: "0",
  liveFlow: "1",
  userId: "u_hiro",
  benchViewport: "390",
});

const PATTERNS = Object.freeze({
  "worker-0": { demoProfile: "worker", expectedNotifyTitle: "依頼が届きました" },
  "job-0": { demoProfile: "job", expectedNotifyTitle: "応募が承諾されました" },
  "general-0": { demoProfile: "general", expectedNotifyTitle: "依頼が届きました" },
});

/**
 * @param {string} [origin]
 * @param {"worker-0"|"job-0"} benchPattern
 */
export function buildFixedBenchParentUrl(origin = BASE_URL, benchPattern = "worker-0") {
  const spec = PATTERNS[benchPattern] || PATTERNS["worker-0"];
  const base = String(origin || BASE_URL).replace(/\/$/, "");
  const q = new URLSearchParams({
    ...FIXED_BENCH_PARENT_QUERY,
    benchPattern,
    demoProfile: spec.demoProfile,
  });
  return `${base}/chat-dual-window-demo.html?${q.toString()}`;
}

/** @param {string} [origin] */
export function fixedWorkerBenchUrl(origin = BASE_URL) {
  return buildFixedBenchParentUrl(origin, "worker-0");
}

/** @param {string} [origin] */
export function fixedJobBenchUrl(origin = BASE_URL) {
  return buildFixedBenchParentUrl(origin, "job-0");
}

/** @param {string} [origin] */
export function fixedGeneralBenchUrl(origin = BASE_URL) {
  return buildFixedBenchParentUrl(origin, "general-0");
}

export const FIXED_WORKER_BENCH_PATH = (() => {
  const q = new URLSearchParams({
    ...FIXED_BENCH_PARENT_QUERY,
    benchPattern: "worker-0",
    demoProfile: "worker",
  });
  return `/chat-dual-window-demo.html?${q.toString()}`;
})();

export const FIXED_WORKER_EXPECTED_NOTIFY_TITLE = PATTERNS["worker-0"].expectedNotifyTitle;

export const FIXED_JOB_EXPECTED_CHAT_STARTED_TITLE = PATTERNS["job-0"].expectedNotifyTitle;

/**
 * 親URLが固定形か（禁止パラメータなし）
 * @param {string} url
 */
export function isCanonicalBenchParentUrl(url) {
  try {
    const u = new URL(url, "http://localhost/");
    if (!u.pathname.endsWith("chat-dual-window-demo.html")) return false;
    for (const key of FORBIDDEN_PARENT_BENCH_PARAMS) {
      if (u.searchParams.has(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
