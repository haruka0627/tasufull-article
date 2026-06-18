/**
 * 会員ダッシュボード — データ集約（service_deals / chats / favorites）
 */
(function () {
  "use strict";

  const DEAL_STATUS_LABEL = {
    consulting: "相談中",
    agreed: "見積提示済み",
    payment_pending: "取引進行中",
    completed: "作業完了",
    fee_pending: "手数料支払い待ち",
    fee_paid: "完了",
    cancelled: "キャンセル",
  };

  const DEAL_STATUS_CLASS = {
    consulting: "dash-badge--blue",
    agreed: "dash-badge--green",
    payment_pending: "dash-badge--amber",
    completed: "dash-badge--slate",
    fee_pending: "dash-badge--orange",
    fee_paid: "dash-badge--navy",
    cancelled: "dash-badge--muted",
  };

  const ONGOING_STATUSES = new Set([
    "consulting",
    "agreed",
    "payment_pending",
    "completed",
    "fee_pending",
  ]);

  const MEMBER_SESSION_KEY = "tasu_member_session";

  const DEMO_ID_PREFIXES = [
    "local_biz_",
    "local_biz-",
    "local-deal-",
    "demo_",
    "demo-",
    "sample_",
    "sample-",
    "mock_",
    "mock-",
  ];

  function isDemoIdentifier(value) {
    const s = String(value || "").trim().toLowerCase();
    if (!s) return false;
    if (s === "u_me") return true;
    return DEMO_ID_PREFIXES.some((prefix) => s.startsWith(prefix));
  }

  function isProductionDeal(deal) {
    if (!deal) return false;
    if (isDemoIdentifier(deal.id)) return false;
    if (isDemoIdentifier(deal.service_id)) return false;
    if (deal._source === "local" && isDemoIdentifier(deal.id)) return false;
    return true;
  }

  function pickWelcomeName(fields) {
    const nickname = String(fields?.nickname || "").trim();
    if (nickname) return nickname;
    const displayName = String(fields?.display_name || fields?.displayName || "").trim();
    if (displayName) return displayName;
    const name = String(fields?.name || "").trim();
    if (name) return name;
    return "";
  }

  function readLocalMemberSession() {
    try {
      const raw = localStorage.getItem(MEMBER_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function isValidLocalSession(session) {
    if (!session || typeof session !== "object") return false;
    const id = String(session.id || session.userId || session.user_id || "").trim();
    if (id) return true;
    const email = String(session.email || "").trim();
    return Boolean(email && session.signedInAt);
  }

  async function fetchAuthUser() {
    const client = window.TasuSupabase?.getClient?.();
    if (!client?.auth) return null;
    try {
      const { data: sessionData } = await client.auth.getSession();
      if (sessionData?.session?.user) return sessionData.session.user;

      const { data, error } = await client.auth.getUser();
      if (error || !data?.user) return null;
      return data.user;
    } catch (err) {
      console.warn("[Dashboard] auth session fetch failed:", err);
      return null;
    }
  }

  async function fetchSupabaseProfileRow(userId) {
    const client = window.TasuSupabase?.getClient?.();
    if (!client || !userId) return null;
    try {
      const { data, error } = await client
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.warn("[Dashboard] profiles fetch failed:", error);
        return null;
      }
      return data;
    } catch (err) {
      console.warn("[Dashboard] profiles fetch error:", err);
      return null;
    }
  }

  async function resolveAuthContext() {
    const authUser = await fetchAuthUser();
    const localSession = readLocalMemberSession();
    const isAuthenticated = Boolean(
      authUser?.id ||
        isValidLocalSession(localSession) ||
        window.TasuMemberAuth?.isAuthenticatedSync?.()
    );

    let userId = "";
    let nickname = "";
    let display_name = "";
    let name = "";
    let avatarUrl = "";

    if (authUser?.id) {
      userId = String(authUser.id);
      const meta = authUser.user_metadata || {};
      nickname = String(meta.nickname || meta.nick_name || "").trim();
      display_name = String(meta.display_name || meta.full_name || "").trim();
      name = String(meta.name || "").trim();

      const profileRow = await fetchSupabaseProfileRow(userId);
      if (profileRow) {
        if (!display_name && profileRow.display_name) {
          display_name = String(profileRow.display_name).trim();
        }
        if (profileRow.avatar_url) {
          avatarUrl = String(profileRow.avatar_url).trim();
        }
      }
    } else if (isValidLocalSession(localSession)) {
      userId = String(
        localSession.id || localSession.userId || localSession.user_id || ""
      ).trim();
      nickname = String(localSession.nickname || "").trim();
      display_name = String(
        localSession.display_name || localSession.displayName || ""
      ).trim();
      name = String(localSession.name || "").trim();
    }

    const localAvatar = String(
      localSession?.avatar_url || localSession?.avatarUrl || ""
    ).trim();
    const sessionUserId = String(
      localSession?.id || localSession?.userId || localSession?.user_id || ""
    ).trim();
    if (localAvatar && userId && sessionUserId && sessionUserId === userId) {
      avatarUrl = localAvatar;
    }

    let welcomeName = pickWelcomeName({ nickname, display_name, name });
    let profile = {
      id: userId,
      nickname,
      display_name,
      name,
      displayName: welcomeName || display_name || nickname || name || "",
      welcomeName,
      avatarUrl,
    };

    if (isAuthenticated && window.TasuMemberAuth?.applyLastProfileFallback) {
      profile = window.TasuMemberAuth.applyLastProfileFallback(profile);
      welcomeName = profile.welcomeName || pickWelcomeName(profile);
      profile.welcomeName = welcomeName;
      profile.displayName = profile.displayName || welcomeName || "会員";
    }

    return {
      userId,
      isAuthenticated,
      hasSupabaseAuth: Boolean(authUser?.id),
      profile,
    };
  }

  function getUserId() {
    return readLocalMemberSession()?.id || window.TasuChatUserIdentity?.getEffectiveUserId?.() || "";
  }

  function getUserProfile() {
    const session = readLocalMemberSession();
    if (isValidLocalSession(session)) {
      const welcomeName = pickWelcomeName({
        nickname: session.nickname,
        display_name: session.display_name || session.displayName,
        name: session.name,
      });
      let profile = {
        id: session.id || "",
        nickname: session.nickname || "",
        display_name: session.display_name || session.displayName || "",
        displayName: welcomeName || session.nickname || "会員",
        welcomeName,
        avatarUrl: String(session.avatar_url || session.avatarUrl || "").trim(),
      };
      if (window.TasuMemberAuth?.applyLastProfileFallback) {
        profile = window.TasuMemberAuth.applyLastProfileFallback(profile);
      }
      return profile;
    }
    if (window.TasuChatUserIdentity?.getEffectiveMeProfile) {
      const me = window.TasuChatUserIdentity.getEffectiveMeProfile();
      return {
        ...me,
        welcomeName: pickWelcomeName({
          display_name: me.displayName,
          name: me.name,
        }),
      };
    }
    return { id: "", displayName: "会員", welcomeName: "", avatarUrl: "" };
  }

  function formatYen(n) {
    if (window.TasuServiceDealsDb?.formatYen) return window.TasuServiceDealsDb.formatYen(n);
    return `¥${Math.max(0, Math.round(Number(n) || 0)).toLocaleString("ja-JP")}`;
  }

  function formatRelativeTime(iso) {
    if (!iso) return "";
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms)) return "";
    const min = Math.floor(ms / 60000);
    if (min < 1) return "たった今";
    if (min < 60) return `${min}分前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}時間前`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}日前`;
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }

  function categoryLabel(listing) {
    const cat = String(
      listing?.business_category ||
        listing?.business_subcategory ||
        listing?.form_data?.business_category ||
        ""
    ).trim();
    const map = {
      field_service: "出張・訪問サービス",
      construction_work: "工事・施工",
      design: "デザイン",
      web: "Web制作",
    };
    if (map[cat]) return map[cat];
    if (cat) return cat;
    return "業務サービス";
  }

  function listingImage(listing) {
    const url =
      listing?.image_url ||
      listing?.thumbnail_url ||
      listing?.gallery_images?.[0] ||
      listing?.form_data?.image_url ||
      "";
    if (url) return url;
    return "https://placehold.co/96x96/e8eef5/1e3a5f?text=S";
  }

  async function resolveServiceMeta(serviceId) {
    const sid = String(serviceId || "").trim();
    if (!sid || isDemoIdentifier(sid)) {
      return { title: "業務サービス", category: "業務サービス", image: listingImage(null) };
    }

    const tryListing = (listing) => {
      if (!listing) return null;
      const listingId = String(listing.id || listing.demo_id || "").trim();
      if (isDemoIdentifier(listingId)) return null;
      const bs = window.TasuBusinessServiceData?.getBusinessService?.(listing);
      return {
        title: String(listing.title || bs?.hero?.service_name || listing.company_name || sid).trim(),
        category: categoryLabel(listing),
        image: listingImage(listing),
      };
    };

    if (window.TasuDetailBusinessServiceLoader?.fetchFieldServiceDetailById) {
      try {
        const listing = await window.TasuDetailBusinessServiceLoader.fetchFieldServiceDetailById(sid);
        const meta = tryListing(listing);
        if (meta) return meta;
      } catch (err) {
        console.warn("[Dashboard] listing fetch failed:", sid, err);
      }
    }

    return { title: "業務サービス", category: "業務サービス", image: listingImage(null) };
  }

  function indexThreads(threads) {
    /** @type {Map<string, object>} */
    const byRoom = new Map();
    for (const t of threads || []) {
      byRoom.set(String(t.id), t);
    }
    return byRoom;
  }

  function isProvider(deal, userId) {
    return String(deal.provider_user_id) === String(userId);
  }

  function buildStats(deals, userId) {
    let ongoing = 0;
    let completed = 0;
    let feeUnpaid = 0;
    let feePaid = 0;
    let unpaidTotal = 0;
    let paidThisMonth = 0;

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

    for (const deal of deals) {
      const d = window.TasuServiceDealsDb?.resolveDealFees?.(deal) || deal;
      const st = d.status;
      if (ONGOING_STATUSES.has(st)) ongoing += 1;
      if (st === "fee_paid") {
        completed += 1;
        feePaid += 1;
        const paidAt = d.fee_paid_at || d.updated_at;
        if (paidAt) {
          const pd = new Date(paidAt);
          if (`${pd.getFullYear()}-${pd.getMonth()}` === monthKey) {
            paidThisMonth += Number(d.platform_fee_amount) || 0;
          }
        }
      }
      if (st === "fee_pending" && isProvider(d, userId)) {
        feeUnpaid += 1;
        unpaidTotal += Number(d.platform_fee_amount) || 0;
      }
    }

    return { ongoing, completed, feeUnpaid, feePaid, unpaidTotal, paidThisMonth };
  }

  async function buildTransactionRows(deals, threadsByRoom, userId) {
    const rows = [];
    for (const deal of deals) {
      if (!ONGOING_STATUSES.has(deal.status)) continue;
      const meta = await resolveServiceMeta(deal.service_id);
      const thread = deal.chat_id ? threadsByRoom.get(String(deal.chat_id)) : null;
      const provider = isProvider(deal, userId);
      const partnerName =
        thread?.partner?.displayName ||
        (provider ? "依頼者" : "掲載者");
      const lastAt = thread?._sortAt || thread?.lastReadAt || deal.updated_at || deal.created_at;
      const dealQ = deal.id ? `&deal=${encodeURIComponent(deal.id)}` : "";
      const roomId = deal.chat_id || thread?.id || "";
      rows.push({
        dealId: deal.id,
        roomId,
        href: roomId
          ? `chat-detail.html?roomId=${encodeURIComponent(roomId)}${dealQ}`
          : `detail-business-service.html?id=${encodeURIComponent(deal.service_id || "")}`,
        title: meta.title,
        category: meta.category,
        image: meta.image,
        status: deal.status,
        statusLabel: DEAL_STATUS_LABEL[deal.status] || deal.status,
        statusClass: DEAL_STATUS_CLASS[deal.status] || "dash-badge--slate",
        partnerName,
        lastMessageAt: formatRelativeTime(lastAt),
        sortAt: lastAt || "",
      });
    }
    rows.sort((a, b) => String(b.sortAt).localeCompare(String(a.sortAt)));
    return rows;
  }

  function buildFeeItems(deals, userId) {
    return deals
      .filter((d) => d.status === "fee_pending" && isProvider(d, userId))
      .map((d) => {
        const fees = window.TasuServiceDealsDb?.resolveDealFees?.(d) || d;
        return {
          dealId: d.id,
          amount: fees.platform_fee_amount || 0,
          payUrl: `service-fee-pay.html?deal=${encodeURIComponent(d.id)}`,
        };
      });
  }

  async function loadDashboard() {
    const auth = await resolveAuthContext();
    const userId = auth.userId;
    const profile = auth.profile;

    if (window.TasuChatService?.ensureInitialized) {
      await window.TasuChatService.ensureInitialized();
    }

    const rawDeals = userId
      ? (await window.TasuServiceDealsDb?.fetchDealsForUser?.(userId)) || []
      : [];
    const deals = rawDeals.filter(isProductionDeal);

    let threads = [];
    if (auth.hasSupabaseAuth && window.TasuChatService?.loadThreads) {
      const loaded = (await window.TasuChatService.loadThreads()) || [];
      threads = loaded.filter(
        (t) => !isDemoIdentifier(t.id) && !isDemoIdentifier(t.listingId)
      );
    }

    const favorites = userId
      ? await (async () => {
          try {
            const rows = await window.TasuFavoritesDb?.loadFavoritesByUserId?.(userId);
            return (rows || []).filter(
              (f) => !isDemoIdentifier(f?.listing_id) && !isDemoIdentifier(f?.id)
            );
          } catch {
            return [];
          }
        })()
      : [];

    const threadsByRoom = indexThreads(threads);
    const stats = buildStats(deals, userId);
    const ongoingRows = await buildTransactionRows(deals, threadsByRoom, userId);
    const feeItems = buildFeeItems(deals, userId);
    const unpaidDeals = deals.filter(
      (d) => d.status === "fee_pending" && isProvider(d, userId)
    );
    const paidDeals = deals.filter((d) => d.status === "fee_paid");

    const unreadMessages = (threads || []).reduce(
      (sum, t) => sum + (Number(t.unreadCount) || 0),
      0
    );

    const providerDeals = deals.filter((d) => isProvider(d, userId));
    const clientDeals = deals.filter((d) => String(d.client_user_id) === String(userId));

    return {
      userId,
      profile,
      stats,
      deals,
      ongoingRows,
      feeItems,
      unpaidDeals,
      paidDeals,
      providerDeals,
      clientDeals,
      favorites: Array.isArray(favorites) ? favorites : [],
      threads,
      notices: [],
      unreadMessages,
      firstUnpaidPayUrl: feeItems[0]?.payUrl || "",
    };
  }

  window.TasuDashboardData = {
    DEAL_STATUS_LABEL,
    DEAL_STATUS_CLASS,
    getUserId,
    getUserProfile,
    pickWelcomeName,
    isDemoIdentifier,
    isProductionDeal,
    resolveAuthContext,
    formatYen,
    formatRelativeTime,
    loadDashboard,
  };
})();
