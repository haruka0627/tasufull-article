/**
 * 業務サービス取引 service_deals（Supabase + localStorage）
 */
(function () {
  "use strict";

  const LOCAL_KEY = "tasu_service_deals";
  const DEFAULT_FEE_RATE = 0.05;
  const LOCAL_DEAL_PREFIX = "local-deal-";

  function isLocalDealId(dealId) {
    return String(dealId || "")
      .trim()
      .startsWith(LOCAL_DEAL_PREFIX);
  }

  function getClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  function getCurrentUserId() {
    return (
      window.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocal(list) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 500)));
    } catch (err) {
      console.warn("[ServiceDeals] local save failed:", err);
    }
  }

  function formatYen(amount) {
    const n = Math.max(0, Math.round(Number(amount) || 0));
    return `¥${n.toLocaleString("ja-JP")}`;
  }

  function formatFeeRatePercent(rate) {
    const r = Number.isFinite(Number(rate)) ? Number(rate) : DEFAULT_FEE_RATE;
    const pct = r * 100;
    return Number.isInteger(pct) ? String(pct) : String(Math.round(pct * 10) / 10);
  }

  /** agreed_amount / platform_fee_amount / platform_fee_rate を揃える（表示・保存共通） */
  function resolveDealFees(deal) {
    if (!deal) return null;
    const agreed =
      deal.agreed_amount != null && deal.agreed_amount !== ""
        ? Math.max(0, Math.round(Number(deal.agreed_amount) || 0))
        : null;
    const platform_fee_rate =
      Number.isFinite(Number(deal.platform_fee_rate)) && deal.platform_fee_rate >= 0
        ? Number(deal.platform_fee_rate)
        : DEFAULT_FEE_RATE;
    let platform_fee_amount =
      deal.platform_fee_amount != null && deal.platform_fee_amount !== ""
        ? Math.max(0, Math.round(Number(deal.platform_fee_amount) || 0))
        : null;
    if (agreed != null && agreed > 0) {
      if (platform_fee_amount == null || !Number.isFinite(platform_fee_amount)) {
        platform_fee_amount = calcFee(agreed, platform_fee_rate).platform_fee_amount;
      }
    } else {
      platform_fee_amount = platform_fee_amount != null ? platform_fee_amount : null;
    }
    return {
      ...deal,
      agreed_amount: agreed,
      platform_fee_rate,
      platform_fee_amount,
    };
  }

  function readEstimateNote(row) {
    if (!row || typeof row !== "object") return "";
    if (row.estimate_note != null && String(row.estimate_note).trim()) {
      return String(row.estimate_note).trim();
    }
    const snap = row.payment_method_snapshot;
    if (snap && typeof snap === "object" && snap.estimate_note) {
      return String(snap.estimate_note).trim();
    }
    return "";
  }

  function mapRow(row) {
    if (!row) return null;
    const snapshot =
      row.payment_method_snapshot && typeof row.payment_method_snapshot === "object"
        ? { ...row.payment_method_snapshot }
        : {};
    const estimateNote = readEstimateNote(row);
    if (estimateNote) snapshot.estimate_note = estimateNote;
    return resolveDealFees({
      id: String(row.id),
      service_id: String(row.service_id || ""),
      listing_type: row.listing_type || "business",
      client_user_id: String(row.client_user_id || ""),
      provider_user_id: String(row.provider_user_id || ""),
      chat_id: row.chat_id ? String(row.chat_id) : "",
      status: String(row.status || "consulting"),
      agreed_amount: row.agreed_amount != null ? Number(row.agreed_amount) : null,
      estimate_note: estimateNote,
      approved_at: row.approved_at || null,
      estimate_rejected_at: row.estimate_rejected_at || null,
      estimate_reject_reason: row.estimate_reject_reason
        ? String(row.estimate_reject_reason).trim()
        : "",
      platform_fee_rate: Number(row.platform_fee_rate ?? DEFAULT_FEE_RATE),
      platform_fee_amount:
        row.platform_fee_amount != null ? Number(row.platform_fee_amount) : null,
      payment_method_snapshot: snapshot,
      work_completed_at: row.work_completed_at || null,
      deal_completed_at: row.deal_completed_at || null,
      completed_at: row.completed_at || null,
      platform_fee_paid_at: row.platform_fee_paid_at || null,
      platform_fee_payment_method: row.platform_fee_payment_method
        ? String(row.platform_fee_payment_method)
        : null,
      platform_fee_payment_status: row.platform_fee_payment_status
        ? String(row.platform_fee_payment_status)
        : null,
      platform_fee_transaction_id: row.platform_fee_transaction_id
        ? String(row.platform_fee_transaction_id)
        : null,
      fee_paid_at: row.fee_paid_at || row.platform_fee_paid_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      _source: row._source || "supabase",
    });
  }

  function normalizeDealPatch(patch, existing) {
    const next = { ...(patch || {}) };
    if (next.estimate_note != null) {
      const note = String(next.estimate_note).trim();
      next.estimate_note = note;
      const snap =
        next.payment_method_snapshot && typeof next.payment_method_snapshot === "object"
          ? { ...next.payment_method_snapshot }
          : { ...(existing?.payment_method_snapshot || {}) };
      if (note) snap.estimate_note = note;
      else delete snap.estimate_note;
      next.payment_method_snapshot = snap;
    }
    if (next.status === "consulting" && existing?.status === "agreed") {
      next.approved_at = null;
    }
    if (next.status === "payment_pending") {
      if (!next.approved_at) next.approved_at = new Date().toISOString();
    }
    if (next.status === "completed") {
      if (!next.work_completed_at) {
        next.work_completed_at = new Date().toISOString();
      }
    }
    if (next.status === "fee_pending") {
      if (!next.deal_completed_at) {
        next.deal_completed_at = new Date().toISOString();
      }
    }
    if (next.status === "fee_paid") {
      const now = new Date().toISOString();
      if (!next.platform_fee_paid_at) next.platform_fee_paid_at = now;
      if (!next.platform_fee_payment_method) next.platform_fee_payment_method = "demo";
      if (!next.platform_fee_payment_status) next.platform_fee_payment_status = "paid";
      if (!next.platform_fee_transaction_id) {
        next.platform_fee_transaction_id = `demo_fee_${Date.now()}`;
      }
      if (!next.fee_paid_at) next.fee_paid_at = next.platform_fee_paid_at;
    }
    if (next.estimate_reject_reason != null) {
      next.estimate_reject_reason = String(next.estimate_reject_reason).trim();
    }
    if (next.agreed_amount != null) {
      const rate =
        next.platform_fee_rate != null
          ? next.platform_fee_rate
          : existing?.platform_fee_rate ?? DEFAULT_FEE_RATE;
      Object.assign(next, calcFee(next.agreed_amount, rate));
    } else if (
      next.platform_fee_amount == null &&
      existing?.agreed_amount != null &&
      (next.status === "fee_pending" || next.status === "fee_paid" || next.status === "completed")
    ) {
      const fees = calcFee(existing.agreed_amount, existing.platform_fee_rate ?? DEFAULT_FEE_RATE);
      next.platform_fee_amount = fees.platform_fee_amount;
      if (next.platform_fee_rate == null) next.platform_fee_rate = fees.platform_fee_rate;
    }
    return next;
  }

  function calcFee(amount, rate) {
    const total = Math.max(0, Math.round(Number(amount) || 0));
    const r =
      Number.isFinite(Number(rate)) && rate >= 0 && rate <= 1
        ? Number(rate)
        : DEFAULT_FEE_RATE;
    const platform_fee_amount = Math.round(total * r);
    return {
      agreed_amount: total,
      platform_fee_rate: r,
      platform_fee_amount,
    };
  }

  async function insertDeal(row) {
    const sb = getClient();
    if (sb && window.location.protocol !== "file:") {
      const { data, error } = await sb.from("service_deals").insert(row).select("*").single();
      if (!error && data) return mapRow({ ...data, _source: "supabase" });
      if (error) console.warn("[ServiceDeals] insert failed:", error);
    }

    const id = `local-deal-${Date.now()}`;
    const record = {
      id,
      ...row,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _source: "local",
    };
    const list = loadLocal();
    list.unshift(record);
    saveLocal(list);
    return mapRow(record);
  }

  async function updateDeal(id, patch) {
    const key = String(id || "").trim();
    if (!key) return null;

    const localRow = loadLocal().find((d) => String(d.id) === key);
    let existingDeal = localRow ? mapRow(localRow) : null;
    const sb = getClient();
    if (!existingDeal && sb && !key.startsWith("local-")) {
      const { data } = await sb.from("service_deals").select("*").eq("id", key).maybeSingle();
      if (data) existingDeal = mapRow(data);
    }

    const normalizedPatch = normalizeDealPatch(patch, existingDeal);
    const payload = { ...normalizedPatch, updated_at: new Date().toISOString() };

    if (sb && !key.startsWith("local-") && window.location.protocol !== "file:") {
      const { data, error } = await sb
        .from("service_deals")
        .update(payload)
        .eq("id", key)
        .select("*")
        .single();
      if (!error && data) return mapRow(data);
      if (error) console.warn("[ServiceDeals] update failed:", error);
    }

    const list = loadLocal();
    const idx = list.findIndex((d) => String(d.id) === key);
    if (idx < 0) {
      if (existingDeal?._source === "supabase" && Object.keys(normalizedPatch).length) {
        return mapRow({ ...existingDeal, ...normalizedPatch });
      }
      return null;
    }
    list[idx] = { ...list[idx], ...payload };
    saveLocal(list);
    return mapRow(list[idx]);
  }

  function fetchLocalDealMapped(matchFn) {
    const list = loadLocal();
    const idx = list.findIndex(matchFn);
    if (idx < 0) return null;
    const mapped = mapRow(list[idx]);
    if (!mapped || mapped.agreed_amount == null || mapped.agreed_amount <= 0) return mapped;
    const raw = list[idx];
    const needsPersist =
      raw.platform_fee_amount == null ||
      raw.platform_fee_rate == null ||
      Number(raw.platform_fee_amount) !== mapped.platform_fee_amount;
    if (needsPersist) {
      list[idx] = {
        ...raw,
        agreed_amount: mapped.agreed_amount,
        platform_fee_rate: mapped.platform_fee_rate,
        platform_fee_amount: mapped.platform_fee_amount,
      };
      saveLocal(list);
    }
    return mapped;
  }

  function fetchLocalDealById(id) {
    return fetchLocalDealMapped((d) => String(d.id) === String(id || "").trim());
  }

  async function fetchDealById(id) {
    const key = String(id || "").trim();
    if (!key) return null;

    if (isLocalDealId(key)) {
      return fetchLocalDealById(key);
    }

    const sb = getClient();
    if (sb && !key.startsWith("local-")) {
      const { data, error } = await sb.from("service_deals").select("*").eq("id", key).maybeSingle();
      if (!error && data) return mapRow(data);
    }

    return fetchLocalDealMapped((d) => String(d.id) === key);
  }

  async function fetchDealByChatId(chatId) {
    const key = String(chatId || "").trim();
    if (!key) return null;

    const sb = getClient();
    if (sb) {
      const { data, error } = await sb
        .from("service_deals")
        .select("*")
        .eq("chat_id", key)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) return mapRow(data);
    }

    return (
      fetchLocalDealMapped((d) => String(d.chat_id) === key) ||
      fetchLocalDealMapped((d) => String(d.id) === key)
    );
  }

  async function findOpenDeal(serviceId, clientUserId) {
    const sid = String(serviceId || "").trim();
    const cid = String(clientUserId || "").trim();
    if (!sid || !cid) return null;

    const open = new Set(["consulting", "agreed", "payment_pending"]);
    const local = loadLocal().find(
      (d) => d.service_id === sid && d.client_user_id === cid && open.has(d.status)
    );
    if (local) return mapRow(local);

    const sb = getClient();
    if (sb) {
      const { data } = await sb
        .from("service_deals")
        .select("*")
        .eq("service_id", sid)
        .eq("client_user_id", cid)
        .in("status", [...open])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return mapRow(data);
    }
    return null;
  }

  async function fetchDealsForUser(userId) {
    const uid = String(userId || getCurrentUserId()).trim();
    if (!uid) return [];

    /** @type {Map<string, object>} */
    const byId = new Map();
    for (const row of loadLocal()) {
      if (row.client_user_id === uid || row.provider_user_id === uid) {
        byId.set(String(row.id), mapRow({ ...row, _source: row._source || "local" }));
      }
    }

    const sb = getClient();
    if (sb && window.location.protocol !== "file:") {
      const { data, error } = await sb
        .from("service_deals")
        .select("*")
        .or(`client_user_id.eq.${uid},provider_user_id.eq.${uid}`)
        .order("updated_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          byId.set(String(row.id), mapRow(row));
        }
      } else if (error) {
        console.warn("[ServiceDeals] fetchDealsForUser failed:", error);
      }
    }

    return [...byId.values()].sort((a, b) =>
      String(b.updated_at || b.created_at || "").localeCompare(
        String(a.updated_at || a.created_at || "")
      )
    );
  }

  window.TasuServiceDealsDb = {
    DEFAULT_FEE_RATE,
    LOCAL_DEAL_PREFIX,
    isLocalDealId,
    fetchLocalDealById,
    calcFee,
    formatYen,
    formatFeeRatePercent,
    resolveDealFees,
    insertDeal,
    updateDeal,
    fetchDealById,
    fetchDealByChatId,
    findOpenDeal,
    fetchDealsForUser,
    loadLocal,
  };
})();
