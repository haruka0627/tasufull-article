#!/usr/bin/env node
/**
 * Marketplace RLS P1-S1〜S4 検証（REST + JWT）
 *
 *   node scripts/verify-marketplace-rls.mjs
 *
 * 要: SUPABASE_SERVICE_ROLE_KEY
 * 任意: MARKETPLACE_RLS_USER_A_JWT / _B_JWT（未設定時 talk テストユーザー自動発行）
 */
import {
  loadTalkSupabaseConfig,
  ensureTalkJwt,
  TALK_TEST_USERS,
} from "./lib/talk-rls-test-auth.mjs";

const OWNER_A = TALK_TEST_USERS.u_me.talkUserId;
const OWNER_B = TALK_TEST_USERS.u_store.talkUserId;
const RUN_SUFFIX = `${Date.now()}`;
const MARKER = `marketplace-rls-${RUN_SUFFIX}`;

function isDenied(res) {
  if (res.status === 401 || res.status === 403) return true;
  const msg = String(res.data?.message || res.data?.hint || "").toLowerCase();
  return msg.includes("row-level security") || msg.includes("permission denied");
}

async function rest(cfg, { table, method = "GET", query = "", body, jwt, useService = false, prefer }) {
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const defaultPrefer =
    method === "GET" ? "count=exact" : method === "PATCH" || method === "POST" ? "return=representation" : "return=minimal";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer: prefer || defaultPrefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  const countHeader = res.headers.get("content-range");
  return { ok: res.ok, status: res.status, data, countHeader };
}

async function countDevPolicies(cfg) {
  const tables = ["listings", "business_listings", "profiles", "members"];
  let total = 0;
  for (const tablename of tables) {
    const res = await rest(cfg, {
      table: "pg_policies",
      query: `select=policyname&tablename=eq.${tablename}&policyname=like.*_dev`,
      useService: true,
    });
    if (Array.isArray(res.data)) total += res.data.length;
  }
  return total;
}

async function cleanup(cfg, ids) {
  for (const id of ids.listings || []) {
    await rest(cfg, {
      table: "listings",
      method: "DELETE",
      query: `id=eq.${id}`,
      useService: true,
    });
  }
  for (const id of ids.business || []) {
    await rest(cfg, {
      table: "business_listings",
      method: "DELETE",
      query: `id=eq.${id}`,
      useService: true,
    });
  }
  const draftOnlyUser = ids.draftOnlyUser;
  if (draftOnlyUser) {
    await rest(cfg, {
      table: "listings",
      method: "DELETE",
      query: `user_id=eq.${encodeURIComponent(draftOnlyUser)}`,
      useService: true,
    });
    await rest(cfg, {
      table: "profiles",
      method: "DELETE",
      query: `user_id=eq.${encodeURIComponent(draftOnlyUser)}`,
      useService: true,
    });
    await rest(cfg, {
      table: "members",
      method: "DELETE",
      query: `user_id=eq.${encodeURIComponent(draftOnlyUser)}`,
      useService: true,
    });
    await rest(cfg, {
      table: "users",
      method: "DELETE",
      query: `id=eq.${encodeURIComponent(draftOnlyUser)}`,
      useService: true,
    });
  }
}

async function main() {
  console.log("\n=== Marketplace RLS 検証 (P1 + P2 + P3) ===\n");
  console.log(`  marker: ${MARKER}\n`);

  const cfg = loadTalkSupabaseConfig();
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  if (!cfg.url || !cfg.anonKey || !cfg.serviceKey) {
    fail("SUPABASE_URL / anon / SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(1);
  }

  const devCount = await countDevPolicies(cfg);
  if (devCount > 0) {
    fail(`dev policies still present (${devCount}) — run sql/marketplace-rls-drop-dev-policies.sql`);
  } else {
    pass("no dev policies on marketplace tables");
  }

  let jwtA = "";
  let jwtB = "";
  try {
    jwtA = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
    jwtB = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
    pass("JWT issued (talk_user_id / member_id claims)");
  } catch (err) {
    fail(`JWT setup: ${err.message}`);
    process.exit(1);
  }

  const cleanupIds = { listings: [], business: [], draftOnlyUser: null };

  // --- seed test listings (service_role) ---
  const draftRow = {
    user_id: OWNER_A,
    listing_type: "product",
    title: `${MARKER}-draft`,
    description: "rls verify draft",
    publish_status: "draft",
  };
  const publicRow = {
    user_id: OWNER_A,
    listing_type: "product",
    title: `${MARKER}-public`,
    description: "rls verify public",
    publish_status: "public",
  };
  const draftBRow = {
    user_id: OWNER_B,
    listing_type: "skill",
    title: `${MARKER}-b-draft`,
    description: "rls verify",
    publish_status: "draft",
  };

  const insDraft = await rest(cfg, {
    table: "listings",
    method: "POST",
    body: draftRow,
    useService: true,
  });
  const insPublic = await rest(cfg, {
    table: "listings",
    method: "POST",
    body: publicRow,
    useService: true,
  });
  const insDraftB = await rest(cfg, {
    table: "listings",
    method: "POST",
    body: draftBRow,
    useService: true,
  });

  const draftId = insDraft.data?.[0]?.id;
  const publicId = insPublic.data?.[0]?.id;
  const draftBId = insDraftB.data?.[0]?.id;

  if (!draftId || !publicId || !draftBId) {
    fail("service_role seed listings failed");
    process.exit(1);
  }
  cleanupIds.listings.push(draftId, publicId, draftBId);
  pass("service_role seed listings (draft + public)");

  // --- anon: public only ---
  const anonMarker = await rest(cfg, {
    table: "public_marketplace_listings",
    query: `select=id,title,publish_status&title=like.${encodeURIComponent(`${MARKER}%`)}`,
  });
  const anonList = Array.isArray(anonMarker.data) ? anonMarker.data : [];
  if (!anonMarker.ok) fail(`anon marker select (${anonMarker.status})`);
  else if (anonList.some((r) => r.publish_status !== "public")) {
    fail("anon reads non-public marker rows");
  } else if (!anonList.some((r) => r.id === publicId)) {
    fail("anon cannot read public marker listing");
  } else if (anonList.some((r) => r.id === draftId || r.id === draftBId)) {
    fail("anon reads draft marker listings");
  } else pass("anon reads public listings only (marker)");

  const anonDraftById = await rest(cfg, {
    table: "listings",
    query: `select=id&publish_status=eq.draft&id=eq.${draftId}`,
  });
  const anonDraftRows = Array.isArray(anonDraftById.data) ? anonDraftById.data : [];
  if (anonDraftById.ok && anonDraftRows.length > 0) fail("anon reads draft by id filter");
  else pass("anon cannot read draft listings");

  // --- anon write denied ---
  const anonInsert = await rest(cfg, {
    table: "listings",
    method: "POST",
    body: {
      user_id: "anon_probe",
      listing_type: "product",
      title: `${MARKER}-anon-insert`,
      description: "x",
      publish_status: "public",
    },
  });
  if (anonInsert.ok && !isDenied(anonInsert)) fail("anon INSERT listings succeeded");
  else pass("anon INSERT listings denied");

  const anonUpdate = await rest(cfg, {
    table: "listings",
    method: "PATCH",
    query: `id=eq.${publicId}`,
    body: { title: `${MARKER}-anon-hack` },
  });
  const afterAnonUpdate = await rest(cfg, {
    table: "listings",
    query: `select=title&id=eq.${publicId}`,
    useService: true,
  });
  const titleAfterAnon = afterAnonUpdate.data?.[0]?.title || "";
  if (titleAfterAnon.includes("anon-hack")) fail("anon UPDATE listings changed row");
  else pass("anon UPDATE listings denied (no row change)");

  const anonDelete = await rest(cfg, {
    table: "listings",
    method: "DELETE",
    query: `id=eq.${publicId}`,
    prefer: "return=representation",
  });
  const stillThere = await rest(cfg, {
    table: "listings",
    query: `select=id&id=eq.${publicId}`,
    useService: true,
  });
  if (!Array.isArray(stillThere.data) || stillThere.data.length !== 1) {
    fail("anon DELETE listings removed row");
  } else pass("anon DELETE listings denied (row preserved)");

  // --- owner A: read own draft + public ---
  const aRows = await rest(cfg, {
    table: "listings",
    query: `select=id,publish_status&title=like.${encodeURIComponent(`${MARKER}%`)}`,
    jwt: jwtA,
  });
  const aList = Array.isArray(aRows.data) ? aRows.data : [];
  if (!aRows.ok) fail(`owner A select marker (${aRows.status})`);
  else if (!aList.some((r) => r.id === draftId)) fail("owner A cannot read own draft");
  else if (!aList.some((r) => r.id === publicId)) fail("owner A cannot read own public");
  else pass("owner A reads own draft and public");

  // --- owner B: cannot read A draft ---
  const bReadADraft = await rest(cfg, {
    table: "listings",
    query: `select=id&id=eq.${draftId}`,
    jwt: jwtB,
  });
  const bDraftList = Array.isArray(bReadADraft.data) ? bReadADraft.data : [];
  if (bDraftList.length > 0) fail("non-owner B reads owner A draft");
  else pass("non-owner B cannot read owner A draft");

  // --- owner A UPDATE own draft ---
  const aUpdate = await rest(cfg, {
    table: "listings",
    method: "PATCH",
    query: `id=eq.${draftId}`,
    jwt: jwtA,
    body: { description: `${MARKER}-updated` },
  });
  if (!aUpdate.ok) fail(`owner A UPDATE draft (${aUpdate.status})`);
  else pass("owner A UPDATE own draft");

  // --- owner B UPDATE A public denied ---
  const bUpdate = await rest(cfg, {
    table: "listings",
    method: "PATCH",
    query: `id=eq.${publicId}`,
    jwt: jwtB,
    body: { title: `${MARKER}-stolen` },
  });
  const afterBUpdate = await rest(cfg, {
    table: "listings",
    query: `select=title&id=eq.${publicId}`,
    useService: true,
  });
  const titleAfterB = afterBUpdate.data?.[0]?.title || "";
  if (titleAfterB.includes("stolen")) fail("non-owner B UPDATE owner A listing changed row");
  else pass("non-owner B UPDATE owner A listing denied (no row change)");

  // --- owner A INSERT with own user_id ---
  const aInsert = await rest(cfg, {
    table: "listings",
    method: "POST",
    jwt: jwtA,
    body: {
      user_id: OWNER_A,
      listing_type: "product",
      title: `${MARKER}-owner-insert`,
      description: "owner insert",
      publish_status: "draft",
    },
  });
  const ownerInsertId = aInsert.data?.[0]?.id;
  if (!aInsert.ok || !ownerInsertId) fail(`owner A INSERT (${aInsert.status})`);
  else {
    cleanupIds.listings.push(ownerInsertId);
    pass("owner A INSERT own listing");
  }

  // --- owner A INSERT spoof B denied ---
  const aSpoof = await rest(cfg, {
    table: "listings",
    method: "POST",
    jwt: jwtA,
    body: {
      user_id: OWNER_B,
      listing_type: "product",
      title: `${MARKER}-spoof`,
      description: "spoof",
      publish_status: "draft",
    },
  });
  if (aSpoof.ok && !isDenied(aSpoof)) fail("owner A INSERT with other user_id succeeded");
  else pass("owner A INSERT other user_id denied");

  // --- profiles: draft-only user hidden from anon ---
  const draftOnlyUser = `mkt_rls_draft_${RUN_SUFFIX}`;
  cleanupIds.draftOnlyUser = draftOnlyUser;
  await rest(cfg, {
    table: "users",
    method: "POST",
    body: { id: draftOnlyUser, handle: draftOnlyUser },
    useService: true,
  });
  await rest(cfg, {
    table: "profiles",
    method: "POST",
    body: {
      user_id: draftOnlyUser,
      display_name: `${MARKER} draft-only profile`,
    },
    useService: true,
  });
  await rest(cfg, {
    table: "listings",
    method: "POST",
    body: {
      user_id: draftOnlyUser,
      listing_type: "product",
      title: `${MARKER}-draftonly`,
      description: "draft only seller",
      publish_status: "draft",
    },
    useService: true,
  });

  const anonDraftProfile = await rest(cfg, {
    table: "profiles",
    query: `select=user_id,display_name&user_id=eq.${encodeURIComponent(draftOnlyUser)}`,
  });
  const anonProfRows = Array.isArray(anonDraftProfile.data) ? anonDraftProfile.data : [];
  if (anonProfRows.length > 0) fail("anon reads draft-only seller profile");
  else pass("anon cannot read draft-only seller profile");

  const ownerDraftProfile = await rest(cfg, {
    table: "profiles",
    method: "POST",
    jwt: jwtA,
    body: {
      user_id: OWNER_A,
      display_name: `${MARKER}-profile-touch`,
      updated_at: new Date().toISOString(),
    },
  });
  const ownerProfUpsert =
    ownerDraftProfile.ok ||
    (await rest(cfg, {
      table: "profiles",
      method: "PATCH",
      query: `user_id=eq.${encodeURIComponent(OWNER_A)}`,
      jwt: jwtA,
      body: { display_name: `${MARKER}-profile-touch` },
    })).ok;
  if (!ownerProfUpsert) fail("owner A profiles write failed");
  else pass("owner A profiles upsert/update");

  // --- page smoke: public marketplace reads ---
  const anonPublicListings = await rest(cfg, {
    table: "public_marketplace_listings",
    query: "select=id,title,publish_status&limit=5",
  });
  const pubCount = Array.isArray(anonPublicListings.data) ? anonPublicListings.data.length : 0;
  if (!anonPublicListings.ok || pubCount === 0) {
    fail("page smoke: anon public listings empty");
  } else pass(`page smoke: anon public listings (${pubCount}+ rows)`);

  const anonBiz = await rest(cfg, {
    table: "public_business_listings",
    query: "select=id,title,publish_status&limit=5",
  });
  const bizCount = Array.isArray(anonBiz.data) ? anonBiz.data.length : 0;
  if (!anonBiz.ok || bizCount === 0) {
    fail("page smoke: anon public business_listings empty");
  } else pass(`page smoke: anon public business_listings (${bizCount}+ rows)`);

  const publicSellerRes = await rest(cfg, {
    table: "listings",
    query: "select=user_id&publish_status=eq.public&limit=1",
    useService: true,
  });
  const publicSellerId = publicSellerRes.data?.[0]?.user_id || OWNER_A;

  const anonSellerProfile = await rest(cfg, {
    table: "public_marketplace_profiles",
    query: `select=user_id,display_name&user_id=eq.${encodeURIComponent(publicSellerId)}`,
  });
  const sellerProf = Array.isArray(anonSellerProfile.data) ? anonSellerProfile.data : [];
  if (!anonSellerProfile.ok || sellerProf.length === 0) {
    fail(`page smoke: public seller profile (${publicSellerId}) not readable`);
  } else pass(`page smoke: public seller profile (${publicSellerId})`);

  const anonSellerMember = await rest(cfg, {
    table: "public_marketplace_members",
    query: `select=user_id,rank&user_id=eq.${encodeURIComponent(publicSellerId)}`,
  });
  const sellerMem = Array.isArray(anonSellerMember.data) ? anonSellerMember.data : [];
  if (!anonSellerMember.ok || sellerMem.length === 0) {
    fail(`page smoke: public seller member (${publicSellerId}) not readable`);
  } else pass(`page smoke: public seller member (${publicSellerId})`);

  if (publicId) {
    const detail = await rest(cfg, {
      table: "public_marketplace_listings",
      query: `select=id,title,user_id,publish_status&id=eq.${publicId}`,
    });
    const detailRows = Array.isArray(detail.data) ? detail.data : [];
    if (!detail.ok || detailRows.length !== 1) fail("page smoke: product detail by UUID failed");
    else pass("page smoke: product detail (public UUID via safe view)");
  }

  // --- P2: column mask / safe layer ---
  console.log("\n  [P2 column mask]");

  await rest(cfg, {
    table: "listings",
    method: "PATCH",
    query: `id=eq.${publicId}`,
    useService: true,
    body: {
      payment_url: `https://stripe.test/${MARKER}`,
      bank_transfer_info: `${MARKER}-bank-secret`,
    },
  });

  const safeListings = await rest(cfg, {
    table: "public_marketplace_listings",
    query: "select=id,title,user_id,publish_status&publish_status=eq.public&limit=3",
  });
  const safeList = Array.isArray(safeListings.data) ? safeListings.data : [];
  if (!safeListings.ok || safeList.length === 0) fail("P2: safe view listings empty");
  else pass("P2: anon reads public_marketplace_listings");

  const safeKeys = new Set(Object.keys(safeList[0] || {}));
  if (safeKeys.has("payment_url") || safeKeys.has("bank_transfer_info")) {
    fail("P2: safe view row contains payment columns");
  } else pass("P2: safe view excludes payment_url / bank_transfer_info keys");

  const safePaySelect = await rest(cfg, {
    table: "public_marketplace_listings",
    query: `select=payment_url&id=eq.${publicId}`,
  });
  if (safePaySelect.ok && Array.isArray(safePaySelect.data) && safePaySelect.data.length > 0) {
    fail("P2: payment_url selectable from safe view");
  } else pass("P2: payment_url not a column on safe view");

  const anonBasePay = await rest(cfg, {
    table: "listings",
    query: `select=payment_url,bank_transfer_info&id=eq.${publicId}`,
  });
  const anonPayRow = Array.isArray(anonBasePay.data) ? anonBasePay.data[0] : null;
  if (anonBasePay.ok && (anonPayRow?.payment_url || anonPayRow?.bank_transfer_info)) {
    fail("P2: anon reads payment columns from base listings");
  } else pass("P2: anon base listings direct SELECT denied or payment masked");

  const ownerBasePay = await rest(cfg, {
    table: "listings",
    query: `select=payment_url,bank_transfer_info&id=eq.${publicId}`,
    jwt: jwtA,
  });
  const ownerPayRow = Array.isArray(ownerBasePay.data) ? ownerBasePay.data[0] : null;
  if (!ownerBasePay.ok) fail(`P2: owner payment column select (${ownerBasePay.status})`);
  else if (ownerPayRow?.payment_url !== `https://stripe.test/${MARKER}`) {
    fail("P2: owner cannot read own payment_url");
  } else pass("P2: owner reads own payment_url from base listings");

  const safeBiz = await rest(cfg, {
    table: "public_business_listings",
    query: "select=id,title,publish_status&limit=2",
  });
  if (!safeBiz.ok || !Array.isArray(safeBiz.data) || safeBiz.data.length === 0) {
    fail("P2: public_business_listings empty");
  } else pass("P2: anon reads public_business_listings");

  const anonLastSeen = await rest(cfg, {
    table: "profiles",
    query: `select=last_seen_at&user_id=eq.${encodeURIComponent(publicSellerId)}`,
  });
  const lastSeenRow = Array.isArray(anonLastSeen.data) ? anonLastSeen.data[0] : null;
  if (anonLastSeen.ok && lastSeenRow?.last_seen_at) fail("P2: anon reads profiles.last_seen_at");
  else pass("P2: anon base profiles direct SELECT denied or last_seen masked");

  const safeProfile = await rest(cfg, {
    table: "public_marketplace_profiles",
    query: `select=user_id,display_name,last_seen_at&user_id=eq.${encodeURIComponent(publicSellerId)}`,
  });
  if (safeProfile.ok && Array.isArray(safeProfile.data) && safeProfile.data.length > 0) {
    fail("P2: last_seen_at exposed via safe profile view select");
  } else pass("P2: public_marketplace_profiles excludes last_seen_at");

  const safeProfileRead = await rest(cfg, {
    table: "public_marketplace_profiles",
    query: `select=user_id,display_name&user_id=eq.${encodeURIComponent(publicSellerId)}`,
  });
  if (!safeProfileRead.ok || !Array.isArray(safeProfileRead.data) || !safeProfileRead.data.length) {
    fail("P2: public_marketplace_profiles unreadable");
  }   else pass("P2: public_marketplace_profiles readable for public seller");

  // --- P3: authenticated non-owner base SELECT denied ---
  console.log("\n  [P3 authenticated owner-only base]");

  const bSafePublic = await rest(cfg, {
    table: "public_marketplace_listings",
    query: `select=id,title,user_id&id=eq.${publicId}`,
    jwt: jwtB,
  });
  const bSafeRows = Array.isArray(bSafePublic.data) ? bSafePublic.data : [];
  if (!bSafePublic.ok || bSafeRows.length !== 1) {
    fail("P3: non-owner B cannot read public listing via safe view");
  } else pass("P3: non-owner B reads published listing via safe view");

  const bSafeKeys = new Set(Object.keys(bSafeRows[0] || {}));
  if (bSafeKeys.has("payment_url") || bSafeKeys.has("bank_transfer_info")) {
    fail("P3: non-owner safe view exposes payment columns");
  } else pass("P3: non-owner safe view has no payment columns");

  const bBasePublic = await rest(cfg, {
    table: "listings",
    query: `select=id,payment_url,bank_transfer_info,featured_stripe_session_id&id=eq.${publicId}`,
    jwt: jwtB,
  });
  const bBaseRow = Array.isArray(bBasePublic.data) ? bBasePublic.data[0] : null;
  if (bBasePublic.ok && bBaseRow?.id) {
    fail("P3: non-owner B reads base public listing row");
  } else pass("P3: non-owner B base listings public row denied");

  const bBaseDraft = await rest(cfg, {
    table: "listings",
    query: `select=id,publish_status&id=eq.${draftId}`,
    jwt: jwtB,
  });
  const bDraftRows = Array.isArray(bBaseDraft.data) ? bBaseDraft.data : [];
  if (bBaseDraft.ok && bDraftRows.length > 0) {
    fail("P3: non-owner B reads owner draft from base");
  } else pass("P3: non-owner B cannot read owner draft from base");

  const bBaseProfile = await rest(cfg, {
    table: "profiles",
    query: `select=user_id,display_name,last_seen_at&user_id=eq.${encodeURIComponent(OWNER_A)}`,
    jwt: jwtB,
  });
  const bProfRows = Array.isArray(bBaseProfile.data) ? bBaseProfile.data : [];
  if (bBaseProfile.ok && bProfRows.length > 0) {
    fail("P3: non-owner B reads owner profile from base");
  } else pass("P3: non-owner B base profiles denied");

  const bSafeProfile = await rest(cfg, {
    table: "public_marketplace_profiles",
    query: `select=user_id,display_name&user_id=eq.${encodeURIComponent(OWNER_A)}`,
    jwt: jwtB,
  });
  if (!bSafeProfile.ok || !Array.isArray(bSafeProfile.data) || !bSafeProfile.data.length) {
    fail("P3: non-owner B cannot read public seller profile via safe view");
  } else pass("P3: non-owner B reads public seller profile via safe view");

  const aDraftBase = await rest(cfg, {
    table: "listings",
    query: `select=id,publish_status,payment_url&id=eq.${draftId}`,
    jwt: jwtA,
  });
  const aDraftRow = Array.isArray(aDraftBase.data) ? aDraftBase.data[0] : null;
  if (!aDraftBase.ok || aDraftRow?.id !== draftId) {
    fail("P3: owner A cannot read own draft from base");
  } else pass("P3: owner A reads own draft from base");

  const noPublicPolicy = await rest(cfg, {
    table: "pg_policies",
    query:
      "select=policyname&tablename=in.(listings,business_listings,profiles,members)&policyname=like.*_select_public",
    useService: true,
  });
  const publicPolicies = Array.isArray(noPublicPolicy.data) ? noPublicPolicy.data : [];
  if (publicPolicies.length > 0) {
    fail(`P3: *_select_public policies remain (${publicPolicies.length})`);
  } else pass("P3: no *_select_public base policies");

  await cleanup(cfg, cleanupIds);

  console.log("");
  if (errors.length) {
    console.log(`FAILED (${errors.length}):`);
    errors.forEach((e) => console.log(`  - ${e}`));
    process.exit(1);
  }
  console.log("PASS — Marketplace RLS P1 + P2 + P3\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
