#!/usr/bin/env node
/**
 * Platform NB-1M — Content Gate + Attachment Gate 実画面スモーク
 *   npm run build:pages && npm run dev   # 別ターミナル
 *   node scripts/smoke-platform-nb1m-content-gate-browser.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "reports", "platform-nb1m-smoke-browser.json");

/** @type {{ id: string, surface: string, expect: string, pass: boolean, actual: string, notes?: string }[]} */
const results = [];
let consoleErrors = [];

function record(id, surface, expect, pass, actual, notes) {
  results.push({ id, surface, expect, pass, actual, notes: notes || "" });
  console.log(pass ? "PASS" : "FAIL", id, "—", actual);
}

async function gotoReady(page, path) {
  const errors = [];
  const onErr = (msg) => {
    if (String(msg).includes("favicon")) return;
    errors.push(String(msg));
  };
  page.on("pageerror", onErr);
  page.on("console", (m) => {
    if (m.type() === "error") onErr(m.text());
  });
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
  consoleErrors.push(...errors);
  return errors;
}

async function main() {
  const base = await requireDevServer();
  console.log(`\nNB-1M browser smoke — ${base}\n`);

  await withPlaywrightBrowser(async (browser) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // --- Three-tier flow: events + moderation logs ---
    await gotoReady(page, `${base}/post.html`);
    const tierFlow = await page.evaluate(async () => {
      const G = window.TasuPlatformContentGate;
      const A = window.TasuPlatformContentGateAttachments;
      const Ev = window.TasuPlatformContentGateEvents;
      const Log = window.TasuPlatformModerationLog;

      const eventTypes = () => (Ev?.listRecent?.(80) || []).map((e) => e.type);
      const logVerdicts = () => (Log?.listRecent?.(30) || []).map((l) => l.verdict);

      const out = {};

      // T1 allow
      localStorage.removeItem(Ev?.STORAGE_KEY || "tasu_platform_content_gate_events_v1");
      localStorage.removeItem(Log?.STORAGE_KEY || "tasu_platform_moderation_logs_v1");
      const safe = G.applyListingPublishGate(
        { title: "代行", description: "渋谷で買い物代行", publish_status: "public" },
        { requestedPublishStatus: "public" }
      );
      const typesAfterSafe = eventTypes();
      out.t1 = {
        publish: safe.row?.publish_status,
        mod: safe.row?.moderation_status,
        flags: safe.row?.moderation_flags || [],
        autoPublic: safe.autoPublic,
        hasAutoCleared: typesAfterSafe.includes("moderation.auto_cleared"),
        hasApprovedAuto: typesAfterSafe.includes("listing.approved_auto"),
      };

      // T2 phone block + contact_leak
      const phone = G.applyListingPublishGate(
        { title: "代行", description: "090-9999-8888", publish_status: "public" },
        { requestedPublishStatus: "public" }
      );
      const typesAfterPhone = eventTypes();
      out.t2 = {
        blocked: phone.blocked,
        hasBlocked: typesAfterPhone.includes("moderation.blocked"),
        hasContactLeak: typesAfterPhone.includes("contact_leak_attempt"),
        logHasBlock: logVerdicts().includes("block"),
      };

      // T3 email
      const email = G.applyListingPublishGate(
        { title: "代行", description: "mail@test.co.jp", publish_status: "public" },
        { requestedPublishStatus: "public" }
      );
      out.t3 = { blocked: email.blocked, logHasBlock: logVerdicts().includes("block") };

      // T4 instagram (SNS) — block
      const ig = G.scanText?.("instagram.com/myshop");
      out.t4 = { igVerdict: ig?.verdict, igFlags: ig?.flags };

      // T5 ext pay
      const ext = G.applyListingPublishGate(
        { title: "代行", description: "銀行振込で", publish_status: "public" },
        { requestedPublishStatus: "public" }
      );
      out.t5 = { blocked: ext.blocked };

      // T6 attachment listing async
      if (G.applyListingPublishGateAsync) {
        const withImg = await G.applyListingPublishGateAsync(
          {
            title: "代行",
            description: "安全",
            publish_status: "public",
            image_url:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          },
          { requestedPublishStatus: "public" }
        );
        out.t6 = {
          publish: withImg.row?.publish_status,
          pending: withImg.pending,
          hasAttachments: Boolean(withImg.attachmentScan?.hasAttachments),
        };
      }

      // T7 OCR none
      window.TASU_CHAT_OCR_CONFIG = { provider: "none" };
      const ocrNone = await A.scanAttachments([
        {
          name: "x.jpg",
          mime: "image/jpeg",
          dataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          url:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        },
      ]);
      out.t7 = { unscanned: ocrNone.unscanned, verdict: ocrNone.verdict };

      // T8 zip + office
      const zip = await A.scanAttachments([{ name: "a.zip", mime: "application/zip" }]);
      const office = await A.scanAttachments([{ name: "doc.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }]);
      out.t8 = { zip: zip.verdict, office: office.verdict, officeUnscanned: office.unscanned };

      // business listing same gate
      const biz = G.applyListingPublishGate(
        { title: "サービス", description: "渋谷対応", listing_type: "business", publish_status: "public" },
        { requestedPublishStatus: "public" }
      );
      out.business = { publish: biz.row?.publish_status, mod: biz.row?.moderation_status, autoPublic: biz.autoPublic };

      out.logCount = Log?.listRecent?.(50)?.length || 0;

      return out;
    });

    record(
      "T1-allow",
      "三層",
      "public+approved+flags空+auto_cleared",
      tierFlow.t1?.publish === "public" &&
        tierFlow.t1?.mod === "approved" &&
        (tierFlow.t1?.flags?.length || 0) === 0 &&
        tierFlow.t1?.hasAutoCleared === true,
      JSON.stringify(tierFlow.t1)
    );
    record(
      "T2-phone-events",
      "三層",
      "block+contact_leak+moderation log",
      tierFlow.t2?.blocked === true &&
        tierFlow.t2?.hasBlocked === true &&
        tierFlow.t2?.hasContactLeak === true &&
        tierFlow.t2?.logHasBlock === true,
      JSON.stringify(tierFlow.t2)
    );
    record(
      "T3-email",
      "三層",
      "block+ログ",
      tierFlow.t3?.blocked === true && tierFlow.t3?.logHasBlock === true,
      JSON.stringify(tierFlow.t3)
    );
    record(
      "T4-sns",
      "三層",
      "SNS block",
      tierFlow.t4?.igVerdict === "block",
      JSON.stringify(tierFlow.t4)
    );
    record("T5-extpay", "三層", "block", tierFlow.t5?.blocked === true, JSON.stringify(tierFlow.t5));
    record(
      "T6-attach-listing",
      "三層",
      "pending_review",
      tierFlow.t6?.publish === "pending_review" && tierFlow.t6?.pending === true,
      JSON.stringify(tierFlow.t6)
    );
    record(
      "T7-ocr-none",
      "三層",
      "unscanned+needs_review",
      tierFlow.t7?.unscanned === true && tierFlow.t7?.verdict === "needs_review",
      JSON.stringify(tierFlow.t7)
    );
    record(
      "T8-zip-office",
      "三層",
      "pending",
      tierFlow.t8?.zip === "needs_review" && tierFlow.t8?.office === "needs_review",
      JSON.stringify(tierFlow.t8)
    );
    record(
      "T-biz-listing",
      "business",
      "allow public+approved",
      tierFlow.business?.publish === "public" && tierFlow.business?.mod === "approved",
      JSON.stringify(tierFlow.business)
    );
    record(
      "T-modlog",
      "moderation log",
      "LS記録あり",
      tierFlow.logCount > 0,
      `logCount=${tierFlow.logCount}`
    );

    // --- post.html: gate modules + listing cases ---
    const postGate = await page.evaluate(async () => {
      const G = window.TasuPlatformContentGate;
      const A = window.TasuPlatformContentGateAttachments;
      if (!G) return { error: "TasuPlatformContentGate missing" };

      const out = {};

      const cases = {
        safe: { title: "代行", description: "渋谷エリアで買い物代行します", publish_status: "public" },
        phone: { title: "代行", description: "連絡 090-1234-5678", publish_status: "public" },
        email: { title: "代行", description: "test@example.com へ", publish_status: "public" },
        line: { title: "代行", description: "line.me/tasu", publish_status: "public" },
        discord: { title: "代行", description: "discord.gg/abc", publish_status: "public" },
        url: { title: "代行", description: "https://example.com", publish_status: "public" },
        extPay: { title: "代行", description: "銀行振込でお支払い", publish_status: "public" },
        paypay: { title: "代行", description: "PayPayで送金", publish_status: "public" },
      };

      for (const [key, payload] of Object.entries(cases)) {
        const gate = G.applyListingPublishGate(payload, { requestedPublishStatus: "public" });
        out[key] = {
          ok: gate.ok,
          blocked: Boolean(gate.blocked),
          publish: gate.row?.publish_status,
          moderation: gate.row?.moderation_status,
          pending: gate.pending,
          autoPublic: gate.autoPublic,
          verdict: gate.scan?.verdict,
        };
      }

      // attachment: image OCR none
      if (A?.scanAttachments) {
        window.TASU_CHAT_OCR_CONFIG = { provider: "none" };
        const imgRef = {
          name: "photo.jpg",
          mime: "image/jpeg",
          dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        };
        const ocrNone = await A.scanAttachments([imgRef]);
        out.attachOcrNone = {
          verdict: ocrNone.verdict,
          unscanned: ocrNone.unscanned,
          pending: ocrNone.verdict !== "block",
        };

        // attachment: mock OCR email
        window.TasuChatOcr = {
          getProviderName: () => "mock",
          extractTextFromImage: async () => ({ ok: true, text: "contact test@example.com", provider: "mock" }),
        };
        window.TASU_CHAT_OCR_CONFIG = { provider: "mock" };
        const ocrEmail = await A.scanAttachments([imgRef]);
        out.attachOcrEmail = { verdict: ocrEmail.verdict, flags: ocrEmail.flags };

        // ZIP
        const zip = await A.scanAttachments([
          { name: "files.zip", mime: "application/zip", dataUrl: "", url: "" },
        ]);
        out.attachZip = { verdict: zip.verdict, unscanned: zip.unscanned };

        // txt with phone
        const txtPhone = await A.scanAttachments([
          {
            name: "note.txt",
            mime: "text/plain",
            dataUrl: `data:text/plain,${encodeURIComponent("電話 080-1111-2222")}`,
            url: `data:text/plain,${encodeURIComponent("電話 080-1111-2222")}`,
          },
        ]);
        out.attachTxtPhone = { verdict: txtPhone.verdict };
      }

      // events + queue seed
      const beforeEvents = window.TasuPlatformContentGateEvents?.listRecent?.(5)?.length || 0;
      G.emitGateEvent("moderation.needs_review", { surface: "listing", flags: ["smoke_test"], reasons: ["smoke"] });
      const afterEvents = window.TasuPlatformContentGateEvents?.listRecent?.(5)?.length || 0;
      out.eventsRecorded = afterEvents >= beforeEvents;

      if (window.TasuPlatformModerationQueue?.trackLocalListing) {
        window.TasuPlatformModerationQueue.trackLocalListing(
          {
            id: `smoke-${Date.now()}`,
            title: "smoke pending",
            user_id: "smoke-user",
            publish_status: "pending_review",
            moderation_status: "pending_review",
            moderation_flags: ["smoke_test"],
          },
          "listings"
        );
      }
      const qLen =
        window.TasuPlatformModerationQueue?.readLocalQueue?.()?.filter(
          (x) => x.moderation_status === "pending_review"
        ).length || 0;
      out.queueLen = qLen;

      out.hasBridge = Boolean(window.TasuPlatformContentGateAiBridge);
      out.hasModerationLog = Boolean(window.TasuPlatformModerationLog);
      out.hasListingStore = Boolean(window.TasuListingStore?.insertListing);

      return out;
    });

    if (postGate.error) {
      record("post-modules", "post.html", "gate loaded", false, postGate.error);
    } else {
      record("01-safe", "post.html", "allow → public+approved", postGate.safe?.autoPublic === true && postGate.safe?.publish === "public", JSON.stringify(postGate.safe));
      record("02-phone", "post.html", "block", postGate.phone?.blocked === true, JSON.stringify(postGate.phone));
      record("03-email", "post.html", "block", postGate.email?.blocked === true, JSON.stringify(postGate.email));
      record("04-line", "post.html", "block", postGate.line?.blocked === true, JSON.stringify(postGate.line));
      record("05-discord", "post.html", "block", postGate.discord?.blocked === true, JSON.stringify(postGate.discord));
      record("06-url", "post.html", "block", postGate.url?.blocked === true, JSON.stringify(postGate.url));
      record("07-extPay", "post.html", "block", postGate.extPay?.blocked === true, JSON.stringify(postGate.extPay));
      record(
        "05b-paypay",
        "post.html",
        "needs_review → pending",
        postGate.paypay?.pending === true && postGate.paypay?.publish === "pending_review",
        JSON.stringify(postGate.paypay)
      );
      record(
        "08-attach-ocr-none",
        "post.html",
        "pending_review (unscanned)",
        postGate.attachOcrNone?.unscanned === true && postGate.attachOcrNone?.verdict === "needs_review",
        JSON.stringify(postGate.attachOcrNone)
      );
      record(
        "09-attach-ocr-email",
        "post.html",
        "block",
        postGate.attachOcrEmail?.verdict === "block",
        JSON.stringify(postGate.attachOcrEmail)
      );
      record(
        "10-attach-zip",
        "post.html",
        "pending_review",
        postGate.attachZip?.verdict === "needs_review",
        JSON.stringify(postGate.attachZip)
      );
      record(
        "07b-attach-txt-phone",
        "post.html",
        "block (txt/PDF相当)",
        postGate.attachTxtPhone?.verdict === "block",
        JSON.stringify(postGate.attachTxtPhone)
      );
      record("13-events", "post.html", "AI秘書イベント記録", postGate.eventsRecorded === true, String(postGate.eventsRecorded));
      record("14-queue", "post.html", "moderation queue", postGate.queueLen > 0, `queueLen=${postGate.queueLen}`);
      record("modules-bridge", "post.html", "ai-bridge loaded", postGate.hasBridge === true, String(postGate.hasBridge));
    }

    // --- chat-detail consult ---
    await gotoReady(page, `${base}/chat-detail.html?thread=chat-smoke-nb1m&talkDev=1`);
    const chatRes = await page.evaluate(async () => {
      const G = window.TasuPlatformContentGate;
      const scan = G?.scanChatMessage?.({ text: "090-1234-5678 で連絡" });
      let saveBlocked = null;
      if (window.TasuChatService?.saveMessage) {
        const r = await window.TasuChatService.saveMessage("chat-smoke-nb1m", {
          text: "090-1234-5678",
          senderId: "smoke-user",
        });
        saveBlocked = !r.ok;
      }
      return { scan, saveBlocked, hasService: Boolean(window.TasuChatService) };
    });
    record(
      "11-consult-chat",
      "chat-detail.html",
      "block send",
      chatRes.scan?.allowed === false && chatRes.saveBlocked === true,
      JSON.stringify({ scan: chatRes.scan, saveBlocked: chatRes.saveBlocked })
    );

    const reviewFull = await page.evaluate(() => {
      const G = window.TasuPlatformContentGate;
      const createBlock = G?.applyReviewGate?.("test@example.com");
      const createOk = G?.applyReviewGate?.("とても良い取引でした");
      let updateBlock = null;
      try {
        const Db = window.TasuBusinessServiceReviewsDb;
        if (Db?.createReview && Db?.updateReview) {
          const row = Db.createReview({
            deal_id: `smoke-deal-${Date.now()}`,
            service_id: "smoke-svc",
            rating: 5,
            comment: "良好",
          });
          try {
            Db.updateReview(row.id, { comment: "090-1234-5678" });
            updateBlock = false;
          } catch {
            updateBlock = true;
          }
        }
      } catch {
        updateBlock = "create_failed";
      }
      return {
        createBlocked: createBlock?.ok === false,
        createOk: createOk?.ok === true,
        updateBlocked: updateBlock === true,
      };
    });
    record(
      "10-review-create",
      "chat-detail",
      "create block",
      reviewFull.createBlocked === true && reviewFull.createOk === true,
      JSON.stringify(reviewFull)
    );
    record(
      "10b-review-update",
      "chat-detail",
      "update block",
      reviewFull.updateBlocked === true,
      JSON.stringify(reviewFull)
    );

    const chatAttach = await page.evaluate(async () => {
      const img =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      window.TASU_CHAT_OCR_CONFIG = { provider: "none" };
      const A = window.TasuPlatformContentGateAttachments;
      const refs = A?.collectChatAttachmentRefs?.({
        text: "参考画像です",
        attachment: { name: "photo.jpg", type: "image/jpeg", dataUrl: img },
      });
      const attachmentScan = refs?.length ? await A.scanAttachments(refs) : null;
      const threadId = "chat-demo-skill-plain-001";
      let saveResult = null;
      if (window.TasuChatService?.saveMessage) {
        saveResult = await window.TasuChatService.saveMessage(threadId, {
          text: "参考画像です",
          senderId: "u_hiro",
          attachment: { name: "photo.jpg", type: "image/jpeg", dataUrl: img },
        });
      }
      const mod = saveResult?.moderation;
      return {
        scanUnscanned: attachmentScan?.unscanned,
        scanVerdict: attachmentScan?.verdict,
        saveOk: saveResult?.ok === true,
        level: mod?.level,
        hasAttachmentScan: Boolean(mod?._attachmentScan),
        unscanned: mod?._attachmentScan?.unscanned,
        saveReason: saveResult?.reason || null,
      };
    });
    record(
      "11b-consult-attach",
      "chat-detail",
      "attachment gate · unscanned (OCR none)",
      chatAttach.scanUnscanned === true && chatAttach.scanVerdict === "needs_review",
      JSON.stringify(chatAttach)
    );

    // --- shop LS ---
    await gotoReady(page, `${base}/shop-market-listing-new.html?shopId=smoke-shop`);
    const shopRes = await page.evaluate(() => {
      const M = window.TasfulMarketProductData;
      const G = window.TasuPlatformContentGate;
      const gateOnly = G?.applyShopPublishGate?.({
        title: "スモーク商品",
        description: "安全な説明文",
        sellerName: "Smoke Shop",
      });
      const validInput = {
        title: "スモーク商品",
        description: "安全な説明文",
        category: "misc",
        conditionType: "new",
        priceYen: 1000,
        imageUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        sellerName: "Smoke Shop",
        shipDaysKey: "1-2",
        stock: 1,
        shopId: "smoke-shop",
      };
      const pub = M?.publishSellerProduct?.(validInput);
      const pool = M?.getSellerProducts?.() || [];
      const latest = pool[0];
      const shopVisible = M?.getProductsByShop?.([], "smoke-shop") || [];
      const pendingVisible = shopVisible.some((p) => p.title === "スモーク商品");
      return {
        gateOnly: gateOnly
          ? { pending: gateOnly.pending, publish: gateOnly.entry?.publish_status, mod: gateOnly.entry?.moderation_status }
          : null,
        pub,
        latestPublish: latest?.publish_status,
        latestMod: latest?.moderation_status,
        demoOnly: latest?._demoOnly,
        isProductionListed: latest?.isProductionListed,
        pendingInPublicPool: pendingVisible,
        shopVisibleCount: shopVisible.length,
      };
    });
    record(
      "12-shop-ls",
      "shop-market-listing-new.html",
      "pending · not production public",
      shopRes.gateOnly?.pending === true &&
        shopRes.pub?.ok === true &&
        shopRes.pub?.pending === true &&
        shopRes.latestPublish === "pending_review" &&
        shopRes.latestMod === "pending_review" &&
        shopRes.isProductionListed === false &&
        shopRes.demoOnly === true,
      JSON.stringify(shopRes)
    );
    record(
      "12c-shop-pool",
      "shop LS",
      "getProductsByShop excludes pending",
      shopRes.pendingInPublicPool === false,
      `pendingInPool=${shopRes.pendingInPublicPool} visible=${shopRes.shopVisibleCount}`
    );

    // --- support-intake ---
    await gotoReady(page, `${base}/support-intake.html`);
    const supportRes = await page.evaluate(() => {
      localStorage.removeItem("tasu_support_tickets_v1");
      const ok = window.TasuSupportTicketService?.submitInquiry?.({
        user_id: "smoke-safe",
        title: "問い合わせ",
        body: "渋谷について教えてください",
        source: "web_form",
      });
      const blocked = window.TasuSupportTicketService?.submitInquiry?.({
        user_id: "smoke-block",
        title: "問い合わせ",
        body: "090-1234-5678 に電話ください",
        source: "web_form",
      });
      return {
        okHasTicket: Boolean(ok?.ticket?.id),
        okBlocked: ok?.blocked === true,
        blocked: blocked?.blocked === true,
        blockedError: blocked?.error,
      };
    });
    record(
      "12-support-ok",
      "support-intake",
      "inquiry allow",
      supportRes.okHasTicket === true && supportRes.okBlocked !== true,
      JSON.stringify(supportRes)
    );
    record(
      "12d-support-block",
      "support-intake",
      "inquiry block",
      supportRes.blocked === true,
      JSON.stringify(supportRes)
    );

    // --- admin dashboard pendingReviewCount ---
    await gotoReady(page, `${base}/admin-operations-dashboard.html`);
    const opsRes = await page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 800));
      const events = window.TasuPlatformContentGateEvents?.countPendingSignals?.() ?? 0;
      const queue =
        window.TasuPlatformModerationQueue?.readLocalQueue?.()?.filter(
          (x) => x.moderation_status === "pending_review"
        ).length ?? 0;
      return { events, queue, combined: events + queue };
    });
    record(
      "12b-pendingReviewCount",
      "admin-operations-dashboard.html",
      "pendingReviewCount > 0",
      opsRes.combined > 0,
      JSON.stringify(opsRes)
    );

    // --- Partner / MATCH / LIVE no gate breakage ---
    for (const spec of [
      { id: "partner", path: "/builder/admin-partners.html" },
      { id: "match", path: "/match/match-top.html" },
      { id: "live", path: "/live/talk-home.html" },
    ]) {
      const errs = await gotoReady(page, `${base}${spec.path}`);
      const hasGate = await page.evaluate(() => Boolean(window.TasuPlatformContentGate));
      record(
        `${spec.id}-unaffected`,
        spec.path,
        "no content-gate · no fatal error",
        !hasGate && errs.filter((e) => /TypeError|ReferenceError/.test(e)).length === 0,
        `hasGate=${hasGate} errors=${errs.length}`
      );
    }

    await ctx.close();
  });

  await closeAllBrowsers();

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.filter((r) => !r.pass).length;
  const summary = {
    at: new Date().toISOString(),
    migrationApplied: false,
    passCount,
    failCount,
    consoleErrorCount: consoleErrors.length,
    results,
    consoleErrors: consoleErrors.slice(0, 20),
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\nDone: ${passCount} pass / ${failCount} fail → ${OUT}`);

  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
