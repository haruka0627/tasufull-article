/**
 * TASFUL TALK — チャットスレッドモデル（友達 / 仕事・案件発展）
 */
(function (global) {
  "use strict";

  /** チャット領域 — 友達チャット / 仕事チャット */
  const CHAT_DOMAINS = Object.freeze({
    friend: "friend",
    work: "work",
  });

  /** 会話形態（将来: group 追加） */
  const THREAD_KINDS = Object.freeze({
    direct: "direct",
    group: "group",
    listing_inquiry: "listing_inquiry",
  });

  /** 将来機能フラグ（読み取り専用の拡張点） */
  const FUTURE_FEATURES = Object.freeze({
    friendRequest: "friend_request",
    groupChat: "group_chat",
    profilePage: "profile_page",
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isRawUserToken(value, userId) {
    const token = String(value || "").trim();
    const id = String(userId || "").trim();
    if (!token) return false;
    if (id && token === id) return true;
    if (/^u_[a-z0-9_-]+$/i.test(token)) return true;
    return false;
  }

  function isRawListingToken(value, listingId) {
    const token = String(value || "").trim();
    const id = String(listingId || "").trim();
    if (!token) return false;
    if (id && token === id) return true;
    if (/^listing_\d+$/i.test(token)) return true;
    if (!/\s/.test(token) && /^[a-z][a-z0-9_-]{2,}$/i.test(token) && token.length <= 40) {
      if (id && token === id) return true;
    }
    return false;
  }

  function resolveListingFromStores(listingId) {
    const id = pickStr(listingId);
    if (!id) return null;

    const catalog = global.TasuChatDisplayCatalog?.resolveListing?.(id);
    if (catalog?.title && catalog.title !== id) {
      return catalog;
    }

    const contacts = global.TasuListingContactRequestsStore?.resolveListing?.(id);
    if (contacts) {
      const title = pickStr(
        contacts.title,
        contacts.name,
        contacts.shop_name,
        contacts.company_name,
        contacts.service_name,
        contacts.listing_title
      );
      if (title && title !== id) {
        return {
          id,
          title,
          type: pickStr(contacts.listing_type, contacts.listingType, contacts.type),
          contactKind: pickStr(contacts.contact_kind, contacts.contactKind),
          category: pickStr(contacts.category),
        };
      }
    }

    const dummy = global.TasuChatDummy?.threads?.find((t) => String(t.listing?.id) === id);
    if (dummy?.listing?.title && dummy.listing.title !== id) {
      return dummy.listing;
    }

    return catalog || null;
  }

  function resolveOfficialPartnerLabel(thread) {
    const id = String(thread?.id || "");
    if (id === "official_anpi") return "安否確認センター";
    if (id === "official_platform" || id === "official_tasful") return "TASFUL運営";
    if (thread?._notifyCard || thread?.minimalNotifyCard) return "TASFUL通知";
    if (thread?._officialRoom) return "TASFUL運営";
    return "";
  }

  function resolveListingDisplayTitle(thread) {
    const listingId = pickStr(thread?.listing?.id, thread?.listingId);
    const candidates = [thread?.listing?.title, thread?.listingTitle, thread?.title];
    for (const candidate of candidates) {
      const title = pickStr(candidate);
      if (!title) continue;
      if (isRawListingToken(title, listingId)) continue;
      return title;
    }

    const resolved = resolveListingFromStores(listingId);
    if (resolved) {
      const title = pickStr(
        resolved.title,
        resolved.name,
        resolved.shop_name,
        resolved.company_name,
        resolved.service_name
      );
      if (title) return title;
    }

    return listingId || "（掲載名未設定）";
  }

  function resolvePartnerDisplayName(thread, partnerId) {
    const official = resolveOfficialPartnerLabel(thread);
    if (official) return official;

    const id = pickStr(partnerId, thread?.partner?.id, thread?.partner_id, thread?.partnerUserId);
    const hinted = pickStr(
      thread?.partner?.display_name,
      thread?.partner?.displayName,
      thread?.partner_display_name,
      thread?.partnerName,
      thread?.sellerName
    );
    if (hinted && !isRawUserToken(hinted, id)) return hinted;

    const catalog = global.TasuChatDisplayCatalog?.resolveUser?.(id);
    const catalogName = pickStr(catalog?.displayName, catalog?.companyName, catalog?.shopName);
    if (catalogName && !isRawUserToken(catalogName, id)) return catalogName;

    const listingResolved = resolveListingFromStores(pickStr(thread?.listing?.id, thread?.listingId));
    const sellerName = pickStr(
      listingResolved?.company_name,
      listingResolved?.shop_name,
      listingResolved?.seller_name
    );
    if (sellerName && !isRawUserToken(sellerName, id)) return sellerName;

    const Profile = global.TasuTalkChatProfile;
    if (Profile?.resolveProfile && id) {
      const profile = Profile.resolveProfile(id, {
        display_name: hinted,
        profile_image: pickStr(
          thread?.partner?.profile_image,
          thread?.partner?.avatarUrl,
          thread?.partner?.avatar_url
        ),
      });
      const profileName = pickStr(profile?.display_name);
      if (profileName && !isRawUserToken(profileName, id)) return profileName;
    }

    return id || "（相手）";
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeChatDomain(raw, thread) {
    const v = pickStr(raw, thread?.chatDomain, thread?.chat_domain).toLowerCase();
    if (v === CHAT_DOMAINS.friend || v === CHAT_DOMAINS.work) return v;
    return inferChatDomain(thread || {});
  }

  function inferChatDomain(thread) {
    const explicit = pickStr(thread?.chatDomain, thread?.chat_domain).toLowerCase();
    if (explicit === CHAT_DOMAINS.friend || explicit === CHAT_DOMAINS.work) {
      return explicit;
    }
    if (thread?._staticCard) return CHAT_DOMAINS.friend;
    if (thread?.listing?.id || thread?.listingId || thread?._localConsult) {
      return CHAT_DOMAINS.work;
    }
    if (thread?.partner?.id && !thread?.listing?.title) return CHAT_DOMAINS.friend;
    return CHAT_DOMAINS.work;
  }

  function normalizeThreadKind(raw, thread) {
    const v = pickStr(raw, thread?.threadKind, thread?.thread_kind).toLowerCase();
    if (Object.values(THREAD_KINDS).includes(v)) return v;
    if (thread?.listing?.id || thread?.listingId || thread?._localConsult) {
      return THREAD_KINDS.listing_inquiry;
    }
    if (Array.isArray(thread?.participantIds) && thread.participantIds.length > 2) {
      return THREAD_KINDS.group;
    }
    return THREAD_KINDS.direct;
  }

  function resolvePartnerUserId(thread) {
    const meId = pickStr(
      thread?.me?.id,
      global.TasuChatUserIdentity?.getEffectiveUserId?.(),
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId
    );
    const partnerId = pickStr(
      thread?.partnerUserId,
      thread?.partner_user_id,
      thread?.partner?.id,
      thread?.sellerId,
      thread?.seller_id
    );
    if (!partnerId || partnerId === meId) return "";
    return partnerId;
  }

  function buildPartnerProfile(thread) {
    const partnerId = resolvePartnerUserId(thread);
    const Profile = global.TasuTalkChatProfile;
    const resolvedDisplayName = resolvePartnerDisplayName(thread, partnerId);
    const hints = {
      profile_image: pickStr(
        thread?.partner?.profile_image,
        thread?.partner?.profileImage,
        thread?.partner?.avatar_url,
        thread?.partner?.avatarUrl,
        thread?.partner?.image_url,
        thread?.partner?.imageUrl,
        thread?._listingImage,
        thread?.listing?.image,
        thread?.listing?.image_url,
        global.TasuChatDisplayCatalog?.resolveUser?.(partnerId)?.avatarUrl
      ),
      display_name: resolvedDisplayName,
      category: pickStr(thread?.partner?.category, thread?._category, thread?.listing?.category),
      status_message: thread?.partner?.status_message,
      location: thread?.partner?.location,
      rating: thread?.partner?.rating,
      review_count: thread?.partner?.review_count ?? thread?.partner?.reviewCount,
    };
    if (!Profile?.resolveProfile) {
      return {
        user_id: partnerId,
        profile_image: hints.profile_image || Profile?.DEFAULT_AVATAR,
        display_name: hints.display_name || "相手",
        status_message: "",
        category: hints.category || "",
        location: "",
        rating: 0,
        review_count: 0,
        avatarUrl: hints.profile_image,
        displayName: hints.display_name || "相手",
      };
    }
    return Profile.resolveProfile(partnerId, hints);
  }

  /**
   * 一覧・詳細で使う正規化スレッド
   * @param {object} thread
   */
  function enrichThread(thread) {
    if (!thread || typeof thread !== "object") return thread;
    const chatDomain = normalizeChatDomain("", thread);
    const threadKind = normalizeThreadKind("", thread);
    const listingId = pickStr(thread?.listing?.id, thread?.listingId);
    const listingResolved = resolveListingFromStores(listingId);
    const listingTitle = resolveListingDisplayTitle(thread);
    const partnerProfile = buildPartnerProfile(thread);
    const lastMessage = pickStr(
      thread.lastMessagePreview,
      thread.lastMessage,
      thread.last_message_preview
    );
    const unreadCount = Math.max(0, Number(thread.unreadCount) || 0);

    const partner = {
      ...(thread.partner || {}),
      id: partnerProfile.user_id || thread.partner?.id,
      displayName: partnerProfile.display_name,
      display_name: partnerProfile.display_name,
      avatarUrl: partnerProfile.profile_image,
      profile_image: partnerProfile.profile_image,
      status_message: partnerProfile.status_message,
      category: partnerProfile.category,
      location: partnerProfile.location,
      rating: partnerProfile.rating,
      review_count: partnerProfile.review_count,
    };

    const listing = {
      ...(thread.listing || {}),
      id: listingId || thread.listing?.id || "",
      type: pickStr(thread?.listing?.type, listingResolved?.type, thread?.listing_type),
      title: listingTitle,
      category: pickStr(thread?.listing?.category, listingResolved?.category, thread?._category),
    };

    return {
      ...thread,
      chatDomain,
      chat_domain: chatDomain,
      threadKind,
      thread_kind: threadKind,
      listing,
      listingTitle,
      platformContactKind: pickStr(
        thread.platformContactKind,
        thread.contactKind,
        thread.contact_kind,
        listingResolved?.contactKind
      ),
      contactKind: pickStr(thread.contactKind, thread.contact_kind, listingResolved?.contactKind),
      partnerUserId: partnerProfile.user_id,
      partner_user_id: partnerProfile.user_id,
      partnerProfile,
      partner,
      lastMessagePreview: lastMessage,
      unreadCount,
      _resolvedListingTitle: listingTitle,
      _resolvedPartnerName: partnerProfile.display_name,
      _talkLineTitle:
        chatDomain === CHAT_DOMAINS.work
          ? pickStr(listingTitle, "案件・問い合わせ")
          : partnerProfile.display_name,
      _talkLineSubtitle:
        chatDomain === CHAT_DOMAINS.work
          ? partnerProfile.display_name
          : pickStr(partnerProfile.status_message, partnerProfile.category),
    };
  }

  function enrichThreads(threads) {
    return (Array.isArray(threads) ? threads : []).map(enrichThread);
  }

  function formatUnreadBadge(unreadCount) {
    const n = Number(unreadCount) || 0;
    if (n <= 0) return "";
    const label = n > 99 ? "99+" : String(n);
    return `<span class="talk-chat-line__unread" aria-label="未読 ${n}件">${label}</span>`;
  }

  function profilePageHref(userId) {
    const id = pickStr(userId);
    if (!id) return "#";
    return `profile-public.html?userId=${encodeURIComponent(id)}`;
  }

  function formatListTime(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const now = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    if (d.toDateString() === now.toDateString()) return `${hh}:${mm}`;
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${m}/${day}`;
  }

  function listSubtitle(row, profile) {
    if (row._officialRoom) {
      return "";
    }
    if (row.chatDomain === CHAT_DOMAINS.work) {
      return pickStr(row._talkLineTitle, row.listing?.title, profile.category);
    }
    return pickStr(profile.status_message, profile.category);
  }

  function renderListCategoryChip(row, channel, esc) {
    const e = esc || escapeHtml;
    if (row._officialRoom) {
      const content = global.TasuTalkNotifyContentType?.resolveFromOfficialRoom?.(row.id);
      if (content?.label) {
        return `<span class="talk-line-list__chips"><span class="talk-line-list__chip talk-line-list__chip--notify-${e(content.tone || "default")}">${e(content.label)}</span></span>`;
      }
      return "";
    }
    if (row._staticCard) {
      if (row.id === "talk-hub-ai") {
        return `<span class="talk-line-list__chips"><span class="talk-line-list__chip talk-line-list__chip--ai">AI</span></span>`;
      }
      if (row.id === "talk-hub-support") {
        return `<span class="talk-line-list__chips"><span class="talk-line-list__chip talk-line-list__chip--support">サポート</span></span>`;
      }
      if (row.id === "talk-hub-friend") {
        return `<span class="talk-line-list__chips"><span class="talk-line-list__chip talk-line-list__chip--friend">友達</span></span>`;
      }
    }
    const chips = [];
    if (row.chatDomain === CHAT_DOMAINS.friend) {
      chips.push(`<span class="talk-line-list__chip talk-line-list__chip--friend">友達</span>`);
    } else if (row.chatDomain === CHAT_DOMAINS.work) {
      chips.push(`<span class="talk-line-list__chip talk-line-list__chip--work">仕事</span>`);
    }
    const channelLabel = global.TasuTalkData?.getChatChannelLabel?.(channel) || "";
    if (channelLabel && channelLabel !== "個人" && channelLabel !== "すべて") {
      const short =
        channel === "job"
          ? "求人"
          : channel === "business"
            ? "業務"
            : channel === "shop" || channel === "product"
              ? "店舗"
              : channel === "ai_consult"
                ? "AI"
                : channel === "builder" || channel === "skill"
                  ? "案件"
                  : channelLabel;
      if (!chips.some((c) => c.includes(short))) {
        chips.push(`<span class="talk-line-list__chip">${e(short)}</span>`);
      }
    }
    return chips.length
      ? `<span class="talk-line-list__chips">${chips.join("")}</span>`
      : "";
  }

  /**
   * LINE 3カラム — 中央一覧行（インライン会話・遷移なし）
   */
  function renderTalkLineListItemHtml(t, ctx) {
    const esc = ctx?.escapeHtml || escapeHtml;
    const row = enrichThread(t);
    const channel =
      global.TasuTalkData?.resolveChatChannel?.(row) ||
      (row.chatDomain === CHAT_DOMAINS.friend ? "personal" : "business");
    const profile = row.partnerProfile || buildPartnerProfile(row);
    const presence = global.TasuTalkChatProfile?.getOnlinePresence?.(profile.user_id) || {
      isOnline: false,
    };
    const displayName = esc(profile.display_name || "相手");
    const subtitle = esc(listSubtitle(row, profile));
    const lastMsg = esc(row.lastMessagePreview || "（メッセージなし）");
    const avatarHtml =
      global.TasuTalkChatProfile?.renderAvatarHtml?.({
        profile,
        hints: row.partner,
        size: 48,
        className: "talk-line-list__avatar",
        escapeHtml: esc,
      }) ||
      `<span class="talk-line-list__avatar talk-line-list__avatar--initials">?</span>`;
    const timeLabel = esc(formatListTime(row.updatedAt || row._sortAt));
    const isStatic = Boolean(row._staticCard);
    const unread = formatUnreadBadge(row.unreadCount);
    const categoryChips = renderListCategoryChip(row, channel, esc);

    return `
      <li class="talk-line-list__item${isStatic ? " talk-line-list__item--static" : ""}" data-talk-thread-id="${esc(row.id)}" data-talk-channel-row="${esc(channel)}" data-chat-domain="${esc(row.chatDomain)}">
        <button type="button" class="talk-line-list__btn" data-talk-select-thread data-talk-thread-id="${esc(row.id)}" aria-current="false">
          <span class="talk-line-list__avatar-wrap">
            ${avatarHtml}
            ${presence.isOnline ? '<span class="talk-line-list__online" aria-hidden="true"></span>' : ""}
          </span>
          <span class="talk-line-list__body">
            <span class="talk-line-list__row">
              <span class="talk-line-list__name-row">
                <span class="talk-line-list__name">${displayName}</span>
                ${categoryChips}
              </span>
              <time class="talk-line-list__time" datetime="${esc(row.updatedAt || row._sortAt || "")}">${timeLabel}</time>
            </span>
            ${subtitle ? `<span class="talk-line-list__subtitle">${subtitle}</span>` : ""}
            <span class="talk-line-list__preview">${lastMsg}</span>
          </span>
          <span class="talk-line-list__aside">${unread}</span>
        </button>
      </li>`;
  }

  /**
   * TALK トーク一覧 — LINE風行
   * @param {object} t
   * @param {{ escapeHtml?: Function, appendUserUrl?: Function, resolveTalkHref?: Function, resolveRelatedHref?: Function, showDomainBadge?: boolean }} [ctx]
   */
  function renderTalkListItemHtml(t, ctx) {
    const esc = ctx?.escapeHtml || escapeHtml;
    const row = enrichThread(t);
    const channel =
      global.TasuTalkData?.resolveChatChannel?.(row) ||
      (row.chatDomain === CHAT_DOMAINS.friend ? "personal" : "business");
    const channelLabel = global.TasuTalkData?.getChatChannelLabel?.(channel) || channel;
    const profile = row.partnerProfile || buildPartnerProfile(row);
    const presence = global.TasuTalkChatProfile?.getOnlinePresence?.(profile.user_id) || {
      label: "",
      isOnline: false,
    };
    const displayName = esc(profile.display_name || "相手");
    const lastMsg = esc(row.lastMessagePreview || "（メッセージなし）");
    const avatar = esc(profile.profile_image);
    const profileHref = esc(ctx?.appendUserUrl?.(profilePageHref(profile.user_id)) || profilePageHref(profile.user_id));
    const talkRaw = ctx?.resolveTalkHref?.(row) || "#";
    const talkHref = esc(ctx?.appendUserUrl?.(talkRaw) || talkRaw);
    const isStatic = Boolean(row._staticCard);
    const isLocal = Boolean(row._localConsult);
    const builderSubtle = Boolean(ctx?.builderSubtle || ctx?._builderSubtle);
    const workContext =
      row.chatDomain === CHAT_DOMAINS.work
        ? `<p class="talk-chat-line__context">${esc(row._talkLineTitle || row.listing?.title || "")}</p>`
        : "";
    const domainBadge =
      ctx?.showDomainBadge !== false
        ? `<span class="talk-chat-line__domain talk-chat-line__domain--${esc(row.chatDomain)}">${row.chatDomain === CHAT_DOMAINS.friend ? "友達" : "仕事"}</span>`
        : "";
    const channelBadge = `<span class="talk-chat-line__channel talk-chat-card__badge--${esc(channel)}">${esc(channelLabel)}</span>`;

    const relatedRaw = ctx?.resolveRelatedHref?.(row) || "";
    const relatedBtn = relatedRaw
      ? `<a class="talk-chat-card__btn talk-chat-card__btn--secondary" href="${esc(ctx.appendUserUrl?.(relatedRaw) || relatedRaw)}">関連</a>`
      : "";

    return `
      <li class="talk-chat-line${isStatic ? " talk-chat-line--static" : ""}${isLocal ? " talk-chat-line--local" : ""}${builderSubtle ? " talk-chat-line--muted" : ""}" data-talk-thread-id="${esc(row.id)}" data-talk-channel-row="${esc(channel)}" data-chat-domain="${esc(row.chatDomain)}" data-thread-kind="${esc(row.threadKind)}">
        <a class="talk-chat-line__link" href="${talkHref}">
          <span class="talk-chat-line__avatar-wrap">
            <img class="talk-chat-line__avatar" src="${avatar}" alt="" width="48" height="48" loading="lazy" decoding="async">
            ${presence.isOnline ? '<span class="talk-chat-line__online" aria-hidden="true"></span>' : ""}
          </span>
          <span class="talk-chat-line__main">
            <span class="talk-chat-line__row">
              <span class="talk-chat-line__name">${displayName}</span>
              <span class="talk-chat-line__meta">${domainBadge}${channelBadge}</span>
            </span>
            ${workContext}
            <span class="talk-chat-line__preview">${lastMsg}</span>
          </span>
          <span class="talk-chat-line__aside">
            ${formatUnreadBadge(row.unreadCount)}
          </span>
        </a>
        <div class="talk-chat-line__actions">
          <a class="talk-chat-line__profile-link" href="${profileHref}" data-talk-profile-link data-future-feature="${FUTURE_FEATURES.profilePage}">プロフィール</a>
          ${relatedBtn}
          <a class="talk-chat-card__btn talk-chat-card__btn--primary" href="${talkHref}">開く</a>
        </div>
      </li>`;
  }

  /**
   * chat-list.html 向け（既存レイアウト互換 + プロフィール画像）
   */
  function renderChatListRowHtml(t, ctx) {
    const esc = ctx?.escapeHtml || escapeHtml;
    const row = enrichThread(t);
    const profile = row.partnerProfile || buildPartnerProfile(row);
    const avatar = esc(profile.profile_image);
    const displayName = esc(profile.display_name);
    const lastPreview = esc(row.lastMessagePreview || "（メッセージなし）");
    const title =
      row.chatDomain === CHAT_DOMAINS.work
        ? esc(row.listing?.title || "（案件名未設定）")
        : displayName;
    const subtitle =
      row.chatDomain === CHAT_DOMAINS.work
        ? `<span class="chat-thread__partner">相手：${displayName}</span>`
        : pickStr(profile.status_message)
          ? `<span class="chat-thread__partner">${esc(profile.status_message)}</span>`
          : "";

    const lifecycle =
      global.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(row) ||
      (row.status === "expired" ? "expired" : "active");
    const statusDisplay = global.TasuChatRoomStatus?.getListStatusDisplay?.(lifecycle) || {
      label: "ACTIVE",
      pillClass: "chat-pill--active",
    };
    const unreadBadge = ctx?.formatUnreadBadge?.(row.unreadCount) || "";
    const isLocal = Boolean(row._localConsult);
    const detailPath =
      global.TasuChatService?.chatDetailUrl?.(row.id) ||
      (isLocal
        ? `chat-detail.html?thread=${encodeURIComponent(row.id)}`
        : `chat-detail.html?roomId=${encodeURIComponent(row.id)}`);
    const chatHref = esc(ctx?.appendUserUrl?.(detailPath) || detailPath);

    return `
      <li class="chat-list__item${isLocal ? " chat-list__item--local-consult" : ""}" data-chat-thread-id="${esc(row.id)}" data-chat-domain="${esc(row.chatDomain)}">
        <div class="chat-thread-row chat-thread-row--line">
          <a class="chat-thread chat-thread--line" href="${chatHref}">
            <span class="chat-thread__avatar-wrap">
              <img class="chat-thread__avatar" src="${avatar}" alt="" width="48" height="48" loading="lazy" decoding="async">
            </span>
            <div class="chat-thread__body">
              <div class="chat-thread__top">
                <p class="chat-thread__title">${title}</p>
                ${subtitle}
              </div>
              <p class="chat-thread__preview">${lastPreview}</p>
            </div>
            <div class="chat-thread__right">
              <div class="chat-thread__meta">
                ${unreadBadge}
                <span class="chat-pill ${statusDisplay.pillClass}">${esc(statusDisplay.label)}</span>
              </div>
            </div>
          </a>
        </div>
      </li>`;
  }

  global.TasuTalkChatThreadModel = {
    CHAT_DOMAINS,
    THREAD_KINDS,
    FUTURE_FEATURES,
    normalizeChatDomain,
    inferChatDomain,
    normalizeThreadKind,
    enrichThread,
    enrichThreads,
    buildPartnerProfile,
    resolveListingDisplayTitle,
    resolvePartnerDisplayName,
    isRawUserToken,
    isRawListingToken,
    renderTalkListItemHtml,
    renderTalkLineListItemHtml,
    renderChatListRowHtml,
    profilePageHref,
    formatListTime,
  };
})(typeof window !== "undefined" ? window : globalThis);
