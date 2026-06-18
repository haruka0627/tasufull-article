/**
 * liveFlow=1 — 通知起点の実操作 E2E ヘルパー
 */

export const REVIEW = "chat-demo";

/** @type {Record<string, object>} */
export const LIVE_FLOW_SPECS = Object.freeze({
  job: {
    label: "job",
    demoProfile: "job",
    listingId: "job_demo_full_001",
    detailPath: "/detail-job.html",
    startVia: "apply",
    partnerA: "u_job_demo_full",
    partnerB: "u_hiro",
    requesterId: "u_job_demo_full",
    approverId: "u_hiro",
    completeBtn: "やりとり完了",
    startNotify: {
      audience: "A",
      titlePattern: /応募がありました/,
      cta: "確認する",
      hrefPattern: /view=applications|#applications/,
    },
    completeNotify: {
      audience: "B",
      titlePattern: /やりとり完了.*申請|完了.*申請/,
      cta: "承認する",
      hrefPattern: /chat-detail\.html.*thread=/,
    },
  },
  skill: {
    label: "skill",
    demoProfile: "skill",
    listingId: "demo-skill-001",
    detailPath: "/detail-skill.html",
    ctaSelector: ".cta-consult, [data-tasu-contact-cta]",
    partnerA: "u_sachi",
    partnerB: "u_hiro",
    requesterId: "u_sachi",
    approverId: "u_hiro",
    completeBtn: "納品完了",
    feeNotify: {
      audience: "B",
      titlePattern: /手数料が必要/,
      cta: "確認する",
      hrefPattern: /platform-chat-fee-pay/,
    },
    activatedNotify: {
      titlePattern: /チャットが開始されました/,
      cta: "確認する",
      hrefPattern: /chat-detail\.html.*thread=/,
    },
    completeNotify: {
      audience: "B",
      titlePattern: /やりとり完了|完了.*申請|納品完了/,
      cta: "承認する",
      hrefPattern: /chat-detail\.html.*thread=/,
    },
  },
  product: {
    label: "product",
    demoProfile: "product",
    listingId: "demo-product-001",
    detailPath: "/detail-product.html",
    ctaSelector:
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary, [data-tasu-mdetail-cta-dock] a, [data-listing-primary-cta], .skill-cta-panel__primary.cta-consult, [data-tasu-contact-cta]",
    partnerA: "u_product",
    partnerB: "u_hiro",
    requesterId: "u_hiro",
    approverId: "u_product",
    completeBtn: "受け取り完了",
    feeNotify: {
      audience: "B",
      titlePattern: /手数料が必要/,
      cta: "確認する",
      hrefPattern: /platform-chat-fee-pay/,
    },
    activatedNotify: {
      titlePattern: /チャットが開始されました/,
      cta: "確認する",
      hrefPattern: /chat-detail\.html.*thread=/,
    },
    completeNotify: {
      audience: "A",
      titlePattern: /受け取り完了.*申請/,
      cta: "承認する",
      hrefPattern: /chat-detail\.html.*thread=/,
    },
  },
  business: {
    label: "business",
    demoProfile: "business",
    listingId: "demo-business-service-001",
    detailPath: "/detail-business-service.html",
    ctaSelector:
      "[data-tasu-mdetail-cta-dock] a, [data-tasu-mdetail-cta-dock] button, [data-business-service-estimate], [data-biz-detail-sticky-estimate], [data-business-service-consult], [data-biz-detail-sticky-inquiry]",
    partnerA: "u_business_demo",
    partnerB: "u_hiro",
    requesterId: "u_business_demo",
    approverId: "u_hiro",
    completeBtn: "作業完了",
    feeNotify: {
      audience: "B",
      titlePattern: /手数料が必要/,
      cta: "確認する",
      hrefPattern: /platform-chat-fee-pay/,
    },
    activatedNotify: {
      titlePattern: /チャットが開始されました/,
      cta: "確認する",
      hrefPattern: /chat-detail\.html.*thread=/,
    },
    completeNotify: {
      audience: "B",
      titlePattern: /作業完了.*申請/,
      cta: "承認する",
      hrefPattern: /chat-detail\.html.*thread=/,
    },
  },
});

export function liveFlowUrl(base, path, params = {}) {
  const u = new URL(path, base);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", REVIEW);
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("demoConnect", "0");
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") u.searchParams.set(k, String(v));
  });
  return u.href;
}

export async function resetLiveFlow(page, base, demoProfile) {
  await page.goto(
    liveFlowUrl(base, "/chat-dual-window-demo.html", {
      demoProfile,
      liveFlowReset: 1,
    }),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForTimeout(400);
}

export async function gotoNotifyTab(page, base, spec, userId) {
  await page.goto(
    liveFlowUrl(base, "/talk-home.html", {
      tab: "notify",
      userId,
      demoProfile: spec.demoProfile,
    }),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForTimeout(900);
}

export async function readLiveNotifications(page, spec, userId) {
  return page.evaluate(
    ({ partnerA, partnerB, uid }) => {
      const me = String(uid || window.TasuChatUserIdentity?.getEffectiveUserId?.() || "").trim();
      const rows =
        window.TasuTalkChatDemoReviewMode?.filterChatDemoReviewNotifications?.(
          window.TasuTalkNotifications?.getAll?.() || []
        ) || [];
      const matchesAudience = (n) => {
        const role = String(n.recipientRole || n.recipient_role || "").toLowerCase();
        if (!role) return true;
        if (role === "buyer" || role === "requester") return me === partnerB;
        if (role === "seller" || role === "worker" || role === "poster") return me === partnerA;
        if (role === "applicant") return me === partnerB;
        if (role === "both") return me === partnerA || me === partnerB;
        return true;
      };
      return rows.filter(matchesAudience).map((n) => ({
        id: String(n.id || ""),
        title: String(n.title || ""),
        body: String(n.body || ""),
        actionLabel: String(n.actionLabel || "").trim(),
        href: String(n.href || n.targetUrl || ""),
        category: String(n.category || n.type || ""),
      }));
    },
    { partnerA: spec.partnerA, partnerB: spec.partnerB, uid: userId }
  );
}

export function findNotify(rows, { titlePattern, cta }) {
  return (rows || []).find((n) => {
    const titleOk = titlePattern ? titlePattern.test(n.title) : true;
    const ctaOk = cta ? n.actionLabel === cta : true;
    return titleOk && ctaOk;
  });
}

export function assertNotify(n, spec, prefix, issues, { hrefPattern } = {}) {
  if (!n) {
    issues.push(`${prefix}: notification not found (${spec.titlePattern})`);
    return false;
  }
  if (spec.cta && n.actionLabel !== spec.cta) {
    issues.push(`${prefix}: CTA=${n.actionLabel || "(empty)"} expected ${spec.cta}`);
  }
  if (hrefPattern && !hrefPattern.test(n.href)) {
    issues.push(`${prefix}: href=${n.href || "(empty)"}`);
  }
  if (spec.titlePattern && !spec.titlePattern.test(n.title)) {
    issues.push(`${prefix}: title=${n.title || "(empty)"}`);
  }
  return true;
}

export async function assertNoLiveNotifications(page, spec, prefix, issues, userId) {
  const rows = await readLiveNotifications(page, spec, userId || spec.partnerA);
  if (rows.length) {
    issues.push(`${prefix}: expected 0 notifications before action, got ${rows.length} (${rows[0]?.title})`);
  }
  return rows.length === 0;
}

export async function assertMobileUi(page, prefix, issues) {
  const ui = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      overflow: doc.scrollWidth > doc.clientWidth + 2,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  if (ui.overflow) {
    issues.push(`${prefix}: horizontal overflow ${ui.scrollWidth}px > ${ui.clientWidth}px`);
  }
}

export async function waitDetailReady(page) {
  await page.waitForFunction(
    () => {
      const isVisible = (el) => {
        if (!el) return false;
        const st = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return st.visibility !== "hidden" && st.display !== "none" && rect.height > 0 && rect.width > 0;
      };
      const ctas = [
        ...document.querySelectorAll(
          "[data-tasu-mdetail-cta-dock] a, [data-tasu-mdetail-cta-dock] button, [data-listing-primary-cta], .skill-cta-panel__primary, [data-business-service-estimate], [data-business-service-consult], [data-tasu-contact-cta]"
        ),
      ];
      if (ctas.some(isVisible)) return true;
      return document.body.dataset.listingLoaded === "true" && ctas.length > 0;
    },
    { timeout: 45000 }
  );
  await page.waitForTimeout(600);
}

export async function payFeeOnPage(page, issues, label = "fee-pay") {
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.waitForSelector("[data-platform-fee-pay]", { timeout: 15000 });
  await assertMobileUi(page, label, issues);
  await page.click("[data-platform-fee-pay]");
  await page.waitForFunction(
    () => !document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
    { timeout: 15000 }
  );
  await page.waitForTimeout(400);
}

export async function openChatFromFeeComplete(page, base) {
  const href = await page.locator("[data-platform-fee-chat-link]").getAttribute("href");
  if (!href) throw new Error("fee complete chat link missing");
  const target = href.startsWith("http") ? href : new URL(href, base || page.url()).href;
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await waitChatReady(page);
  const threadId = new URL(page.url()).searchParams.get("thread");
  return threadId;
}

export async function waitChatReady(page) {
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", null, {
    timeout: 20000,
  });
  await page.waitForTimeout(300);
}

export async function clickNotifyCta(page, notifyRow, base) {
  const href = String(notifyRow?.href || "").trim();
  if (!href || href === "#") {
    const card = page.locator(`[data-talk-notify-id="${notifyRow.id}"]`).first();
    await card.click();
    await page.waitForTimeout(600);
    return;
  }
  const origin = base || page.url();
  const target = href.startsWith("http") ? href : new URL(href, origin).href;
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
}

export async function runContactFeeChatFlow(pageB, pageA, base, spec, issues) {
  await pageB.goto(
    liveFlowUrl(base, spec.detailPath, {
      id: spec.listingId,
      userId: spec.partnerB,
      demoProfile: spec.demoProfile,
    }),
    { waitUntil: "domcontentloaded" }
  );
  await waitDetailReady(pageB);
  await assertMobileUi(pageB, `${spec.label}-detail`, issues);

  const clicked = await pageB.evaluate((selector) => {
    const isVisible = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return st.visibility !== "hidden" && st.display !== "none" && rect.height > 0 && rect.width > 0;
    };
    const target = [...document.querySelectorAll(selector)].find(isVisible);
    if (!target) return { ok: false };
    target.click();
    return { ok: true, text: String(target.textContent || "").trim() };
  }, spec.ctaSelector);

  if (!clicked?.ok) {
    issues.push(`${spec.label}: visible detail CTA not found (${spec.ctaSelector})`);
    return null;
  }

  let landedOnFeePay = false;
  let feePayUrlFromCta = "";
  try {
    await pageB.waitForURL(/platform-chat-fee-pay\.html/i, { timeout: 20000 });
    landedOnFeePay = true;
    feePayUrlFromCta = pageB.url();
  } catch {
    await pageB.waitForTimeout(800);
    landedOnFeePay = /platform-chat-fee-pay\.html/i.test(pageB.url());
    if (landedOnFeePay) feePayUrlFromCta = pageB.url();
    if (!landedOnFeePay) {
      issues.push(`${spec.label}: fee pay URL not reached after CTA (${pageB.url()})`);
    }
  }
  await pageB.waitForTimeout(500);

  await gotoNotifyTab(pageB, base, spec, spec.partnerB);
  const feeRowsB = await readLiveNotifications(pageB, spec, spec.partnerB);
  const feeNotifyRow = findNotify(feeRowsB, spec.feeNotify);
  assertNotify(feeNotifyRow, spec.feeNotify, `${spec.label}-fee-notify-b`, issues, {
    hrefPattern: spec.feeNotify.hrefPattern,
  });

  await gotoNotifyTab(pageA, base, spec, spec.partnerA);
  const feeRowsA = await readLiveNotifications(pageA, spec, spec.partnerA);
  if (findNotify(feeRowsA, spec.feeNotify)) {
    issues.push(`${spec.label}: fee notify should not appear for partner A before pay`);
  }

  if (feeNotifyRow?.href) {
    const feePayTarget = feeNotifyRow.href.startsWith("http")
      ? feeNotifyRow.href
      : new URL(feeNotifyRow.href, base).href;
    await pageB.goto(feePayTarget, { waitUntil: "domcontentloaded" });
  } else if (feePayUrlFromCta) {
    await pageB.goto(feePayUrlFromCta, { waitUntil: "domcontentloaded" });
  } else {
    issues.push(`${spec.label}: fee pay href missing on notify`);
  }

  if (pageB.url().includes("platform-chat-fee-pay")) {
    await payFeeOnPage(pageB, issues, `${spec.label}-fee-pay`);
  } else {
    issues.push(`${spec.label}: fee pay page not reached (${pageB.url()})`);
    return null;
  }
  const threadId = await openChatFromFeeComplete(pageB, base);
  if (!threadId) issues.push(`${spec.label}: thread id missing after fee pay`);

  await gotoNotifyTab(pageB, base, spec, spec.partnerB);
  const activatedB = findNotify(await readLiveNotifications(pageB, spec, spec.partnerB), spec.activatedNotify);
  assertNotify(activatedB, spec.activatedNotify, `${spec.label}-activated-b`, issues, {
    hrefPattern: spec.activatedNotify.hrefPattern,
  });

  await gotoNotifyTab(pageA, base, spec, spec.partnerA);
  const activatedA = findNotify(await readLiveNotifications(pageA, spec, spec.partnerA), spec.activatedNotify);
  assertNotify(activatedA, spec.activatedNotify, `${spec.label}-activated-a`, issues, {
    hrefPattern: spec.activatedNotify.hrefPattern,
  });

  if (activatedA) {
    await clickNotifyCta(pageA, activatedA, base);
    if (!pageA.url().includes("chat-detail.html")) {
      issues.push(`${spec.label}: activated CTA did not open chat (${pageA.url()})`);
    } else {
      await waitChatReady(pageA);
      await assertMobileUi(pageA, `${spec.label}-chat-a`, issues);
      const completeText = await pageA.locator("#chatCompleteBtn").textContent();
      const completeVisible = await pageA.locator("#chatCompleteBtn").isVisible();
      if (completeVisible && String(completeText || "").trim() !== spec.completeBtn) {
        issues.push(`${spec.label}: completeBtn=${completeText} expected ${spec.completeBtn}`);
      }
    }
  }

  return threadId;
}

export async function runCompletionAndReview(
  pageRequester,
  pageApprover,
  base,
  spec,
  threadId,
  issues
) {
  const chatParams = {
    thread: threadId,
    demoProfile: spec.demoProfile,
  };

  await pageRequester.goto(
    liveFlowUrl(base, "/chat-detail.html", {
      ...chatParams,
      userId: spec.requesterId,
    }),
    { waitUntil: "domcontentloaded" }
  );
  await waitChatReady(pageRequester);

  const requestReady = await pageRequester
    .waitForFunction(
      ({ tid, uid }) => {
        const row = (window.TasuChatThreadStore?.readAll?.() || []).find(
          (t) => String(t.id) === String(tid)
        );
        return window.TasuPlatformChatCompletionFlow?.canRequestCompletion?.(row, uid) === true;
      },
      { tid: threadId, uid: spec.requesterId },
      { timeout: 15000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!requestReady) {
    issues.push(`${spec.label}: complete request not available for ${spec.requesterId}`);
  }

  const requested = await pageRequester.evaluate(
    ({ tid, uid }) => {
      const store = window.TasuChatThreadStore;
      const flow = window.TasuPlatformChatCompletionFlow;
      const row = (store?.readAll?.() || []).find((t) => String(t.id) === String(tid));
      if (!row) return { ok: false, reason: "thread_missing" };
      if (!flow?.canRequestCompletion?.(row, uid)) {
        return { ok: false, reason: "cannot_request" };
      }
      const viaApi = flow.requestCompletion?.({ threadId: tid, thread: row, userId: uid });
      if (viaApi?.ok) return { ok: true, via: "api" };
      const btn = document.getElementById("chatCompleteBtn");
      if (btn && !btn.hidden && !btn.disabled) {
        btn.click();
        const submit = document.getElementById("chatCompleteSubmit");
        if (submit && !submit.hidden) {
          submit.click();
          return { ok: true, via: "ui" };
        }
      }
      return viaApi || { ok: false, reason: "request_failed" };
    },
    { tid: threadId, uid: spec.requesterId }
  );

  if (!requested?.ok) {
    issues.push(`${spec.label}: completion request failed (${requested?.reason || "unknown"})`);
  }

  const pendingOk = await pageRequester
    .waitForFunction(
      (tid) => {
        const row = (window.TasuChatThreadStore?.readAll?.() || []).find(
          (t) => String(t.id) === String(tid)
        );
        const rs = String(row?.roomStatus || row?.status || "").toLowerCase();
        return rs === "completion_pending" || Boolean(row?.completionRequestedBy);
      },
      threadId,
      { timeout: 15000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!pendingOk) {
    issues.push(`${spec.label}: completion_pending not reached for thread ${threadId}`);
    return;
  }
  await pageRequester.waitForTimeout(400);

  await gotoNotifyTab(pageApprover, base, spec, spec.approverId);
  await assertMobileUi(pageApprover, `${spec.label}-notify-complete`, issues);
  const completeRows = await readLiveNotifications(pageApprover, spec, spec.approverId);
  const completeNotify = findNotify(completeRows, spec.completeNotify);
  assertNotify(completeNotify, spec.completeNotify, `${spec.label}-complete-notify`, issues, {
    hrefPattern: spec.completeNotify.hrefPattern,
  });

  if (completeNotify) {
    const notifyThreadMatch = completeNotify.href.match(/[?&]thread=([^&]+)/i);
    const activeThreadId = notifyThreadMatch ? decodeURIComponent(notifyThreadMatch[1]) : threadId;

    await clickNotifyCta(pageApprover, completeNotify, base);
    if (!pageApprover.url().includes("chat-detail.html")) {
      await pageApprover.goto(
        liveFlowUrl(base, "/chat-detail.html", {
          thread: activeThreadId,
          userId: spec.approverId,
          demoProfile: spec.demoProfile,
        }),
        { waitUntil: "domcontentloaded" }
      );
    }
    await waitChatReady(pageApprover);
    await pageApprover.reload({ waitUntil: "domcontentloaded" });
    await waitChatReady(pageApprover);

    const approved = await pageApprover.evaluate(
      ({ tid, uid }) => {
        const store = window.TasuChatThreadStore;
        const flow = window.TasuPlatformChatCompletionFlow;
        const row = (store?.readAll?.() || []).find((t) => String(t.id) === String(tid));
        if (!row) return { ok: false, reason: "thread_missing" };
        if (flow?.canApproveCompletion?.(row, uid)) {
          const btn = document.getElementById("chatApproveCompleteBtn");
          if (btn && !btn.hidden && !btn.disabled) {
            btn.click();
            return { ok: true, via: "ui" };
          }
          return flow.approveCompletion?.({ threadId: tid, thread: row, userId: uid }) || { ok: false };
        }
        return {
          ok: false,
          reason: "cannot_approve",
          status: row?.roomStatus || row?.status,
          requestedBy: row?.completionRequestedBy,
        };
      },
      { tid: activeThreadId, uid: spec.approverId }
    );

    if (!approved?.ok) {
      issues.push(
        `${spec.label}: approve failed (${approved?.reason || "unknown"} status=${approved?.status || ""})`
      );
    }

    await pageApprover.waitForTimeout(500);
    await pageApprover.goto(
      liveFlowUrl(base, "/chat-detail.html", {
        thread: activeThreadId,
        userId: spec.approverId,
        demoProfile: spec.demoProfile,
      }),
      { waitUntil: "domcontentloaded" }
    );
    await waitChatReady(pageApprover);
    await pageApprover.waitForTimeout(500);
    await assertMobileUi(pageApprover, `${spec.label}-chat-after-approve`, issues);
    const reviewVisible = await pageApprover.locator("[data-platform-job-review-prompt]").isVisible();
    if (!reviewVisible) {
      issues.push(`${spec.label}: review prompt missing after approve`);
    }
  }
}

export async function runJobLiveFlowE2e(context, base, issues) {
  const spec = LIVE_FLOW_SPECS.job;
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  try {
    await resetLiveFlow(pageB, base, spec.demoProfile);
    await gotoNotifyTab(pageA, base, spec, spec.partnerA);
    await gotoNotifyTab(pageB, base, spec, spec.partnerB);
    await assertNoLiveNotifications(pageA, spec, `${spec.label}-before-a`, issues, spec.partnerA);
    await assertNoLiveNotifications(pageB, spec, `${spec.label}-before-b`, issues, spec.partnerB);

    await pageB.goto(
      liveFlowUrl(base, spec.detailPath, {
        id: spec.listingId,
        userId: spec.partnerB,
        demoProfile: spec.demoProfile,
      }),
      { waitUntil: "domcontentloaded" }
    );
    await pageB.waitForFunction(
      () => typeof window.TasuJobApplicationsStore?.submitApplication === "function",
      null,
      { timeout: 15000 }
    );
    await pageB.evaluate(() => {
      const listing = window.TasuListingDemoCatalog?.STORE_BY_ID?.["job_demo_full_001"];
      return window.TasuJobApplicationsStore.submitApplication(listing);
    });
    await pageB.waitForTimeout(500);

    await gotoNotifyTab(pageA, base, spec, spec.partnerA);
    const applyRows = await readLiveNotifications(pageA, spec, spec.partnerA);
    const applyNotify = findNotify(applyRows, spec.startNotify);
    assertNotify(applyNotify, spec.startNotify, `${spec.label}-apply-notify`, issues, {
      hrefPattern: spec.startNotify.hrefPattern,
    });
    await assertMobileUi(pageA, `${spec.label}-notify-apply`, issues);

    if (applyNotify) {
      await clickNotifyCta(pageA, applyNotify, base);
      await pageA.waitForTimeout(400);
      if (!/view=applications|#applications/.test(pageA.url())) {
        issues.push(`${spec.label}: apply notify CTA did not open applications (${pageA.url()})`);
      }
      await pageA.goto(
        `${liveFlowUrl(base, spec.detailPath, {
          id: spec.listingId,
          userId: spec.partnerA,
          demoProfile: spec.demoProfile,
          view: "applications",
        })}#applications`,
        { waitUntil: "domcontentloaded" }
      );
      await pageA.waitForTimeout(1500);
      let proceedCount = await pageA.locator("[data-job-app-proceed]").count();
      if (!proceedCount) {
        const diag = await pageA.evaluate(() => ({
          apps: window.TasuJobApplicationsStore?.listByJob?.("job_demo_full_001")?.length || 0,
          me: window.TasuChatUserIdentity?.getEffectiveUserId?.(),
        }));
        issues.push(
          `${spec.label}: proceed button missing (apps=${diag.apps}, user=${diag.me})`
        );
        const begin = await pageA.evaluate(() => {
          const store = window.TasuJobApplicationsStore;
          const app = store.listByJob("job_demo_full_001")[0];
          if (!app) return null;
          return store.beginJobChat("job_demo_full_001", app.application_id);
        });
        if (begin?.payUrl) {
          await pageA.goto(
            begin.payUrl.startsWith("http") ? begin.payUrl : new URL(begin.payUrl, base).href,
            { waitUntil: "domcontentloaded" }
          );
        }
      } else {
        await assertMobileUi(pageA, `${spec.label}-applications`, issues);
        const proceed = pageA.locator("[data-job-app-proceed]").first();
        await proceed.scrollIntoViewIfNeeded();
        await Promise.all([
          pageA.waitForURL(/platform-chat-fee-pay/i, { timeout: 20000 }),
          proceed.click({ force: true }),
        ]);
      }
      if (!pageA.url().includes("platform-chat-fee-pay")) {
        issues.push(`${spec.label}: fee pay URL not reached (${pageA.url()})`);
      } else {
      await payFeeOnPage(pageA, issues, `${spec.label}-job-fee-pay`);
      const tid = await openChatFromFeeComplete(pageA, base);
      await gotoNotifyTab(pageB, base, spec, spec.partnerB);
      const hired = findNotify(await readLiveNotifications(pageB, spec, spec.partnerB), {
        titlePattern: /やりとりを開始|チャットが開始|掲載者とのやりとり/,
      });
      if (!hired) {
        issues.push(`${spec.label}: applicant start notify missing`);
      } else {
        assertNotify(
          hired,
          {
            titlePattern: /やりとりを開始|チャットが開始|掲載者とのやりとり/,
          },
          `${spec.label}-hired-notify`,
          issues,
          { hrefPattern: /chat-detail\.html.*thread=/ }
        );
      }
      if (tid) {
        await runCompletionAndReview(pageA, pageB, base, spec, tid, issues);
      }
      }
    }
  } finally {
    await pageA.close();
    await pageB.close();
  }
}

export async function runCategoryLiveFlowE2e(context, base, categoryKey, issues) {
  const spec = LIVE_FLOW_SPECS[categoryKey];
  if (!spec || spec.startVia === "apply") return;

  const pageA = await context.newPage();
  const pageB = await context.newPage();

  try {
    await resetLiveFlow(pageB, base, spec.demoProfile);
    await gotoNotifyTab(pageA, base, spec, spec.partnerA);
    await gotoNotifyTab(pageB, base, spec, spec.partnerB);
    await assertNoLiveNotifications(pageA, spec, `${spec.label}-before-a`, issues, spec.partnerA);
    await assertNoLiveNotifications(pageB, spec, `${spec.label}-before-b`, issues, spec.partnerB);

    const threadId = await runContactFeeChatFlow(pageB, pageA, base, spec, issues);
    if (threadId) {
      await runCompletionAndReview(
        spec.requesterId === spec.partnerA ? pageA : pageB,
        spec.approverId === spec.partnerA ? pageA : pageB,
        base,
        spec,
        threadId,
        issues
      );
    }
  } finally {
    await pageA.close();
    await pageB.close();
  }
}
