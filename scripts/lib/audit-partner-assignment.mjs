/**
 * partner-assignment.html — 案件確認・受諾判断を監査
 */

/** @typedef {{ projectId: string, title: string, summary?: string, reward?: string, access?: string, expectDenied?: boolean }} PartnerAssignmentExpect */

export const BUILDER_DEMO_ASSIGNMENT_PROJECT = Object.freeze({
  projectId: "builder_demo_001",
  title: "店舗内装リニューアル（Builder）",
  summary: "店舗内装リニューアル一式（設計・施工・仕上げ）",
  reward: "¥980,000",
  access: "B1F 搬入口から入場",
});

/**
 * @param {import('playwright').Page} page
 * @param {PartnerAssignmentExpect} expect
 */
export async function auditPartnerAssignmentPage(page, expect) {
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 20000 });
  await page.waitForTimeout(800);

  const audit = await page.evaluate((exp) => {
    const issues = [];
    const url = new URL(location.href);
    const urlProjectId = String(
      url.searchParams.get("projectId") || url.searchParams.get("project_id") || ""
    ).trim();

    if (urlProjectId !== exp.projectId) {
      issues.push(`URL projectId=${urlProjectId || "(なし)"} (expected ${exp.projectId})`);
    }

    const detail = document.querySelector("[data-partner-assignment-detail]");
    if (!detail) {
      issues.push("[data-partner-assignment-detail] なし");
      return { ok: false, issues, urlProjectId, rowMap: {} };
    }

    if (detail.querySelector(".mvp-cal-detail__denied")) {
      if (!exp.expectDenied) issues.push("割当外メッセージが表示されています");
      return {
        ok: exp.expectDenied ? issues.length === 0 : false,
        issues,
        urlProjectId,
        denied: true,
        rowMap: {},
      };
    }

    if (exp.expectDenied) issues.push("割当外メッセージが表示されていません");

    if (document.querySelector("[data-mvp-cal-partner-schedule], [data-builder-mvp-cal-list] li")) {
      issues.push("カレンダー要素が案件確認画面に含まれています");
    }

    const rowMap = Object.fromEntries(
      [...detail.querySelectorAll(".mvp-cal-assignment__row")].map((row) => [
        row.querySelector("dt")?.textContent?.trim() || "",
        row.querySelector("dd")?.textContent?.trim() || "",
      ])
    );

    if (!detail.querySelector(".mvp-cal-assignment--partner")) {
      issues.push("案件確認カードが表示されていません");
    }
    if (!detail.querySelector("[data-partner-assignment-accept], [data-partner-assignment-decline]")) {
      issues.push("受ける / 受けない ボタンが表示されていません");
    }
    if (detail.querySelector("[data-mvp-cal-accept], [data-mvp-cal-decline]")) {
      issues.push("旧カレンダー用ボタンが残っています");
    }

    if (rowMap["案件名"] !== exp.title) {
      issues.push(`案件名不一致: ${rowMap["案件名"] || "(なし)"}`);
    }
    if (exp.summary && rowMap["案件概要"] !== exp.summary) {
      issues.push(`案件概要不一致: ${rowMap["案件概要"] || "(なし)"}`);
    }
    if (exp.reward && rowMap["報酬"] !== exp.reward) {
      issues.push(`報酬不一致: ${rowMap["報酬"] || "(なし)"}`);
    }
    if (exp.access && rowMap["入場条件"] !== exp.access) {
      issues.push(`入場条件不一致: ${rowMap["入場条件"] || "(なし)"}`);
    }

    const acceptPid = detail.querySelector("[data-partner-assignment-accept]")?.getAttribute("data-project-id") || "";
    const declinePid =
      detail.querySelector("[data-partner-assignment-decline]")?.getAttribute("data-project-id") || "";
    if (acceptPid && acceptPid !== exp.projectId) {
      issues.push(`受けるボタンの projectId 不一致: ${acceptPid}`);
    }
    if (declinePid && declinePid !== exp.projectId) {
      issues.push(`受けないボタンの projectId 不一致: ${declinePid}`);
    }

    const navBtn = detail.querySelector(".partner-assignment-navBtn");
    if (!navBtn) {
      issues.push("Googleナビボタン（.partner-assignment-navBtn）が表示されていません");
    } else {
      if (!navBtn.textContent?.includes("Googleナビを開く")) {
        issues.push(`Googleナビボタンラベル不一致: ${navBtn.textContent?.trim()}`);
      }
      if (navBtn.getAttribute("target") !== "_blank") {
        issues.push("Googleナビボタンの target=_blank がありません");
      }
      const h = parseFloat(getComputedStyle(navBtn).height);
      if (h < 44) issues.push(`Googleナビボタン高さ不足: ${h}px`);
    }

    return {
      ok: issues.length === 0,
      issues,
      urlProjectId,
      detailProjectTitle: rowMap["案件名"] || "",
      rowMap,
      acceptPid,
      declinePid,
    };
  }, expect);

  return audit;
}
