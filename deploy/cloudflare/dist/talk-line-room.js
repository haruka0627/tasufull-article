/**
 * TASFUL TALK — LINE風 右ペイン（ページ遷移なし）
 */
(function (global) {
  "use strict";

  const ME_ID = "u_me";

  /** @type {object|null} */
  let activeThread = null;
  /** @type {Array<object>} */
  let displayMessages = [];
  /** @type {string} */
  let partnerLastReadAt = "";
  /** @type {(() => Array<object>)|null} */
  let getThreadsRef = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getMeId() {
    if (global.TasuChatUserIdentity?.getEffectiveUserId) {
      return global.TasuChatUserIdentity.getEffectiveUserId();
    }
    return global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId || ME_ID;
  }

  function formatTime(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function formatDay(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }

  function groupByDay(messages) {
    const map = {};
    for (const msg of messages || []) {
      const key = formatDay(msg.createdAt) || "unknown";
      if (!map[key]) map[key] = [];
      map[key].push(msg);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }

  function enrichThread(thread) {
    return global.TasuTalkChatThreadModel?.enrichThread?.(thread) || thread;
  }

  function resolveExternalHref(thread) {
    return global.TasuTalkData?.resolveThreadExternalHref?.(thread) || "";
  }

  function resolveTransactionChatRedirectHref(thread) {
    const Data = global.TasuTalkData;
    if (!Data?.isTransactionPartnerThread?.(thread)) return "";
    if (thread?._officialRoom || thread?._staticCard) return "";
    const href = Data.resolveChatTalkHref?.(thread) || "";
    if (href && !href.startsWith("#")) return href;
    return "";
  }

  function threadKindLabel(kind) {
    const map = {
      direct: "1対1",
      group: "グループ",
      listing_inquiry: "案件問い合わせ",
    };
    return map[kind] || "";
  }

  function channelLabelForRow(row) {
    const ch = global.TasuTalkData?.resolveChatChannel?.(row) || "";
    return global.TasuTalkData?.getChatChannelLabel?.(ch) || ch;
  }

  function isMobileTalkLayout() {
    return Boolean(global.matchMedia?.("(max-width: 960px)")?.matches);
  }

  function isOfficialThread(thread) {
    const row = thread || activeThread;
    return Boolean(row?._officialRoom || global.TasuTalkOfficialRooms?.isOfficialRoomId?.(row?.id));
  }

  function isGroupFriendThread(thread) {
    const row = thread || activeThread;
    if (!row || row.chatDomain !== "friend") return false;
    const kind = String(row.threadKind || row.thread_kind || row.kind || "direct").toLowerCase();
    return kind === "group";
  }

  function isDirectFriendThread(thread) {
    const row = thread || activeThread;
    if (!row || row.chatDomain !== "friend" || isOfficialThread(row)) return false;
    return !isGroupFriendThread(row);
  }

  function shouldShowPeerSenderName(thread) {
    return isGroupFriendThread(thread);
  }

  function shouldShowFriendReadReceipt(thread) {
    return isDirectFriendThread(thread);
  }

  function resolveReadReceiptMessageId(messages, meId, partnerLastReadAtIso) {
    if (global.TasuChatSupabase?.getReadReceiptMessageId) {
      return global.TasuChatSupabase.getReadReceiptMessageId(messages, meId, partnerLastReadAtIso);
    }
    if (!partnerLastReadAtIso) return null;
    let latestOwn = null;
    let latestMs = -Infinity;
    for (const m of messages || []) {
      if (String(m.senderId) !== String(meId)) continue;
      const createdMs = new Date(m.createdAt).getTime();
      if (!Number.isFinite(createdMs)) continue;
      if (createdMs >= latestMs) {
        latestMs = createdMs;
        latestOwn = m;
      }
    }
    if (!latestOwn) return null;
    const readMs = new Date(partnerLastReadAtIso).getTime();
    if (!Number.isFinite(readMs) || !Number.isFinite(latestMs)) return null;
    return latestMs <= readMs ? String(latestOwn.id) : null;
  }

  async function loadPartnerLastReadAt(thread) {
    if (!shouldShowFriendReadReceipt(thread)) return "";
    const partnerId = thread?.partnerUserId || thread?.partner?.id || "";
    if (partnerId && global.TasuChatSupabase?.fetchReadAtByRoomAndUser) {
      try {
        const readAt = await global.TasuChatSupabase.fetchReadAtByRoomAndUser(thread.id, partnerId);
        if (readAt) return readAt;
      } catch (err) {
        console.warn("[TasuTalkLineRoom] fetchReadAt failed:", err);
      }
    }
    if (String(thread?.id) === "talk-mock-friend-001") {
      return new Date().toISOString();
    }
    return thread?.partnerLastReadAt || "";
  }

  function renderAvatar(profile, hints, size, className) {
    return (
      global.TasuTalkChatProfile?.renderAvatarHtml?.({
        profile,
        hints,
        size,
        className,
        escapeHtml,
      }) || `<span class="${className} ${className}--initials">?</span>`
    );
  }

  function getDemoMessages(threadId) {
    const id = String(threadId || "");
    const partnerName =
      activeThread?.partnerProfile?.display_name ||
      activeThread?.partner?.displayName ||
      "相手";
    const partnerId = activeThread?.partnerUserId || activeThread?.partner?.id || "u_partner";
    const partnerAvatar =
      global.TasuTalkChatProfile?.pickAvatarUrl?.(
        activeThread?.partnerProfile,
        activeThread?.partner
      ) || "";
    const meId = getMeId();
    const now = Date.now();
    const seeds = {
      "talk-mock-friend-001": [
        { text: "週末の打ち合わせ、18時で大丈夫？", offsetMin: 12, fromPartner: true },
        { text: "大丈夫です！よろしくお願いします。", offsetMin: 8, fromPartner: false },
        { text: "場所はいつものカフェで。", offsetMin: 5, fromPartner: true },
      ],
      "talk-mock-group-001": [
        { text: "明日の集合時間を確認してください", offsetMin: 20, fromPartner: true, senderName: "佐藤" },
        { text: "8:00でお願いします", offsetMin: 15, fromPartner: true, senderName: "鈴木" },
        { text: "了解しました", offsetMin: 10, fromPartner: false },
      ],
      default: [
        { text: "はじめまして。よろしくお願いします。", offsetMin: 30, fromPartner: true },
        { text: "こちらこそ。内容確認しました。", offsetMin: 18, fromPartner: false },
        { text: activeThread?.lastMessagePreview || "最新のやり取りです（デモ）", offsetMin: 2, fromPartner: true },
      ],
    };
    const rows = seeds[id] || seeds.default;
    return rows.map((row, i) => ({
      id: `demo_${id}_${i}`,
      senderId: row.fromPartner ? partnerId : meId,
      senderName: row.fromPartner ? row.senderName || partnerName : "自分",
      senderAvatarUrl: row.fromPartner ? partnerAvatar : "",
      text: row.text,
      createdAt: new Date(now - row.offsetMin * 60 * 1000).toISOString(),
      kind: "user",
      attachment: null,
    }));
  }

  async function loadMessagesForThread(thread) {
    const id = String(thread?.id || "");
    if (!id) return [];
    if (global.TasuTalkOfficialRooms?.isOfficialRoomId?.(id)) {
      return global.TasuTalkOfficialRooms.loadMessagesForRoom(id);
    }
    try {
      if (global.TasuChatService?.loadMessages) {
        const { messages } = await global.TasuChatService.loadMessages(id);
        if (Array.isArray(messages) && messages.length) return messages;
      }
    } catch (err) {
      console.warn("[TasuTalkLineRoom] loadMessages failed:", err);
    }
    return getDemoMessages(id);
  }

  function setListSelection(threadId) {
    document.querySelectorAll("[data-talk-select-thread]").forEach((el) => {
      const on = String(el.getAttribute("data-talk-thread-id")) === String(threadId);
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-current", on ? "true" : "false");
    });
  }

  function updateUrlThread(threadId) {
    try {
      const url = new URL(global.location.href);
      if (threadId) url.searchParams.set("thread", threadId);
      else url.searchParams.delete("thread");
      url.searchParams.set("tab", "chat");
      global.history.replaceState(null, "", url.pathname + url.search);
    } catch {
      /* ignore */
    }
  }

  /**
   * 右ペイン empty / active の表示を class + hidden で同期
   * @param {"empty"|"active"} mode
   */
  function setRoomState(mode) {
    const isActive = mode === "active";
    const col = $("[data-talk-line-room]");
    const empty = $("[data-talk-line-room-empty]");
    const active = $("[data-talk-line-room-active]");
    const composer = $("[data-talk-line-composer]");
    const composerInput = $("[data-talk-line-composer-input]");

    if (col) {
      col.classList.toggle("talk-line-room--empty", !isActive);
      col.classList.toggle("talk-line-room--active", isActive);
      if (isActive && activeThread?.id) {
        col.setAttribute("data-selected-thread-id", String(activeThread.id));
      } else {
        col.removeAttribute("data-selected-thread-id");
      }
    }

    if (empty) {
      empty.hidden = isActive;
      empty.setAttribute("aria-hidden", isActive ? "true" : "false");
    }
    if (active) {
      active.hidden = !isActive;
      active.setAttribute("aria-hidden", isActive ? "false" : "true");
    }
    if (composer) {
      composer.hidden = !isActive;
      composer.setAttribute("aria-hidden", isActive ? "false" : "true");
    }
    if (composerInput) {
      composerInput.disabled = !isActive;
      if (!isActive) composerInput.value = "";
    }

    const split = $("[data-talk-line-split]");
    if (split) {
      split.classList.toggle("talk-line-split--room-open", isActive);
    }
  }

  function showEmpty() {
    activeThread = null;
    displayMessages = [];
    setListSelection("");
    updateUrlThread("");
    global.TasuTalkLineRoom._activeProfile = null;
    global.TasuTalkLineRoom._activeThread = null;
    setRoomState("empty");
  }

  function showActiveRoom() {
    setRoomState("active");
  }

  function buildHeaderChips(row, profile, options) {
    const mobile = options?.mobile === true;
    if (row._officialRoom) {
      return "";
    }
    if (row._staticCard) {
      if (row.id === "talk-hub-ai") {
        return `<span class="talk-line-room-chip talk-line-room-chip--ai">AI</span>`;
      }
      if (row.id === "talk-hub-support") {
        return `<span class="talk-line-room-chip talk-line-room-chip--support">サポート</span>`;
      }
      if (row.id === "talk-hub-friend") {
        return `<span class="talk-line-room-chip talk-line-room-chip--friend">友達</span>`;
      }
    }
    const chips = [];
    const domain =
      row.chatDomain === "friend"
        ? { label: "友達", cls: "friend" }
        : row.chatDomain === "work"
          ? { label: "仕事", cls: "work" }
          : null;
    if (domain) {
      chips.push(
        `<span class="talk-line-room-chip talk-line-room-chip--${domain.cls}">${escapeHtml(domain.label)}</span>`
      );
    }
    const kind = threadKindLabel(row.threadKind);
    if (kind && (!mobile || row.threadKind !== "direct")) {
      chips.push(`<span class="talk-line-room-chip talk-line-room-chip--kind">${escapeHtml(kind)}</span>`);
    }
    if (mobile) {
      return chips.slice(0, 2).join("");
    }
    const cat = String(profile.category || row._category || row.listing?.category || "").trim();
    if (cat) {
      chips.push(`<span class="talk-line-room-chip">${escapeHtml(cat)}</span>`);
    }
    const chLabel = channelLabelForRow(row);
    if (chLabel && chLabel !== cat) {
      chips.push(`<span class="talk-line-room-chip talk-line-room-chip--channel">${escapeHtml(chLabel)}</span>`);
    }
    return chips.join("");
  }

  function setPeerHeader(thread) {
    const row = enrichThread(thread);
    const profile = row.partnerProfile || {};

    const avatarSlot = $("[data-talk-line-peer-avatar-slot]");
    const avatarLink = $("[data-talk-line-peer-avatar-link]");
    const nameEl = $("[data-talk-line-peer-name]");
    const subtitleEl = $("[data-talk-line-peer-subtitle]");
    const chipsEl = $("[data-talk-line-peer-chips]");

    if (avatarSlot) {
      avatarSlot.innerHTML = renderAvatar(profile, row.partner, 36, "talk-line-room-header__avatar");
    }
    if (avatarLink) {
      avatarLink.href = "#";
      avatarLink.setAttribute("tabindex", "-1");
      avatarLink.setAttribute("aria-hidden", "true");
    }
    if (nameEl) nameEl.textContent = row.groupName || profile.display_name || "相手";

    const mobileLayout = isMobileTalkLayout();
    const subParts = [];
    if (!mobileLayout) {
      if (row.chatDomain === "work" && row.listing?.title) {
        subParts.push(row.listing.title);
      } else if (profile.status_message) {
        subParts.push(profile.status_message);
      }
      if (profile.location) subParts.push(profile.location);
      if (profile.review_count > 0) {
        subParts.push(`★${profile.rating}（${profile.review_count}件）`);
      }
    }
    if (subtitleEl) {
      if (subParts.length) {
        subtitleEl.textContent = subParts.join(" · ");
        subtitleEl.hidden = false;
      } else {
        subtitleEl.textContent = "";
        subtitleEl.hidden = true;
      }
    }

    if (chipsEl) {
      const html = buildHeaderChips(row, profile, { mobile: mobileLayout });
      if (html) {
        chipsEl.innerHTML = html;
        chipsEl.hidden = false;
      } else {
        chipsEl.innerHTML = "";
        chipsEl.hidden = true;
      }
    }

    const headerEl = document.querySelector(".talk-line-room-header");
    if (headerEl) {
      headerEl.classList.toggle("talk-line-room-header--notify-center", Boolean(row._officialRoom));
    }

    const ctxWrap = $("[data-talk-line-room-context]");
    const ctxTitle = $("[data-talk-line-room-context-title]");
    const ctxLink = $("[data-talk-line-room-context-link]");
    const isWork = row.chatDomain === "work";
    if (ctxWrap) {
      if (isWork && (row.listing?.title || row._detailUrl)) {
        ctxWrap.hidden = false;
        if (ctxTitle) ctxTitle.textContent = row.listing?.title || "案件・問い合わせ";
        const detailUrl =
          row._detailUrl ||
          row.listing?.detailUrl ||
          global.TasuTalkData?.resolveChatListingUrl?.(row) ||
          "";
        if (ctxLink && detailUrl) {
          ctxLink.href = detailUrl;
          ctxLink.hidden = false;
        } else if (ctxLink) {
          ctxLink.hidden = true;
        }
      } else {
        ctxWrap.hidden = true;
      }
    }

    global.TasuTalkLineRoom._activeProfile = profile;
    global.TasuTalkLineRoom._activeThread = row;
  }

  function messageAvatarHtml(m, isMe) {
    if (isMe) {
      return renderAvatar(null, { display_name: "自分" }, 36, "chat-msg__avatar");
    }
    return peerMessageAvatarHtml(m);
  }

  function peerMessageAvatarHtml(m) {
    const profile = activeThread?.partnerProfile || {};
    const url = global.TasuTalkChatProfile?.pickAvatarUrl?.(profile, {
      ...activeThread?.partner,
      avatar_url: m.senderAvatarUrl,
      image_url: m.senderAvatarUrl,
    });
    return renderAvatar(
      profile,
      {
        ...activeThread?.partner,
        avatar_url: url || m.senderAvatarUrl,
        display_name: m.senderName,
      },
      32,
      "message-avatar"
    );
  }

  function renderPeerTextMessage(m, name, text, createdAt, showSenderName) {
    const avatarBlock = peerMessageAvatarHtml(m);
    const time = escapeHtml(formatTime(createdAt));
    const nameBlock = showSenderName ? `<span class="chat-bubble__name">${name}</span>` : "";
    return `<div class="message-row peer">${avatarBlock}<div class="message-main"><div class="message-bubble chat-bubble" role="group" aria-label="メッセージ">${nameBlock}<p class="chat-bubble__text">${text}</p></div><time class="message-time" datetime="${escapeHtml(createdAt)}">${time}</time></div></div>`;
  }

  function renderNotifyCardMessage(m, cls, avatarBlock, name, time) {
    const roomId = activeThread?.id || "";
    const cardHtml =
      window.TasuTalkOfficialNotifyCard?.renderHtml?.(m, { escapeHtml, roomId }) || "";
    if (cardHtml) {
      return `
      <div class="${cls} chat-msg--system-card chat-msg--official-notify">
        <div class="chat-msg__content chat-msg__content--them chat-msg__content--notify-card">
          ${cardHtml}
        </div>
      </div>`;
    }
    const card = m.notifyCard || {};
    const hrefRaw = card.href || "#";
    const hrefResolved =
      window.TasuTalkNotifyActions?.appendFromTalkParam?.(hrefRaw) || hrefRaw;
    const href = escapeHtml(hrefResolved);
    const action =
      card.actionLabel && card.href
        ? `<a class="chat-notify-card__action" href="${href}">${escapeHtml(card.actionLabel)}</a>`
        : "";
    const title = escapeHtml(card.title || m.text || "");
    const body = escapeHtml(card.body || "");
    const bodyBlock = body ? `<p class="chat-bubble__text">${body}</p>` : "";
    return `
      <div class="${cls} chat-msg--system-card">
        <div class="chat-msg__content chat-msg__content--them">
          <div class="chat-bubble-stack chat-bubble-stack--them">
            <div class="chat-bubble chat-bubble--notify-card">
              <span class="chat-bubble__name">${name}</span>
              <strong class="chat-notify-card__title">${title}</strong>
              ${bodyBlock}
              ${action}
            </div>
            <time class="chat-msg__time chat-msg__time--them" datetime="${escapeHtml(m.createdAt)}">${time}</time>
          </div>
        </div>
      </div>`;
  }

  function renderMessages(messages) {
    const wrap = $("[data-talk-line-messages]");
    if (!wrap) return;
    const meId = getMeId();
    const showPeerSenderName = shouldShowPeerSenderName(activeThread);
    const readReceiptMessageId = shouldShowFriendReadReceipt(activeThread)
      ? resolveReadReceiptMessageId(messages, meId, partnerLastReadAt)
      : null;
    const groups = groupByDay(messages);
    wrap.innerHTML = groups
      .map(([day, list]) => {
        const dayLabel = escapeHtml(day === "unknown" ? "" : day);
        const dayBlock = dayLabel
          ? `<div class="chat-day" aria-label="日付">${dayLabel}</div>`
          : "";
        const msgs = list
          .map((m) => {
            const isMe = String(m.senderId) === String(meId);
            const cls = isMe ? "chat-msg chat-msg--me" : "chat-msg";
            const avatarBlock = messageAvatarHtml(m, isMe);
            const name = escapeHtml(m.senderName || "");
            const time = escapeHtml(formatTime(m.createdAt));
            if (!isMe && m.kind === "notify_card" && m.notifyCard) {
              return renderNotifyCardMessage(m, cls, avatarBlock, name, time);
            }
            const text = escapeHtml(m.text || "");
            if (isMe) {
              const showRead =
                readReceiptMessageId && readReceiptMessageId === String(m.id);
              const readLine = showRead
                ? `<span class="chat-msg__read" aria-label="既読">既読</span>`
                : "";
              return `
              <div class="${cls}">
                <div class="chat-msg__content chat-msg__content--me">
                  <div class="chat-bubble-stack chat-bubble-stack--me">
                    <div class="chat-bubble" role="group" aria-label="メッセージ">
                      ${text ? `<p class="chat-bubble__text">${text}</p>` : ""}
                    </div>
                    <div class="chat-msg__meta chat-msg__meta--me">
                      ${readLine}
                      <time class="chat-msg__time chat-msg__time--me" datetime="${escapeHtml(m.createdAt)}">${time}</time>
                    </div>
                  </div>
                </div>
              </div>`;
            }
            return renderPeerTextMessage(m, name, text, m.createdAt, showPeerSenderName);
          })
          .join("");
        return `${dayBlock}${msgs}`;
      })
      .join("");
    scrollToBottomAfterPaint();
  }

  function scrollToBottom() {
    const wrap = $("[data-talk-line-messages]");
    if (!wrap) return;
    wrap.scrollTop = wrap.scrollHeight;
  }

  function scrollToBottomAfterPaint() {
    const run = () => scrollToBottom();
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    [0, 60, 160, 320].forEach((ms) => global.setTimeout(run, ms));
  }

  async function openThread(thread) {
    if (!thread?.id) return;

    const external = resolveExternalHref(thread);
    if (external) {
      global.location.href = external;
      return;
    }

    const txRedirect = resolveTransactionChatRedirectHref(thread);
    if (txRedirect) {
      global.location.href = txRedirect;
      return;
    }

    activeThread = enrichThread(thread);
    showActiveRoom();
    setPeerHeader(activeThread);
    setListSelection(activeThread.id);
    updateUrlThread(activeThread.id);

    const composer = $("[data-talk-line-composer]");
    const isOfficial = global.TasuTalkOfficialRooms?.isOfficialRoomId?.(activeThread.id);
    const isStaticHub = Boolean(activeThread._staticCard);
    if (composer) {
      composer.hidden = Boolean(isOfficial) || isStaticHub;
      composer.setAttribute("aria-hidden", isOfficial || isStaticHub ? "true" : "false");
    }

    const wrap = $("[data-talk-line-messages]");
    if (wrap) {
      wrap.innerHTML = `<p class="talk-line-messages-loading">読み込み中…</p>`;
    }
    partnerLastReadAt = await loadPartnerLastReadAt(activeThread);
    displayMessages = await loadMessagesForThread(activeThread);
    renderMessages(displayMessages);
    if (isOfficial) {
      global.TasuTalkOfficialRooms?.markRoomRead?.(activeThread.id);
      try {
        global.dispatchEvent(new CustomEvent("tasful-official-room-read", { detail: { roomId: activeThread.id } }));
      } catch {
        /* ignore */
      }
    }
  }

  function openThreadById(threadId) {
    const id = String(threadId || "").trim();
    if (!id) {
      showEmpty();
      return;
    }
    const threads = getThreadsRef?.() || [];
    const row = threads.find((t) => String(t.id) === id);
    if (row) openThread(row);
  }

  function handleListClick(event) {
    const target = /** @type {HTMLElement|null} */ (event.target);
    const row = target?.closest?.("[data-talk-select-thread]");
    if (!row) return;
    event.preventDefault();
    const id = row.getAttribute("data-talk-thread-id");
    const threads = getThreadsRef?.() || [];
    const thread = threads.find((t) => String(t.id) === id);
    if (thread) openThread(thread);
  }

  function wireComposer() {
    const form = $("[data-talk-line-composer]");
    if (!form || form.dataset.wired) return;
    form.dataset.wired = "1";
    const input = $("[data-talk-line-composer-input]");
    if (input && global.matchMedia?.("(max-width: 960px)").matches) {
      const scrollComposerIntoView = () => {
        const composer = $("[data-talk-line-composer]");
        try {
          (composer || input).scrollIntoView({ block: "end", behavior: "smooth" });
        } catch {
          (composer || input).scrollIntoView(false);
        }
      };
      input.addEventListener("focus", () => {
        global.setTimeout(scrollComposerIntoView, 280);
      });
      if (global.visualViewport) {
        global.visualViewport.addEventListener("resize", () => {
          if (document.activeElement === input) scrollComposerIntoView();
        });
      }
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = /** @type {HTMLTextAreaElement|null} */ ($("[data-talk-line-composer-input]"));
      const text = String(input?.value || "").trim();
      if (!text || !activeThread) return;
      const msg = {
        id: `local_${Date.now()}`,
        senderId: getMeId(),
        senderName: "自分",
        senderAvatarUrl: "",
        text,
        createdAt: new Date().toISOString(),
        kind: "user",
        attachment: null,
      };
      displayMessages = [...displayMessages, msg];
      renderMessages(displayMessages);
      if (input) input.value = "";
    });
  }

  function wireBack() {
    const btn = $("[data-talk-line-room-back]");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => showEmpty());
  }

  function wireRoomActions() {
    const room = $("[data-talk-line-room]");
    if (!room || room.dataset.lineActionsWired) return;
    room.dataset.lineActionsWired = "1";
    room.addEventListener("click", (event) => {
      const btn = /** @type {HTMLElement|null} */ (
        event.target instanceof Element ? event.target.closest("[data-talk-line-action]") : null
      );
      if (!btn || btn.disabled) return;
      const action = btn.getAttribute("data-talk-line-action");
      if (action === "profile") {
        event.preventDefault();
        global.TasuTalkSubNav?.navigateToSubPage?.("talk-profile.html", { thread: activeThread });
      }
      if (action === "ai") {
        event.preventDefault();
        global.TasuTalkHomeUi?.setLineNav?.("ai");
      }
    });
  }

  function wireList() {
    const list = document.getElementById("talkChatThreadList");
    if (!list || list.dataset.lineRoomWired) return;
    list.dataset.lineRoomWired = "1";
    list.addEventListener("click", handleListClick);
  }

  function wireNotifyCardActions() {
    const wrap = $("[data-talk-line-messages]");
    if (!wrap || wrap.dataset.notifyCardWired) return;
    wrap.dataset.notifyCardWired = "1";
    wrap.addEventListener("click", (event) => {
      const cta = /** @type {HTMLElement|null} */ (
        event.target instanceof Element ? event.target.closest(".talk-line-room-notify-card__cta") : null
      );
      if (!cta || cta.classList.contains("talk-line-room-notify-card__cta--muted")) return;
      const card = cta.closest(".talk-line-room-notify-card");
      const notifId = pickStr(card?.getAttribute("data-notification-id"));
      if (!notifId) return;
      global.TasuTalkData?.markNotificationRead?.(notifId);
      global.TasuTalkNotifications?.markRead?.(notifId);
      card?.classList.remove("talk-line-room-notify-card--unread");
      card?.querySelector(".talk-line-room-notify-card__unread-dot")?.remove();
    });
  }

  function init(options) {
    getThreadsRef = options?.getThreads || null;
    wireList();
    wireComposer();
    wireBack();
    wireRoomActions();
    wireNotifyCardActions();

    const threadId = pickStr(
      options?.threadIdFromUrl,
      new URLSearchParams(global.location.search).get("thread"),
      new URLSearchParams(global.location.search).get("roomId")
    );

    if (threadId) {
      const opened = () => {
        const threads = getThreadsRef?.() || [];
        if (threads.length) openThreadById(threadId);
        else global.setTimeout(opened, 50);
      };
      opened();
      return;
    }

    setRoomState("empty");
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  global.TasuTalkLineRoom = {
    init,
    openThread,
    openThreadById,
    showEmpty,
    getActiveThreadId: () => activeThread?.id || "",
    _activeProfile: null,
    _activeThread: null,
  };
})(typeof window !== "undefined" ? window : globalThis);
