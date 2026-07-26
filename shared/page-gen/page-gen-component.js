/**
 * TASFUL Page Gen — shared UI components (Phase 1 common engine)
 *
 * Surface-neutral DOM helpers built on the shared renderer. No product
 * styling, no surface imports; hosts supply CSS and event handlers.
 * Safe to load in Node (all DOM access is guarded).
 */
(function (global) {
  "use strict";

  function Renderer() {
    return global.TasuPageGenRenderer;
  }

  function Interview() {
    return global.TasuPageGenInterview;
  }

  function esc(value) {
    return Renderer().escapeHtml(value);
  }

  function hasDom() {
    return typeof document !== "undefined" && Boolean(document.createElement);
  }

  function resolveEl(target) {
    if (!hasDom()) return null;
    if (typeof target === "string") return document.querySelector(target);
    return target && target.nodeType === 1 ? target : null;
  }

  /** Preview markup for a PageDoc (also usable server-side as a string). */
  function previewHtml(doc, options) {
    return Renderer().render(doc, { preview: true, ...(options || {}) });
  }

  function mountPreview(target, doc, options) {
    const el = resolveEl(target);
    const html = previewHtml(doc, options);
    if (!el) return { ok: false, html, reason: "no_dom" };
    el.innerHTML = html;
    el.setAttribute("data-pg-preview", doc?.id || "");
    return { ok: true, html, el };
  }

  function promptFieldHtml(prompt) {
    const id = `pg-q-${esc(prompt.slotId)}`;
    const required = prompt.required ? `<span class="pg-q__required">必須</span>` : "";
    const hint = prompt.example ? `<span class="pg-q__hint">例: ${esc(prompt.example)}</span>` : "";
    if (prompt.type === "choice" && prompt.options?.length) {
      const chips = prompt.options
        .map(
          (opt) =>
            `<button type="button" class="pg-q__chip" data-pg-choice="${esc(prompt.slotId)}" value="${esc(opt)}">${esc(opt)}</button>`,
        )
        .join("");
      return (
        `<div class="pg-q__field">` +
        `<label class="pg-q__label" for="${id}">${esc(prompt.question)}${required}</label>` +
        `<div class="pg-q__chips">${chips}</div>${hint}</div>`
      );
    }
    const input =
      prompt.type === "long_text"
        ? `<textarea class="pg-q__input" id="${id}" data-pg-slot="${esc(prompt.slotId)}" rows="3"></textarea>`
        : `<input class="pg-q__input" id="${id}" type="text" data-pg-slot="${esc(prompt.slotId)}">`;
    return (
      `<div class="pg-q__field">` +
      `<label class="pg-q__label" for="${id}">${esc(prompt.question)}${required}</label>` +
      input +
      hint +
      `</div>`
    );
  }

  /** Question card markup for one interview turn. */
  function questionHtml(question) {
    if (!question) return "";
    const fields = (question.prompts || []).map(promptFieldHtml).join("");
    const skip = question.optional
      ? `<button type="button" class="pg-q__skip" data-pg-skip="1">あとで入力する</button>`
      : "";
    return (
      `<form class="pg-q" data-pg-question="${esc(question.id)}" novalidate>` +
      fields +
      `<div class="pg-q__actions">` +
      `<button type="submit" class="pg-q__submit">次へ</button>${skip}` +
      `</div></form>`
    );
  }

  function readQuestionValues(formEl) {
    if (!formEl || !formEl.querySelectorAll) return {};
    const answers = {};
    formEl.querySelectorAll("[data-pg-slot]").forEach((input) => {
      const slotId = input.getAttribute("data-pg-slot");
      const value = String(input.value ?? "").trim();
      if (slotId && value) answers[slotId] = value;
    });
    return answers;
  }

  /**
   * Renders the current interview question and wires submit / skip.
   * @param {Element|string} target
   * @param {object} session
   * @param {{ onAnswer?: Function, onSkip?: Function, onDone?: Function }} handlers
   */
  function mountInterview(target, session, handlers) {
    const state = Interview().next(session);
    const el = resolveEl(target);
    if (state.done) {
      if (el) el.innerHTML = "";
      handlers?.onDone?.(session, state);
      return { ok: Boolean(el), done: true, html: "", state };
    }
    const html = questionHtml(state.question);
    if (!el) return { ok: false, done: false, html, state, reason: "no_dom" };

    el.innerHTML = html;
    const form = el.querySelector("[data-pg-question]");
    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      handlers?.onAnswer?.(readQuestionValues(form), state);
    });
    el.querySelectorAll("[data-pg-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slotId = btn.getAttribute("data-pg-choice");
        handlers?.onAnswer?.({ [slotId]: btn.getAttribute("value") }, state);
      });
    });
    el.querySelector("[data-pg-skip]")?.addEventListener("click", () => handlers?.onSkip?.(state));
    return { ok: true, done: false, html, state, el };
  }

  function progressHtml(progress) {
    if (!progress) return "";
    const pct = Math.round((progress.ratio || 0) * 100);
    return (
      `<div class="pg-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">` +
      `<span class="pg-progress__bar" style="width:${pct}%"></span>` +
      `<span class="pg-progress__label">入力 ${progress.mustFilled}/${progress.mustTotal}</span>` +
      `</div>`
    );
  }

  function validationHtml(result) {
    if (!result || (result.ok && !result.warnings?.length)) return "";
    const item = (x, kind) =>
      `<li class="pg-validation__item pg-validation__item--${kind}">${esc(x.message)}</li>`;
    const errors = (result.errors || []).map((e) => item(e, "error")).join("");
    const warnings = (result.warnings || []).map((w) => item(w, "warning")).join("");
    return `<ul class="pg-validation">${errors}${warnings}</ul>`;
  }

  function mountValidation(target, result) {
    const el = resolveEl(target);
    const html = validationHtml(result);
    if (!el) return { ok: false, html };
    el.innerHTML = html;
    return { ok: true, html, el };
  }

  global.TasuPageGenComponent = {
    hasDom,
    previewHtml,
    mountPreview,
    questionHtml,
    promptFieldHtml,
    readQuestionValues,
    mountInterview,
    progressHtml,
    validationHtml,
    mountValidation,
  };
})(typeof window !== "undefined" ? window : globalThis);
