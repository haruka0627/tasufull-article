/**
 * TASFUL TALK — 友達追加 / グループ作成 UI
 */
(function (global) {
  "use strict";

  const Store = () => global.TasuTalkFriendHubStore;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function closeAddMenu() {
    const menu = $("[data-talk-add-menu]");
    if (!menu) return;
    menu.hidden = true;
    menu.setAttribute("aria-hidden", "true");
  }

  function toggleAddMenu(anchor) {
    const menu = $("[data-talk-add-menu]");
    if (!menu) return;
    const open = menu.hidden;
    menu.hidden = !open;
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    if (open && anchor) {
      const rect = anchor.getBoundingClientRect();
      menu.style.top = `${Math.round(rect.bottom + 6)}px`;
      menu.style.right = `${Math.max(8, Math.round(global.innerWidth - rect.right))}px`;
    }
  }

  function openFriendAddModal(method) {
    closeAddMenu();
    global.TasuTalkHomeUi?.openFriendAddModal?.();
    showFriendMethodPanel(method || "qr");
    if (!method || method === "qr") renderQrPanel();
  }

  function closeFriendAddModal() {
    global.TasuTalkHomeUi?.closeFriendAddModal?.();
  }

  function showFriendMethodPanel(method) {
    const id = pickStr(method);
    document.querySelectorAll("[data-talk-friend-panel]").forEach((el) => {
      const on = el.getAttribute("data-talk-friend-panel") === id;
      el.hidden = !on;
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
    document.querySelectorAll("[data-talk-friend-method]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-talk-friend-method") === id);
    });
  }

  function renderQrPanel() {
    const host = $('[data-talk-friend-panel="qr"] [data-talk-friend-panel-body]');
    const store = Store();
    if (!host || !store) return;
    const code = store.getMyInviteCode();
    host.innerHTML = `
      <div class="talk-friend-panel__qr" aria-hidden="true">
        <div class="talk-friend-panel__qr-box">${escapeHtml(code)}</div>
      </div>
      <p class="talk-friend-panel__hint">相手にQRコードを読み取ってもらうと友達追加できます（デモ表示）</p>
      <p class="talk-friend-panel__meta">あなたのTALK ID: <strong>${escapeHtml(code)}</strong></p>`;
  }

  function renderInvitePanel() {
    const host = $('[data-talk-friend-panel="invite"] [data-talk-friend-panel-body]');
    const store = Store();
    if (!host || !store) return;
    const url = store.buildInviteUrl();
    host.innerHTML = `
      <label class="talk-friend-panel__field">
        <span class="talk-friend-panel__label">招待リンク</span>
        <input class="talk-friend-panel__input" type="text" readonly value="${escapeHtml(url)}" data-talk-friend-invite-url>
      </label>
      <button type="button" class="talk-ai-action talk-ai-action--primary" data-talk-friend-copy-invite>リンクをコピー</button>
      <button type="button" class="talk-ai-action talk-ai-action--muted" data-talk-friend-generate-invite>新しいリンクを作成</button>
      <p class="talk-friend-panel__hint">リンク経由の友達申請は将来DB連携します。</p>`;
  }

  function bindInviteCopy() {
    document.addEventListener("click", (event) => {
      const gen = event.target instanceof Element ? event.target.closest("[data-talk-friend-generate-invite]") : null;
      if (gen) {
        const store = Store();
        const link = store?.createInviteLink?.();
        const input = $("[data-talk-friend-invite-url]");
        if (input && link?.url) input.value = link.url;
        return;
      }
      const btn = event.target instanceof Element ? event.target.closest("[data-talk-friend-copy-invite]") : null;
      if (!btn) return;
      const input = $("[data-talk-friend-invite-url]");
      const text = pickStr(input?.value, Store()?.buildInviteUrl?.());
      if (!text) return;
      global.navigator?.clipboard?.writeText?.(text).catch(() => {
        if (input) {
          input.select();
          document.execCommand?.("copy");
        }
      });
    });
  }

  function handleFriendSearch(method) {
    const store = Store();
    if (!store) return;
    const input = $(`[data-talk-friend-search-input="${method}"]`);
    const resultHost = $(`[data-talk-friend-search-results="${method}"]`);
    const query = pickStr(input?.value);
    if (!resultHost) return;
    if (!query) {
      resultHost.innerHTML = `<p class="talk-friend-panel__hint">検索キーワードを入力してください。</p>`;
      return;
    }
    const rows =
      method === "phone" ? store.searchByPhone(query) : store.searchById(query);
    store.createPendingRequest({ method, query });
    if (!rows.length) {
      resultHost.innerHTML = `<p class="talk-friend-panel__hint">該当ユーザーが見つかりませんでした（デモ）。</p>`;
      return;
    }
    resultHost.innerHTML = rows
      .map(
        (row) => `
      <article class="talk-friend-search-card" data-talk-friend-user-id="${escapeHtml(row.userId)}">
        <p class="talk-friend-search-card__name">${escapeHtml(row.displayName)}</p>
        <p class="talk-friend-search-card__sub">${escapeHtml(row.statusMessage || row.talkId || row.phoneMasked || "")}</p>
        <button type="button" class="talk-ai-action talk-ai-action--primary talk-friend-search-card__btn" data-talk-friend-request="${escapeHtml(row.userId)}">友達申請（デモ）</button>
      </article>`
      )
      .join("");
  }

  function openGroupCreateModal() {
    closeAddMenu();
    const modal = $("[data-talk-group-create-modal]");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    const input = $("[data-talk-group-name-input]");
    if (input) input.focus();
  }

  function closeGroupCreateModal() {
    const modal = $("[data-talk-group-create-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function submitGroupCreate() {
    const store = Store();
    const name = pickStr($("[data-talk-group-name-input]")?.value);
    const note = pickStr($("[data-talk-group-note-input]")?.value);
    if (!store || !name) return;
    const row = store.createGroupDraft({ name, note });
    closeGroupCreateModal();
    if (row?.threadId) {
      global.dispatchEvent(
        new CustomEvent("tasful-talk-group-created", { detail: { group: row } })
      );
    }
    global.alert?.("グループ「" + name + "」を作成しました（デモ）。一覧反映は今後接続します。");
  }

  function wire() {
    if (global.__talkFriendHubUiBound) return;
    global.__talkFriendHubUiBound = true;

    $("[data-talk-friend-add-open]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleAddMenu(event.currentTarget);
    });

    document.addEventListener("click", (event) => {
      const actionBtn = event.target instanceof Element ? event.target.closest("[data-talk-add-action]") : null;
      if (actionBtn) {
        event.preventDefault();
        const action = actionBtn.getAttribute("data-talk-add-action");
        if (action === "friend") openFriendAddModal("qr");
        if (action === "group") openGroupCreateModal();
        return;
      }
      if (
        !(event.target instanceof Element) ||
        event.target.closest("[data-talk-add-menu]") ||
        event.target.closest("[data-talk-friend-add-open]")
      ) {
        return;
      }
      closeAddMenu();
    });

    document.querySelectorAll("[data-talk-friend-method]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const method = btn.getAttribute("data-talk-friend-method") || "qr";
        showFriendMethodPanel(method);
        if (method === "qr") renderQrPanel();
        if (method === "invite") renderInvitePanel();
      });
    });

    document.querySelectorAll("[data-talk-friend-search-submit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        handleFriendSearch(btn.getAttribute("data-talk-friend-search-submit") || "id");
      });
    });

    document.querySelectorAll("[data-talk-group-create-close]").forEach((el) => {
      el.addEventListener("click", closeGroupCreateModal);
    });
    $("[data-talk-group-create-submit]")?.addEventListener("click", submitGroupCreate);

    bindInviteCopy();
    renderQrPanel();
  }

  function init() {
    wire();
  }

  global.TasuTalkFriendHubUi = {
    init,
    openFriendAddModal,
    closeFriendAddModal,
    openGroupCreateModal,
    closeGroupCreateModal,
    showFriendMethodPanel,
  };
})(typeof window !== "undefined" ? window : globalThis);
