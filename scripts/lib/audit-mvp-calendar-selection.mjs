/**
 * mvp-calendar.html — projectId から案件自動選択・詳細表示を監査
 */

/** @typedef {{ projectId: string, title: string, summary?: string, reward?: string, access?: string, minMyScheduleItems?: number, expectDenied?: boolean }} CalendarProjectExpect */

/** Builder運営デモ案件（builder.js DEMO_PROJECTS と一致） */
export const BUILDER_DEMO_CALENDAR_PROJECT = Object.freeze({
  projectId: "builder_demo_001",
  title: "店舗内装リニューアル（Builder）",
  summary: "店舗内装リニューアル一式（設計・施工・仕上げ）",
  reward: "¥980,000",
  access: "B1F 搬入口から入場",
});

/**
 * ページ上で projectId の読み取り・一覧選択・詳細一致を確認する。
 * @param {import('playwright').Page} page
 * @param {CalendarProjectExpect} expect
 */
export async function auditMvpCalendarProjectSelection(page, expect) {
  await page.waitForSelector("[data-builder-mvp-cal-list]", { timeout: 20000 });
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

    const selected = document.querySelector(".mvp-cal-listItem.is-selected");
    const selectedId = selected?.getAttribute("data-mvp-cal-item") || "";
    const selectedTitle = selected?.querySelector(".builder-notif__title")?.textContent?.trim() || "";

    if (!selected) {
      issues.push("左一覧に選択中の予定がありません（.mvp-cal-listItem.is-selected なし）");
    } else if (!selectedId.includes(exp.projectId)) {
      issues.push(`選択予定IDが対象案件と不一致: ${selectedId}`);
    } else if (!selectedTitle.includes(exp.title)) {
      issues.push(`選択予定タイトル不一致: ${selectedTitle}`);
    }

    const detail = document.querySelector("[data-builder-mvp-cal-detail]");
    if (!detail) {
      issues.push("右詳細パネル [data-builder-mvp-cal-detail] なし");
      return { ok: false, issues, urlProjectId, selectedId, selectedTitle, detailProjectTitle: "" };
    }

    if (detail.querySelector(".mvp-cal-detail__denied")) {
      if (!exp.expectDenied) {
        issues.push("割当外メッセージが表示されています（expectDenied 未指定）");
      }
      return {
        ok: exp.expectDenied ? issues.length === 0 : false,
        issues,
        urlProjectId,
        selectedId,
        selectedTitle,
        detailProjectTitle: "",
        denied: true,
      };
    }

    if (exp.expectDenied) {
      issues.push("割当外メッセージが表示されていません");
    }

    if (detail.querySelector(".mvp-cal-detail__empty")) {
      issues.push("右詳細が空状態（対象案件が表示されていません）");
    }

    const rowMap = Object.fromEntries(
      [...detail.querySelectorAll(".mvp-cal-assignment__row")].map((row) => [
        row.querySelector("dt")?.textContent?.trim() || "",
        row.querySelector("dd")?.textContent?.trim() || "",
      ])
    );
    const detailProjectTitle = rowMap["案件名"] || "";

    if (!detail.querySelector(".mvp-cal-assignment--partner")) {
      issues.push("パートナー向け案件詳細（.mvp-cal-assignment--partner）が表示されていません");
    }
    if (detail.querySelector(".builder-sitePhotoSection, .mvp-threadReportsSection, .builder-pdfOutput")) {
      issues.push("詳細に現場写真履歴・PDFなどの詳細ページ要素が含まれています");
    }
    if (!detail.querySelector("[data-mvp-cal-accept], [data-mvp-cal-decline]")) {
      issues.push("受ける / 受けない ボタンが表示されていません");
    }
    const listTitles = [...document.querySelectorAll(".mvp-cal-listItem .builder-notif__title")].map((el) =>
      el.textContent?.trim()
    );
    const noisy = listTitles.filter(
      (t) =>
        t?.startsWith("現場写真:") ||
        t?.startsWith("案件期間:") ||
        t?.startsWith("完了予定:") ||
        t?.startsWith("入場予定:")
    );
    if (noisy.length) {
      issues.push(`予定一覧に詳細ページ向け項目が含まれています: ${noisy.join(", ")}`);
    }
    if (detailProjectTitle !== exp.title) {
      issues.push(`詳細の案件名不一致: ${detailProjectTitle || "(なし)"}`);
    }
    if (exp.summary && rowMap["案件概要"] !== exp.summary) {
      issues.push(`詳細の案件概要不一致: ${rowMap["案件概要"] || "(なし)"}`);
    }
    if (exp.reward && rowMap["報酬"] !== exp.reward) {
      issues.push(`詳細の報酬不一致: ${rowMap["報酬"] || "(なし)"}`);
    }
    if (exp.access && rowMap["入場条件"] !== exp.access) {
      issues.push(`詳細の入場条件不一致: ${rowMap["入場条件"] || "(なし)"}`);
    }
    const minMySchedule = Number.isFinite(exp.minMyScheduleItems) ? exp.minMyScheduleItems : 0;
    if (minMySchedule > 0) {
      const myScheduleCount = document.querySelector("[data-mvp-cal-my-schedule-count]")?.textContent?.trim() || "";
      const myScheduleItems = document.querySelectorAll("[data-mvp-cal-my-schedule-item]").length;
      if (!document.querySelector("[data-mvp-cal-my-schedule-wrap]:not([hidden])")) {
        issues.push("今月の予定（マイ予定）エリアが表示されていません");
      } else if (myScheduleItems < minMySchedule) {
        issues.push(`今月の予定が不足（${myScheduleItems}/${minMySchedule}件 ${myScheduleCount}）`);
      }
    }

    const acceptPid =
      detail.querySelector("[data-mvp-cal-accept]")?.getAttribute("data-project-id") || "";
    const declinePid =
      detail.querySelector("[data-mvp-cal-decline]")?.getAttribute("data-project-id") || "";
    if (acceptPid && acceptPid !== exp.projectId) {
      issues.push(`受けるボタンの projectId 不一致: ${acceptPid}`);
    }
    if (declinePid && declinePid !== exp.projectId) {
      issues.push(`受けないボタンの projectId 不一致: ${declinePid}`);
    }

    return {
      ok: issues.length === 0,
      issues,
      urlProjectId,
      selectedId,
      selectedTitle,
      detailProjectTitle,
      rowMap,
      acceptPid,
      declinePid,
    };
  }, expect);

  return audit;
}
