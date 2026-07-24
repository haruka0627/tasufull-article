/**
 * Builder — 連絡先開示（Contact Reveal）demo ストア
 * チャット料金ではなく、氏名/電話/メール等の直接連絡先開示料（550円）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful:builder:contact-reveals:v1";
  const FEE_YEN = global.TasuBuilderBillingPolicy?.CONTACT_REVEAL_FEE_YEN || 550;

  const DEMO_CONTACTS = Object.freeze({
    worker: Object.freeze({
      w1: { name: "山本 健一", phone: "090-1234-5678", email: "yamamoto@denko-worker.example.jp" },
      w2: { name: "佐藤 美咲", phone: "080-2345-6789", email: "sato.cross@example.jp" },
      w3: { name: "鈴木 大輔", phone: "070-3456-7890", email: "suzuki.carpenter@example.jp" },
      w4: { name: "田中 塗装", phone: "090-4567-8901", email: "tanaka.paint@example.jp" },
      w5: { name: "伊藤 設備", phone: "080-5678-9012", email: "ito.plumbing@example.jp" },
      w6: { name: "高橋 清掃", phone: "070-6789-0123", email: "takahashi.clean@example.jp" },
    }),
    vendor: Object.freeze({
      "demo-partner-001": {
        name: "田中建一",
        phone: "03-5555-0101",
        email: "tanaka@orange-kensou.example.jp",
      },
      "demo-partner-002": {
        name: "足場 太郎",
        phone: "090-8888-0202",
        email: "taro@ashiba-works.example.jp",
      },
      "demo-partner-003": {
        name: "設備 担当",
        phone: "045-777-0303",
        email: "info@slate-setsubi.example.jp",
      },
    }),
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readStore() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeStore(map) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(map || {}));
      global.dispatchEvent?.(new CustomEvent("builder:contact-reveal-changed"));
    } catch {
      /* ignore */
    }
  }

  function revealKey(targetType, targetId) {
    return `${String(targetType || "").trim()}:${String(targetId || "").trim()}`;
  }

  function demoContact(targetType, targetId) {
    const tt = String(targetType || "").trim();
    const tid = String(targetId || "").trim();
    if ((tt === "partner" || tt === "vendor") && global.TasuBuilderVendorPagesStore?.getContactForPartner) {
      const fromPage = global.TasuBuilderVendorPagesStore.getContactForPartner(tid);
      if (fromPage && (fromPage.phone || fromPage.email)) return fromPage;
    }
    const bucket = DEMO_CONTACTS[tt === "partner" ? "vendor" : tt] || {};
    return bucket[tid] || null;
  }

  function isRevealed(targetType, targetId) {
    const key = revealKey(targetType, targetId);
    const row = readStore()[key];
    return String(row?.status || "") === "active";
  }

  function getRevealRecord(targetType, targetId) {
    return readStore()[revealKey(targetType, targetId)] || null;
  }

  function purchaseReveal(targetType, targetId, options) {
    const tt = pickStr(targetType);
    const tid = pickStr(targetId);
    if (!tt || !tid) return { ok: false, reason: "missing_target" };
    if (isRevealed(tt, tid)) {
      return { ok: true, already: true, record: getRevealRecord(tt, tid) };
    }

    const contact = options?.contact || demoContact(tt, tid);
    if (!contact) return { ok: false, reason: "no_contact_profile" };

    const confirmMsg =
      options?.confirmMessage ||
      `直接連絡先（氏名・電話・メール）を開示します。\n` +
        `連絡先開示料 ${FEE_YEN}円（税込）\n\n` +
        `※チャット料金ではありません。TASFUL Talk でのやりとりは別途無料です。`;

    if (options?.skipConfirm !== true) {
      const ok = global.confirm?.(confirmMsg);
      if (!ok) return { ok: false, reason: "cancelled" };
    }

    const now = new Date().toISOString();
    const map = readStore();
    const key = revealKey(tt, tid);
    map[key] = {
      targetType: tt,
      targetId: tid,
      status: "active",
      feeYen: FEE_YEN,
      revealedAt: now,
      contact: { ...contact },
    };
    writeStore(map);
    return { ok: true, record: map[key] };
  }

  function renderContactBlock(targetType, targetId, options) {
    const tt = pickStr(targetType);
    const tid = pickStr(targetId);
    const esc = options?.escapeHtml || ((s) => String(s ?? ""));
    const revealed = isRevealed(tt, tid);
    const record = revealed ? getRevealRecord(tt, tid) : null;
    const contact = record?.contact || demoContact(tt, tid);

    if (revealed && contact) {
      return (
        `<div class="builder-contact-reveal builder-contact-reveal--open" data-builder-contact-panel="${esc(tt)}:${esc(tid)}">` +
        `<p class="builder-contact-reveal__badge">連絡先 開示済み</p>` +
        `<dl class="builder-contact-reveal__rows">` +
        `<div><dt>担当者名</dt><dd>${esc(contact.name)}</dd></div>` +
        `<div><dt>電話番号</dt><dd><a href="tel:${esc(String(contact.phone).replace(/[^\d+]/g, ""))}">${esc(contact.phone)}</a></dd></div>` +
        `<div><dt>メール</dt><dd><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></dd></div>` +
        `</dl>` +
        `<p class="builder-contact-reveal__hint">やりとりは TASFUL Talk をご利用ください。</p>` +
        `</div>`
      );
    }

    return (
      `<div class="builder-contact-reveal builder-contact-reveal--locked" data-builder-contact-panel="${esc(tt)}:${esc(tid)}">` +
      `<p class="builder-contact-reveal__lead">電話番号・メール等の直接連絡先は開示前に表示されません。</p>` +
      `<ul class="builder-contact-reveal__masked">` +
      `<li>担当者: ●● ●●</li>` +
      `<li>電話: 090-****-****</li>` +
      `<li>メール: ****@example.jp</li>` +
      `</ul>` +
      `<button type="button" class="builder-btn builder-btn--secondary" data-builder-contact-reveal data-reveal-type="${esc(tt)}" data-reveal-target-id="${esc(tid)}">` +
      `連絡先を開示する（${FEE_YEN}円）</button>` +
      `<p class="builder-contact-reveal__note">連絡先開示料 — チャット料金ではありません</p>` +
      `</div>`
    );
  }

  function wireContactRevealButtons(root) {
    const host = root && root.addEventListener ? root : document;
    if (host.dataset?.builderContactRevealWired === "1") return;
    if (host === document && document.body) document.body.dataset.builderContactRevealWired = "1";
    else if (host.dataset) host.dataset.builderContactRevealWired = "1";

    host.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-builder-contact-reveal]");
      if (!btn || btn.hasAttribute("data-builder-talk-contact")) return;
      ev.preventDefault();
      const tt = pickStr(btn.getAttribute("data-reveal-type"), btn.dataset.revealType);
      const tid = pickStr(btn.getAttribute("data-reveal-target-id"), btn.dataset.revealTargetId);
      const result = purchaseReveal(tt, tid);
      if (!result.ok && result.reason !== "cancelled") {
        global.alert?.("連絡先開示に失敗しました。");
        return;
      }
      if (result.ok) {
        const panel = btn.closest("[data-builder-contact-panel]");
        const mount = panel?.parentElement;
        if (mount) {
          mount.innerHTML = renderContactBlock(tt, tid, {
            escapeHtml: global.TasuBuilderContactReveal?.escapeHtml,
          });
        }
        document.dispatchEvent(
          new CustomEvent("builder:contact-revealed", { detail: { targetType: tt, targetId: tid } })
        );
      }
    });
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  global.TasuBuilderContactReveal = {
    STORAGE_KEY,
    FEE_YEN,
    readStore,
    isRevealed,
    getRevealRecord,
    purchaseReveal,
    renderContactBlock,
    wireContactRevealButtons,
    demoContact,
    escapeHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
