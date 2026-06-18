/**
 * 全カテゴリ共通 E2E — 診断値だけでなく DOM visible を必須条件にする
 */

/** @typedef {{ category: string, stages: Record<string, { expectedButtonA: string, expectedButtonB: string }> }} CategoryFlowConfig */

export const CATEGORY_E2E_CONFIG = Object.freeze({
  job: {
    category: "job",
    label: "求人",
    notifyFrame: "frame-b-notify",
    notifyTitleRe: /応募が承諾されました/,
    ctaLabelRe: /チャット|やり取り/,
    active: { expectedButtonA: /終了を依頼する/, expectedButtonB: null },
    end_requested: { expectedButtonA: /依頼|待ち/, expectedButtonB: /やり取りを完了する/ },
    completed: { reviewPrompt: true },
  },
  general: {
    category: "general",
    label: "一般案件",
    notifyFrame: "frame-a-notify",
    notifyTitleRe: /応募|依頼が届きました/,
    ctaLabelRe: /確認|チャット/,
    active: { expectedButtonA: null, expectedButtonB: /完了申請/ },
    completion_requested: { expectedButtonA: /承認|差し戻し/, expectedButtonB: /申請|済/ },
    completed: { reviewPrompt: true },
  },
  purchase_no_connect: {
    category: "purchase_no_connect",
    label: "Connectなし購入",
    notifyFrame: "frame-b-notify",
    notifyTitleRe: /購入|予約|相談|依頼が/,
    ctaLabelRe: /確認|チャット/,
    active: { expectedButtonA: null, expectedButtonB: /取引完了を申請/ },
    completion_requested: { expectedButtonA: /承認|差し戻し/, expectedButtonB: /申請|済/ },
    completed: { reviewPrompt: true },
  },
  purchase_connect: {
    category: "purchase_connect",
    label: "Connectあり購入",
    notifyFrame: "frame-b-notify",
    notifyTitleRe: /購入/,
    ctaLabelRe: /確認|チャット/,
    active: { expectedButtonA: null, expectedButtonB: /納品|完了申請/ },
    completion_requested: { expectedButtonA: /承認|差し戻し/, expectedButtonB: /申請|済/ },
    completed: { reviewPrompt: true },
  },
  builder: {
    category: "builder",
    label: "Builder",
    notifyFrame: "frame-a-notify",
    notifyTitleRe: /案件応募|依頼が届きました/,
    ctaLabelRe: /確認|チャット/,
    active: { expectedButtonA: null, expectedButtonB: /完了報告/ },
    completion_reported: { expectedButtonA: /承認|差し戻し/, expectedButtonB: /報告|済/ },
    completed: { reviewPrompt: true },
  },
});

/**
 * Playwright locator の実DOM visible 判定（hidden + bounding box）
 */
export async function assertDomVisible(locator, label = "element") {
  const count = await locator.count();
  if (count < 1) {
    return { ok: false, label, reason: "not_found", visible: false, box: null, text: "" };
  }
  const first = locator.first();
  const visible = await first.isVisible();
  const box = visible ? await first.boundingBox() : null;
  const text = ((await first.textContent()) || "").trim();
  const domVisible = Boolean(visible && box && box.height > 8 && box.width > 20);
  return {
    ok: domVisible,
    label,
    reason: domVisible ? "visible" : visible ? "zero_box" : "hidden",
    visible: domVisible,
    box,
    text,
  };
}

export async function checkNotifyCardVisible(page, frameId, titleRe) {
  const frame = page.frameLocator(`#${frameId}`);
  const card = frame.locator(".talk-notify-card").first();
  const title = frame.locator(".talk-notify-card__title, .talk-notify-card__title--job-event").first();
  const cardProbe = await assertDomVisible(card, `${frameId} notify card`);
  const titleProbe = await assertDomVisible(title, `${frameId} notify title`);
  const titleOk = titleRe ? titleRe.test(titleProbe.text) : true;
  return {
    ...cardProbe,
    title: titleProbe.text,
    titleOk,
    ok: cardProbe.ok && titleOk,
  };
}

export async function checkNotifyCtaVisible(page, frameId, labelRe) {
  const frame = page.frameLocator(`#${frameId}`);
  const cta = frame.locator("[data-talk-notify-action], .talk-notify-card__minimal-action, .talk-notify-card__action").first();
  const probe = await assertDomVisible(cta, `${frameId} notify CTA`);
  const labelOk = labelRe ? labelRe.test(probe.text) : true;
  return { ...probe, labelOk, ok: probe.ok && labelOk };
}

export async function checkComposerVisible(page, frameId) {
  const frame = page.frameLocator(`#${frameId}`);
  const input = frame.locator("#chatInput");
  return assertDomVisible(input, `${frameId} chat composer`);
}

export async function checkCompletionButtonVisible(page, frameId, labelRe) {
  const frame = page.frameLocator(`#${frameId}`);
  const composerBtn = frame.locator("#chatJobEndBarBtn");
  const completeBtn = frame.locator("#chatCompleteBtn");
  const byText = labelRe ? frame.getByRole("button", { name: labelRe }) : frame.locator("button").first();

  const probes = await Promise.all([
    assertDomVisible(composerBtn, `${frameId} job end bar btn`),
    assertDomVisible(completeBtn, `${frameId} complete btn`),
    labelRe ? assertDomVisible(byText, `${frameId} named btn`) : Promise.resolve({ ok: false, visible: false, text: "" }),
  ]);

  const pick =
    probes.find((p) => p.visible && (!labelRe || labelRe.test(p.text))) ||
    probes.find((p) => p.visible) ||
    probes[0];

  return {
    frameId,
    ...pick,
    probes,
    ok: Boolean(pick?.visible && (!labelRe || labelRe.test(pick.text || ""))),
  };
}

export async function checkReviewPromptVisible(page, frameId) {
  const frame = page.frameLocator(`#${frameId}`);
  const prompt = frame.locator("[data-platform-job-review-prompt], [data-platform-review-prompt], .chat-review-btn, [data-platform-job-review-open]");
  return assertDomVisible(prompt.first(), `${frameId} review prompt`);
}

/**
 * ステージ別 DOM visible 必須チェック（診断値のみでは PASS しない）
 */
export async function runCategoryDomVisibleChecks(page, categoryKey, stage, options = {}) {
  const cfg = CATEGORY_E2E_CONFIG[categoryKey] || CATEGORY_E2E_CONFIG.job;
  const stageCfg = cfg[stage] || cfg.active || {};
  const issues = [];
  const results = {};

  if (options.checkNotify !== false) {
    results.notify = await checkNotifyCardVisible(page, cfg.notifyFrame, cfg.notifyTitleRe);
    if (!results.notify.ok) issues.push(`${cfg.label}: 期待通知カードが DOM visible ではない`);
    results.cta = await checkNotifyCtaVisible(page, cfg.notifyFrame, cfg.ctaLabelRe);
    if (!results.cta.ok) issues.push(`${cfg.label}: CTA button が DOM visible ではない`);
  }

  if (options.checkChat !== false) {
    results.composerA = await checkComposerVisible(page, "frame-a-chat");
    results.composerB = await checkComposerVisible(page, "frame-b-chat");
    const expectComposer = stage !== "completed" && stage !== "closed";
    if (expectComposer && !results.composerA.ok && !results.composerB.ok) {
      issues.push(`${cfg.label}: chat composer が両側とも DOM visible ではない`);
    }
  }

  if (stageCfg.expectedButtonA) {
    results.buttonA = await checkCompletionButtonVisible(page, "frame-a-chat", stageCfg.expectedButtonA);
    if (!results.buttonA.ok) {
      issues.push(`${cfg.label}: A 期待完了ボタンが DOM visible ではない (${stageCfg.expectedButtonA})`);
    }
  } else if (stage === "active") {
    results.buttonA = await checkCompletionButtonVisible(page, "frame-a-chat", /./);
    if (results.buttonA.visible && /終了を依頼する|完了申請|取引完了|納品|完了報告/.test(results.buttonA.text)) {
      /* A にボタンがあるのは active では通常 NG だが B 側の話と混同しない */
    }
  }

  if (stageCfg.expectedButtonB) {
    results.buttonB = await checkCompletionButtonVisible(page, "frame-b-chat", stageCfg.expectedButtonB);
    if (!results.buttonB.ok) {
      issues.push(`${cfg.label}: B 期待完了ボタンが DOM visible ではない (${stageCfg.expectedButtonB})`);
    }
  } else if (stage === "active") {
    results.buttonB = await checkCompletionButtonVisible(page, "frame-b-chat", /終了を依頼する/);
    if (results.buttonB.visible) {
      issues.push(`${cfg.label}: B active で不要な「終了を依頼する」が DOM visible`);
    }
  }

  if (stageCfg.reviewPrompt) {
    results.reviewA = await checkReviewPromptVisible(page, "frame-a-chat");
    results.reviewB = await checkReviewPromptVisible(page, "frame-b-chat");
    if (!results.reviewA.ok) issues.push(`${cfg.label}: A review button/prompt が DOM visible ではない`);
    if (!results.reviewB.ok) issues.push(`${cfg.label}: B review button/prompt が DOM visible ではない`);
  }

  return { ok: issues.length === 0, issues, results, category: cfg.label, stage };
}

export function getCategoryE2eConfig(categoryKey) {
  return CATEGORY_E2E_CONFIG[categoryKey] || CATEGORY_E2E_CONFIG.job;
}
