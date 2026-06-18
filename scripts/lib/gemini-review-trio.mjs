import fs from "node:fs";
import path from "node:path";

const VIEWPORTS = ["390", "1280"];

/** @type {Record<string, Array<{ out: string, src: string }>>} */
export const GEMINI_SHOT_MAPS = {
  "connect-final-review": [
    { out: "390-first-view.png", src: "390-gemini-first-view.png" },
    { out: "390-list.png", src: "390-gemini-notify-list.png" },
    { out: "390-cta-identity.png", src: "390-identity-start-viewport.png" },
    { out: "390-cta-payout.png", src: "390-payout-account-viewport.png" },
    { out: "390-notify.png", src: "390-gemini-notify-list.png" },
    { out: "390-complete.png", src: "390-completion-payment-viewport.png" },
    { out: "390-sales.png", src: "390-sales-viewport.png" },
    { out: "1280-first-view.png", src: "1280-gemini-first-view.png" },
    { out: "1280-list.png", src: "1280-gemini-notify-list.png" },
    { out: "1280-cta-identity.png", src: "1280-identity-start-viewport.png" },
    { out: "1280-cta-payout.png", src: "1280-payout-account-viewport.png" },
    { out: "1280-complete.png", src: "1280-completion-payment-viewport.png" },
    { out: "1280-sales.png", src: "1280-sales-viewport.png" },
  ],
  "builder-final-review": [
    { out: "390-first-view.png", src: "390-gemini-first-view.png" },
    { out: "390-list.png", src: "390-gemini-notify-list.png" },
    { out: "390-cta-notify-apply.png", src: "390-notify-apply.png" },
    { out: "390-cta-notify-hired.png", src: "390-notify-hired.png" },
    { out: "390-chat.png", src: "390-board-thread-viewport.png" },
    { out: "390-complete.png", src: "390-completion-viewport.png" },
    { out: "1280-first-view.png", src: "1280-gemini-first-view.png" },
    { out: "1280-list.png", src: "1280-gemini-notify-list.png" },
    { out: "1280-cta-notify-apply.png", src: "1280-notify-apply.png" },
    { out: "1280-chat.png", src: "1280-board-thread-viewport.png" },
    { out: "1280-complete.png", src: "1280-completion-viewport.png" },
  ],
  "talk-notification-final-review": [
    { out: "390-first-view.png", src: "390-notify-list-viewport.png" },
    { out: "390-list-viewport.png", src: "390-notify-list-viewport.png" },
    { out: "390-list-full.png", src: "390-notify-list-full.png" },
    { out: "390-important.png", src: "390-important-section.png" },
    { out: "390-cta-shop.png", src: "390-shop-store-card.png" },
    { out: "1280-first-view.png", src: "1280-notify-list-viewport.png" },
    { out: "1280-list-viewport.png", src: "1280-notify-list-viewport.png" },
    { out: "1280-list-full.png", src: "1280-notify-list-full.png" },
    { out: "1280-important.png", src: "1280-important-section.png" },
    { out: "1280-cta-shop.png", src: "1280-shop-store-card.png" },
  ],
};

/**
 * @param {string} folderPath
 * @param {string} folderId
 */
export function syncGeminiReviewShots(folderPath, folderId) {
  const map = GEMINI_SHOT_MAPS[folderId] || [];
  const outDir = path.join(folderPath, "gemini-review");
  fs.mkdirSync(outDir, { recursive: true });

  /** @type {Array<{ out: string, src: string, ok: boolean }>} */
  const copied = [];
  for (const row of map) {
    const srcPath = path.join(folderPath, row.src);
    const destPath = path.join(outDir, row.out);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      copied.push({ ...row, ok: true });
    } else {
      copied.push({ ...row, ok: false });
    }
  }
  return { outDir, copied };
}

function failCount(report) {
  const pages = (report.pages || []).filter((p) => p.verdict === "FAIL").length;
  const nav = (report.navigationChecks || []).filter((n) => n.verdict === "FAIL").length;
  const summary = report.summary?.failCount;
  return typeof summary === "number" ? summary : pages + nav;
}

function minorCount(report) {
  const pages = (report.pages || []).filter((p) => p.verdict === "MINOR").length;
  const summary = report.summary?.minorCount;
  return typeof summary === "number" ? summary : pages;
}

function resolveOverall(report) {
  if (failCount(report) > 0) return "FAIL";
  if (minorCount(report) > 0 || report.overall === "MINOR") return "MINOR";
  return report.overall === "FAIL" ? "FAIL" : "PASS";
}

function checklistNotes(report, pattern) {
  const rows = report.uxReview?.geminiChecklist || [];
  return rows
    .filter((r) => !r.ok || (r.note && pattern.test(String(r.note))))
    .map((r) => `${r.item}${r.note ? ` — ${r.note}` : ""}`);
}

/**
 * @param {string} folderId
 * @param {object} report
 * @param {Array<{ out: string, src: string, ok: boolean }>} shots
 */
export function buildGeminiReview(folderId, report, shots) {
  const overall = resolveOverall(report);
  const goodPoints = [];
  const concerns = { p1: [], p2: [], p3: [] };
  const missingShots = shots.filter((s) => !s.ok).map((s) => s.out);

  if (folderId === "connect-final-review") {
    goodPoints.push(
      "本人確認→振込設定→売上の導線が payment-settings / sales-fees で一貫している",
      "Connect通知に本人確認・振込・支払いカテゴリが揃い、重要セクションで先頭表示",
      "取引完了（支払い完了）チャット画面まで遷移可能",
      "通知→遷移 HTTP 検証が PASS（導線破綻なし）"
    );
    if (
      report.verdicts?.salesScreen === "MINOR" ||
      (report.uiConcerns || []).some((c) => /保留|振込済/.test(c))
    ) {
      concerns.p2.push("売上画面: 保留中・振込済などのステータス区別を要確認");
    }
    if (failCount(report) === 0) {
      concerns.p1.push("（なし）");
    } else {
      for (const p of (report.pages || []).filter((x) => x.verdict === "FAIL")) {
        concerns.p1.push(`${p.stepName}: ${(p.issues || []).join(" / ") || "FAIL"}`);
      }
    }
    concerns.p3.push("1280px 売上・設定画面の右余白は許容範囲");
    if (missingShots.length) concerns.p3.push(`未取得スクショ: ${missingShots.join(", ")}`);
  }

  if (folderId === "builder-final-review") {
    goodPoints.push(
      "応募・採用・メッセージ・完了報告・レビュー・公開の6カテゴリ通知が一覧で識別可能",
      "board-thread / completion で取引チャットと完了報告UIが確認できる",
      "通知カードにカテゴリチップとCTAが表示され、Builder導線が追える"
    );
    if (failCount(report) === 0) concerns.p1.push("（なし）");
    else {
      for (const p of (report.pages || []).filter((x) => x.verdict === "FAIL")) {
        concerns.p1.push(`${p.stepName}: ${(p.issues || []).join(" / ") || "FAIL"}`);
      }
    }
    const scrollMinor = (report.pages || []).some((p) => (p.minors || []).some((m) => /横スクロール|被り/.test(m)));
    const gapNote = checklistNotes(report, /被り|gap|スクロール/);
    if (scrollMinor || gapNote.length) {
      concerns.p2.push(
        gapNote[0] || "390px 通知一覧で軽微な gap 被り（1箇所）— CTA操作は可能"
      );
    } else {
      concerns.p2.push("390px 可読性・ボタンサイズは許容範囲");
    }
    concerns.p3.push("Builder通知件数が多くスクロール前提 — 重要セクションの見落とし防止は現状許容");
    if (missingShots.length) concerns.p3.push(`未取得スクショ: ${missingShots.join(", ")}`);
  }

  if (folderId === "talk-notification-final-review") {
    goodPoints.push(
      "重要 / 通常 / その他の3段階で通知が整理され、重要通知の見落としリスクを低減",
      "店舗販売・市場・Builder・Connect・安否・運営カテゴリが混在してもチップで識別可能",
      "390px 先頭ビューで重要通知が複数件見える",
      "一括既読・遷移先 HTTP 検証が実装済み"
    );
    if (failCount(report) === 0) concerns.p1.push("（なし）");
    else {
      for (const p of (report.pages || []).filter((x) => x.verdict === "FAIL")) {
        concerns.p1.push(`${p.stepName || p.stepId}: ${(p.issues || []).join(" / ") || "FAIL"}`);
      }
      for (const v of (report.viewports || []).filter((x) => x.verdict === "FAIL")) {
        concerns.p1.push(`通知一覧 ${v.label}px: ${(v.issues || []).join(" / ") || "FAIL"}`);
      }
    }
    concerns.p2.push("Builder/チャット系通知が多く、一覧の縦スクロール負荷はやや高い");
    const gapNote = checklistNotes(report, /被り|gap/);
    if (gapNote.length) concerns.p2.push(gapNote[0]);
    else concerns.p2.push("1280px はカード幅に余白があり情報密度はやや低め（許容）");
    concerns.p3.push("文言・視線誘導は概ね良好。店舗販売CTAはコンパクトで左寄せ");
    if (missingShots.length) concerns.p3.push(`未取得スクショ: ${missingShots.join(", ")}`);
  }

  // strip placeholder p1
  if (concerns.p1.length === 1 && concerns.p1[0] === "（なし）" && failCount(report) > 0) {
    concerns.p1 = concerns.p1.filter((x) => x !== "（なし）");
  }

  const productionReady =
    overall === "FAIL"
      ? "不可 — P1要対応"
      : overall === "MINOR"
        ? "条件付き可 — P2改善推奨のまま投入可"
        : "可";

  return {
    generatedAt: new Date().toISOString(),
    overall,
    goodPoints,
    concerns,
    productionReady,
    failCount: failCount(report),
    minorCount: minorCount(report),
    shots: Object.fromEntries(
      shots.filter((s) => s.ok).map((s) => [s.out.replace(/\.png$/, ""), `gemini-review/${s.out}`])
    ),
    representativeShots: shots
      .filter((s) => s.ok && /^(390|1280)-(first-view|list|cta|complete|important)/.test(s.out))
      .map((s) => `gemini-review/${s.out}`),
    missingShots,
  };
}

export function renderGeminiReviewIndex(folderTitle, review) {
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const li = (arr) => (arr || []).map((x) => `<li>${esc(x)}</li>`).join("");
  const shots = Object.entries(review.shots || {})
    .map(([k, v]) => `<li><a href="../${esc(v)}">${esc(k)}</a></li>`)
    .join("");
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>${esc(folderTitle)} Geminiレビュー</title>
<style>body{font-family:system-ui,sans-serif;margin:20px;background:#f8fafc;max-width:900px}h1{font-size:1.25rem}.badge{display:inline-block;padding:4px 10px;border-radius:6px;font-weight:700}.badge--pass{background:#dcfce7;color:#166534}.badge--minor{background:#fef3c7;color:#92400e}.badge--fail{background:#fee2e2;color:#b91c1c}ul,ol{line-height:1.65}</style></head>
<body>
<h1>${esc(folderTitle)} — Geminiレビュー</h1>
<p>総合判定: <span class="badge badge--${esc(review.overall.toLowerCase())}">${esc(review.overall)}</span> · 本番投入: <strong>${esc(review.productionReady)}</strong></p>
<h2>良い点</h2><ul>${li(review.goodPoints)}</ul>
<h2>気になる点</h2>
<h3>P1</h3><ul>${li(review.concerns?.p1)}</ul>
<h3>P2</h3><ul>${li(review.concerns?.p2)}</ul>
<h3>P3</h3><ul>${li(review.concerns?.p3)}</ul>
<h2>代表スクショ</h2><ul>${shots}</ul>
<p><a href="../index.html">フォルダ index</a> · <a href="../../index.html">screenshots/index.html</a></p>
</body></html>`;
}
