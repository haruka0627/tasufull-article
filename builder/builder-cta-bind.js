/**
 * TASFUL Builder — CTA bind
 * Talk / 正式依頼 / 応募 / 質問 / favorite は実ハンドラがあるときだけ接続。
 * 無い場合は NOT_BOUND（偽の成功を出さない）。
 */
(function (global) {
  "use strict";

  const STATUS = Object.freeze({
    BOUND: "BOUND",
    NOT_BOUND: "NOT_BOUND",
  });

  function cache() {
    return global.TasuBuilderCompatCache;
  }

  function mark(el, status, reason) {
    if (!el) return;
    el.dataset.ctaBind = status;
    if (reason) el.dataset.ctaReason = reason;
    if (status === STATUS.NOT_BOUND) {
      el.setAttribute("aria-disabled", "true");
      el.classList.add("is-not-bound");
    }
  }

  function notifyNotBound(el, label) {
    const host = el?.closest?.("[data-canonical-cta-status]") || document.querySelector("[data-canonical-cta-status]");
    const text = `${label || "この操作"} は未接続です（NOT_BOUND）。成功したようには表示しません。`;
    if (host) {
      host.hidden = false;
      host.textContent = text;
      return;
    }
    /* 偽成功の alert は出さない。状態表示のみ。 */
  }

  function hasTalkHandler(record) {
    const threadId = String(record?.main_thread_id || record?.thread_id || "").trim();
    if (threadId) return { ok: true, href: `mvp-talk.html?thread_id=${encodeURIComponent(threadId)}` };
    if (typeof global.__openMvpThreadCompletion === "function") return { ok: false, reason: "THREAD_HELPER_ONLY" };
    return { ok: false, reason: "NO_THREAD" };
  }

  function applyToMvp(projectId) {
    const c = cache();
    if (!c || !projectId) return { ok: false, reason: "NO_CACHE" };
    const state = c.readMvp();
    const partnerId = String(state.current_partner_id || state.partner_id || "partner-demo");
    const already = (state.applications || []).some(
      (a) => String(a.project_id) === String(projectId) && String(a.partner_id) === partnerId
    );
    if (already) return { ok: false, reason: "ALREADY_APPLIED" };
    const proj = (state.projects || []).find((p) => String(p.project_id) === String(projectId));
    if (!proj) return { ok: false, reason: "NO_PROJECT" };
    state.applications = [
      ...(state.applications || []),
      { project_id: projectId, partner_id: partnerId, status: "applied", ts: c.nowIso() },
    ];
    c.writeMvp(state);
    return { ok: true, project_id: projectId };
  }

  function toggleFavorite(id) {
    const key = String(id || "");
    if (!key) return { ok: false, reason: "NO_ID" };
    const storeKey = "tasful:builder:favorites-compat:v1";
    let set = new Set();
    try {
      const raw = JSON.parse(localStorage.getItem(storeKey) || "[]");
      if (Array.isArray(raw)) set = new Set(raw.map(String));
    } catch {
      /* ignore */
    }
    if (set.has(key)) set.delete(key);
    else set.add(key);
    try {
      localStorage.setItem(storeKey, JSON.stringify(Array.from(set)));
    } catch {
      return { ok: false, reason: "CACHE_WRITE_FAILED" };
    }
    document.dispatchEvent(new CustomEvent("builder:favorites-changed", { detail: { id: key, active: set.has(key) } }));
    return { ok: true, active: set.has(key) };
  }

  function isFavorite(id) {
    try {
      const raw = JSON.parse(localStorage.getItem("tasful:builder:favorites-compat:v1") || "[]");
      return Array.isArray(raw) && raw.map(String).includes(String(id || ""));
    } catch {
      return false;
    }
  }

  function bind(root, record) {
    const scope = root || document;
    const rec = record || {};
    const id = String(rec.project_id || rec.id || rec.partner_id || "");

    scope.querySelectorAll("[data-cta-talk]").forEach((el) => {
      const talk = hasTalkHandler(rec);
      if (!talk.ok) {
        mark(el, STATUS.NOT_BOUND, talk.reason);
        el.addEventListener("click", (ev) => {
          ev.preventDefault();
          notifyNotBound(el, "Talk");
        });
        return;
      }
      mark(el, STATUS.BOUND, "thread");
      if (el.tagName === "A") el.setAttribute("href", talk.href);
      el.addEventListener("click", (ev) => {
        if (el.tagName !== "A") {
          ev.preventDefault();
          window.location.href = talk.href;
        }
      });
    });

    scope.querySelectorAll("[data-cta-official-request]").forEach((el) => {
      mark(el, STATUS.NOT_BOUND, "NO_HANDLER");
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        notifyNotBound(el, "正式依頼");
      });
    });

    scope.querySelectorAll("[data-cta-apply]").forEach((el) => {
      if (!id || !rec.project_id && !rec.title) {
        mark(el, STATUS.NOT_BOUND, "NO_JOB");
        el.addEventListener("click", (ev) => {
          ev.preventDefault();
          notifyNotBound(el, "応募");
        });
        return;
      }
      mark(el, STATUS.BOUND, "mvp-apply");
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        const res = applyToMvp(rec.project_id || id);
        const host = scope.querySelector("[data-canonical-cta-status]");
        if (!res.ok) {
          if (host) {
            host.hidden = false;
            host.textContent = res.reason === "ALREADY_APPLIED" ? "すでに応募済みです。" : `応募できません（${res.reason}）。`;
          }
          return;
        }
        if (host) {
          host.hidden = false;
          host.textContent = "応募を受け付けました（COMPAT_CACHE）。";
        }
      });
    });

    scope.querySelectorAll("[data-cta-question]").forEach((el) => {
      mark(el, STATUS.NOT_BOUND, "NO_HANDLER");
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        notifyNotBound(el, "質問");
      });
    });

    scope.querySelectorAll("[data-cta-favorite]").forEach((el) => {
      const favId = String(el.getAttribute("data-cta-favorite") || rec.partner_id || rec.id || id);
      if (!favId) {
        mark(el, STATUS.NOT_BOUND, "NO_ID");
        return;
      }
      mark(el, STATUS.BOUND, "compat-favorite");
      el.classList.toggle("is-active", isFavorite(favId));
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        const res = toggleFavorite(favId);
        if (!res.ok) {
          notifyNotBound(el, "お気に入り");
          return;
        }
        el.classList.toggle("is-active", !!res.active);
        el.setAttribute("aria-pressed", res.active ? "true" : "false");
      });
    });
  }

  global.TasuBuilderCtaBind = {
    STATUS,
    bind,
    applyToMvp,
    toggleFavorite,
    isFavorite,
    hasTalkHandler,
  };
})(typeof window !== "undefined" ? window : globalThis);
