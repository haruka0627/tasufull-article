/**
 * AI秘書 Phase 6-G — Google Contacts UI (read-only)
 */
(function (global) {
  "use strict";

  let mounted = false;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function $(root, sel) {
    return (root || document).querySelector(sel);
  }

  function renderDetail(host, contact, root) {
    if (!host) return;
    if (!contact) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    const email = (Array.isArray(contact.emails) ? contact.emails : []).join(", ") || "—";
    const phone = (Array.isArray(contact.phones) ? contact.phones : []).join(", ") || "—";
    const hasEmail = Array.isArray(contact.emails) && contact.emails.length > 0;
    host.hidden = false;
    host.innerHTML =
      `<article class="ops-secretary-gmail__card ops-secretary-contacts__detail">` +
      `<header class="ops-secretary-gmail__card-head">` +
      `<strong class="ops-secretary-gmail__subject">${esc(contact.name)}</strong>` +
      `<span class="ops-secretary-gmail__meta">${esc(contact.company || "会社未設定")}</span>` +
      `</header>` +
      `<dl class="ops-secretary-calendar__detail-list">` +
      `<dt>メール</dt><dd>${esc(email)}</dd>` +
      `<dt>電話</dt><dd>${esc(phone)}</dd>` +
      `<dt>会社</dt><dd>${esc(contact.company || "—")}</dd>` +
      `<dt>メモ</dt><dd>${esc(contact.notes || "—")}</dd>` +
      `</dl>` +
      `<div class="ops-secretary-gmail__actions">` +
      (hasEmail
        ? `<button type="button" class="ops-p3-action" data-contacts-action="gmail">Gmail返信へ</button>` +
          `<button type="button" class="ops-p3-action" data-contacts-action="calendar">Calendar参加者へ</button>`
        : `<span class="ops-secretary-gmail__readonly">メールアドレスがないため補助導線は利用できません</span>`) +
      `<button type="button" class="ops-p3-action" data-ops-contacts-detail-close>閉じる</button>` +
      `</div>` +
      `</article>`;
    host.querySelector("[data-ops-contacts-detail-close]")?.addEventListener("click", () => {
      renderDetail(host, null, root);
    });
    host.querySelector('[data-contacts-action="gmail"]')?.addEventListener("click", () => {
      global.TasuSecretaryGoogleContactsClient?.applyToGmailReply?.(contact);
    });
    host.querySelector('[data-contacts-action="calendar"]')?.addEventListener("click", () => {
      global.TasuSecretaryGoogleContactsClient?.applyToCalendarAttendee?.(contact);
    });
  }

  function renderCards(host, contacts, root) {
    if (!host) return;
    contacts = Array.isArray(contacts) ? contacts : [];
    if (!contacts.length) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">連絡先はありません</p>';
      return;
    }
    host.innerHTML = contacts
      .map((c) => {
        const email = (Array.isArray(c.emails) ? c.emails[0] : "") || "—";
        const phone = (Array.isArray(c.phones) ? c.phones[0] : "") || "—";
        return (
          `<article class="ops-secretary-gmail__card ops-secretary-contacts__card" data-contacts-id="${esc(c.id)}" tabindex="0" role="button">` +
          `<header class="ops-secretary-gmail__card-head">` +
          `<strong class="ops-secretary-gmail__subject">${esc(c.name)}</strong>` +
          `<span class="ops-secretary-gmail__meta">${esc(c.company || "")}</span>` +
          `</header>` +
          `<p class="ops-secretary-gmail__snippet">${esc(email)} · ${esc(phone)}</p>` +
          (c.notes ? `<p class="ops-secretary-gmail__snippet">${esc(String(c.notes).slice(0, 120))}</p>` : "") +
          `</article>`
        );
      })
      .join("");
    host.__contacts = contacts;
    host.querySelectorAll("[data-contacts-id]").forEach((card) => {
      const open = () => {
        const id = card.getAttribute("data-contacts-id");
        const hit = (host.__contacts || []).find((c) => c.id === id);
        renderDetail($(root, "[data-ops-secretary-contacts-detail]"), hit, root);
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          open();
        }
      });
    });
  }

  async function loadConnections(root, label) {
    const Client = global.TasuSecretaryGoogleContactsClient;
    const host = $(root, "[data-ops-secretary-contacts-cards]");
    const status = $(root, "[data-ops-secretary-contacts-status]");
    if (!Client?.listConnections || !host) return;
    if (status) status.textContent = `${label || "連絡先"}を読込中…`;
    host.innerHTML = '<p class="ops-secretary-gmail__empty">読込中…</p>';
    const result = await Client.listConnections({ maxResults: 25 });
    if (!result.ok) {
      if (status) status.textContent = `Contacts エラー: ${String(result.error || "failed").slice(0, 80)}`;
      host.innerHTML = '<p class="ops-secretary-gmail__empty">Contacts を読み込めませんでした</p>';
      return;
    }
    const contacts = result.data?.contacts || [];
    renderCards(host, contacts, root);
    const mock = result.data?.mock ? " · mock" : "";
    if (status) status.textContent = `${label || "連絡先"} ${contacts.length} 件${mock}`;
  }

  async function loadSearch(root, q) {
    const Client = global.TasuSecretaryGoogleContactsClient;
    const host = $(root, "[data-ops-secretary-contacts-cards]");
    const status = $(root, "[data-ops-secretary-contacts-status]");
    if (!Client?.searchContacts || !host) return;
    if (status) status.textContent = `検索 ${q.slice(0, 24)}…`;
    host.innerHTML = '<p class="ops-secretary-gmail__empty">読込中…</p>';
    const result = await Client.searchContacts(q, { maxResults: 25 });
    if (!result.ok) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">検索できませんでした</p>';
      if (status) status.textContent = "Contacts 検索エラー";
      return;
    }
    const contacts = result.data?.contacts || [];
    renderCards(host, contacts, root);
    if (status) status.textContent = `検索結果 ${contacts.length} 件`;
  }

  function bindSearch(root) {
    const searchForm = $(root, "[data-ops-secretary-contacts-search-form]");
    if (!searchForm || searchForm.dataset.bound === "1") return;
    searchForm.dataset.bound = "1";
    searchForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const input = $(root, "[data-ops-secretary-contacts-search-input]");
      const q = String(input?.value || "").trim();
      if (!q) {
        void loadConnections(root, "連絡先一覧");
        return;
      }
      void loadSearch(root, q);
    });
    const listBtn = $(root, "[data-ops-secretary-contacts-list-btn]");
    if (listBtn && listBtn.dataset.bound !== "1") {
      listBtn.dataset.bound = "1";
      listBtn.addEventListener("click", () => void loadConnections(root, "連絡先一覧"));
    }
  }

  function mount(root) {
    root = root || document.querySelector("[data-ops-secretary-contacts-panel]");
    if (!root || mounted) return;
    mounted = true;
    bindSearch(root);
    void loadConnections(root, "連絡先一覧");
  }

  global.TasuSecretaryGoogleContactsUI = {
    mount,
    loadConnections,
    loadSearch,
    renderCards,
    renderDetail,
  };
})(typeof window !== "undefined" ? window : globalThis);
