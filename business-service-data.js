/**
 * 業務サービス掲載データ — form_data.business_service スキーマ（詳細ページ正）
 */
(function () {
  "use strict";

  const BADGE_PRESETS = [
    "見積無料",
    "即日対応",
    "夜間対応",
    "土日対応",
    "全国対応",
    "法人対応",
    "定期契約対応",
    "オンライン対応",
    "リモート対応",
    "損害保険加入",
    "有資格者在籍",
    "写真報告対応",
    "24時間受付",
    "アフターサポート",
  ];

  function emptyBusinessService() {
    return {
      hero: {
        catch_copy: "",
        service_description: "",
        phone: "",
        business_hours: "",
        service_area_summary: "",
        contact_method: "",
        contact_methods: [],
      },
      badges: [],
      overview: { text: "", features: [], kpis: [] },
      menu_items: [],
      work_cases: [],
      company_info: {
        company_name: "",
        representative: "",
        postal_code: "",
        address: "",
        established_year: "",
        business_content: "",
        website_url: "",
        invoice_number: "",
        sns_url: "",
        phone: "",
        business_hours: "",
      },
      area_info: {
        primary: "",
        secondary: "",
        online_support: "",
        visit_support: "",
        map_url: "",
        map_embed_url: "",
      },
      flow_steps: [],
      certifications: [],
      documents: [],
      ad_options: {},
      review_settings: { use_demo: true },
      cta: {
        estimate_enabled: true,
        inquiry_enabled: true,
        phone_enabled: true,
        ai_enabled: true,
        estimate_text: "見積もりを依頼する",
        inquiry_text: "チャットで問い合わせ",
        show_estimate: "yes",
        show_inquiry: "yes",
        show_phone: "yes",
      },
      certification_image_url: "",
      certifications_images: [],
      hero_images: [],
    };
  }

  function pickImageUrl(raw) {
    if (!raw) return "";
    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "object") {
      return pickStr(raw.image_url, raw.url, raw.image, raw.src);
    }
    return "";
  }

  function normalizeCta(raw, legacyFs) {
    const fs = legacyFs || {};
    const yes = (v, def) => {
      if (v === false || v === "no" || v === "0") return false;
      if (v === true || v === "yes" || v === "1") return true;
      if (v == null || v === "") return def;
      const s = String(v).trim().toLowerCase();
      if (s === "no" || s === "false" || s === "0" || s === "非表示") return false;
      return s === "yes" || s === "true" || s === "1" || s === "表示";
    };
    return {
      estimate_enabled: yes(raw?.estimate_enabled, yes(fs.show_estimate, true)),
      inquiry_enabled: yes(raw?.inquiry_enabled, yes(fs.show_inquiry, true)),
      phone_enabled: yes(raw?.phone_enabled, yes(fs.show_phone, true)),
      ai_enabled: yes(raw?.ai_enabled, yes(fs.show_ai_consult, true)),
      estimate_text: pickStr(raw?.estimate_text, "見積もりを依頼する"),
      inquiry_text: pickStr(raw?.inquiry_text, "チャットで問い合わせ"),
      show_estimate: yes(raw?.estimate_enabled, yes(fs.show_estimate, true)) ? "yes" : "",
      show_inquiry: yes(raw?.inquiry_enabled, yes(fs.show_inquiry, true)) ? "yes" : "",
      show_phone: yes(raw?.phone_enabled, yes(fs.show_phone, true)) ? "yes" : "",
    };
  }

  function normalizeBusinessService(input, listing) {
    const base = emptyBusinessService();
    const raw = input && typeof input === "object" ? input : {};
    const legacyFs =
      listing?.form_data?.category_extra?.field_service ||
      listing?.category_extra?.field_service ||
      {};

    const bs = {
      ...base,
      ...raw,
      hero: { ...base.hero, ...(raw.hero || {}) },
      overview: { ...base.overview, ...(raw.overview || {}) },
      company_info: { ...base.company_info, ...(raw.company_info || {}) },
      area_info: { ...base.area_info, ...(raw.area_info || {}) },
      ad_options: { ...(raw.ad_options || {}) },
      review_settings: { ...base.review_settings, ...(raw.review_settings || {}) },
    };

    bs.hero.phone = "";
    bs.hero.contact_method = "";
    bs.hero.contact_methods = [];

    const normalizeContactMethods = (heroRaw) => {
      const list =
        Array.isArray(heroRaw?.contact_methods) ? heroRaw.contact_methods : [];
      const cleaned = list
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .slice(0, 10);
      if (cleaned.length) return cleaned;
      const legacy = String(heroRaw?.contact_method || "").trim();
      if (!legacy) return [];
      const parts = legacy
        .split(/[、,\/・\s]+/g)
        .map((s) => s.trim())
        .filter(Boolean);
      const allowed = new Set([
        "電話",
        "メール",
        "チャット",
        "LINE",
        "Zoom",
        "Google Meet",
        "現地相談",
        "その他",
      ]);
      const out = [];
      parts.forEach((p) => {
        if (allowed.has(p) && !out.includes(p)) out.push(p);
      });
      return out.slice(0, 10);
    };
    bs.hero.contact_methods = normalizeContactMethods(bs.hero);
    bs.hero.contact_method = bs.hero.contact_methods.join("・");

    bs.badges = normalizeBadges(raw.badges ?? raw.hero_badges ?? legacyFs.hero_badges);
    bs.menu_items = (Array.isArray(raw.menu_items) ? raw.menu_items : [])
      .map(normalizeMenuItem)
      .filter(Boolean);
    if (!bs.menu_items.length && listing) {
      const menuRaw =
        listing.service_menu_items ||
        listing.form_data?.service_menu_items ||
        legacyFs.service_menu_items ||
        [];
      bs.menu_items = (Array.isArray(menuRaw) ? menuRaw : [])
        .map(normalizeMenuItem)
        .filter(Boolean);
    }
    bs.work_cases = (Array.isArray(raw.work_cases) ? raw.work_cases : [])
      .map(normalizeWorkCase)
      .filter(Boolean);
    bs.flow_steps = Array.isArray(raw.flow_steps) ? raw.flow_steps : [];
    bs.certifications = (Array.isArray(raw.certifications) ? raw.certifications : [])
      .map((c) => ({
        label: pickStr(c?.label),
        value: pickStr(c?.value),
        image_url: pickImageUrl(c),
      }))
      .filter((c) => c.label || c.value);
    bs.certification_image_url = pickImageUrl(
      raw.certification_image_url,
      raw.license_cert_image_url,
      legacyFs.certification_image_url,
      legacyFs.license_cert_image_url
    );
    bs.certifications_images = collectCertificationImages(raw, listing);
    bs.certification_image_url =
      bs.certifications_images[0]?.image_url || bs.certification_image_url;
    bs.documents = (Array.isArray(raw.documents) ? raw.documents : []).map((d) => ({
      name: pickStr(d?.name),
      url: pickStr(d?.url),
      image_url: pickImageUrl(d),
    }));
    if (!bs.documents.length && (legacyFs.materials_name || legacyFs.materials_url)) {
      bs.documents = [
        {
          name: pickStr(legacyFs.materials_name),
          url: pickStr(legacyFs.materials_url),
          image_url: "",
        },
      ];
    }
    bs.hero_images = (Array.isArray(raw.hero_images) ? raw.hero_images : [])
      .map(pickImageUrl)
      .filter(Boolean);
    bs.cta = normalizeCta(raw.cta, legacyFs);
    bs.overview.kpis = normalizeOverviewKpis(bs.overview.kpis);
    bs.area_info.map_url = pickStr(
      bs.area_info.map_url,
      raw.map_url,
      legacyFs.map_url,
      listing?.google_map_url
    );
    bs.area_info.map_embed_url = pickStr(
      bs.area_info.map_embed_url,
      raw.map_embed_url,
      raw.area_info?.map_embed_url,
      legacyFs.map_embed_url
    );
    return bs;
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeMenuItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const title = pickStr(raw.title, raw.name);
    const description = pickStr(raw.description, raw.work_description, raw.detail);
    const scope = pickStr(raw.scope, raw.location, raw.service_location);
    const price = pickStr(raw.price, raw.amount);
    const notes = pickStr(raw.notes, raw.note, raw.remark);
    const image_url = pickStr(raw.image_url, raw.image);
    if (!title && !description && !scope && !price && !notes) return null;
    return { title, description, scope, price, notes, image_url };
  }

  function normalizeOverviewKpis(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list
      .map((item) => ({
        label: pickStr(item?.label, item?.name),
        value: pickStr(item?.value),
      }))
      .filter((item) => item.label && item.value)
      .slice(0, 4);
  }

  function normalizeWorkCase(raw) {
    if (!raw || typeof raw !== "object") return null;
    const title = pickStr(raw.title, raw.name);
    const description = pickStr(
      raw.description,
      raw.content,
      raw.service,
      raw.category
    );
    const outcome = pickStr(raw.outcome, raw.result, raw.note, raw.notes);
    const region = pickStr(raw.region, raw.area);
    const period = pickStr(raw.period, raw.duration);
    const price = pickStr(raw.price, raw.cost);
    const image_url = pickStr(raw.image_url, raw.image);
    if (!title && !description && !outcome && !region && !period && !price && !image_url) {
      return null;
    }
    return { title, description, outcome, region, period, price, image_url };
  }

  function normalizeBadges(raw) {
    if (Array.isArray(raw)) {
      return raw.map((b) => String(b || "").trim()).filter(Boolean).slice(0, 12);
    }
    if (raw && typeof raw === "object") {
      const labelByKey = {
        estimate_free: "見積無料",
        consult_free: "相談無料",
        online: "オンライン対応",
        corporate: "法人契約対応",
        confidential: "秘密厳守",
        aftercare: "アフターサポート",
        same_day: "即日相談",
        nationwide: "全国対応",
        remote: "リモート対応",
      };
      return Object.entries(raw)
        .filter(([, v]) => v === true || v === "yes" || v === "1")
        .map(([k]) => labelByKey[k] || k)
        .filter(Boolean);
    }
    return [];
  }

  function migrateLegacyBusinessService(listing) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const extra = listing?.category_extra || fd.category_extra || {};
    const fs = extra.field_service && typeof extra.field_service === "object" ? extra.field_service : {};
    const bs = normalizeBusinessService({}, listing);

    bs.hero.catch_copy = pickStr(listing.catch_copy, fs.catch_copy);
    bs.hero.service_description = pickStr(
      listing.description,
      fs.service_description,
      fd.service_description
    );
    bs.hero.business_hours = pickStr(listing.business_hours, fs.service_hours);
    bs.hero.service_area_summary = pickStr(
      listing.service_area,
      fs.visit_area,
      fs.primary_service_area
    );

    bs.badges = normalizeBadges(fs.hero_badges);
    bs.overview.text = pickStr(fs.overview_text);
    bs.overview.features = Array.isArray(fs.overview_features)
      ? fs.overview_features.map((f) => String(f || "").trim()).filter(Boolean)
      : [];
    bs.overview.kpis = normalizeOverviewKpis(
      fs.overview_kpis || fd.business_service?.overview?.kpis
    );

    const menuRaw =
      listing.service_menu_items ||
      fd.service_menu_items ||
      fd.business_service?.menu_items ||
      [];
    bs.menu_items = (Array.isArray(menuRaw) ? menuRaw : [])
      .map(normalizeMenuItem)
      .filter(Boolean);

    const casesRaw = listing.work_cases || fd.work_cases || fd.business_service?.work_cases || [];
    bs.work_cases = (Array.isArray(casesRaw) ? casesRaw : [])
      .map((item) =>
        normalizeWorkCase({
          ...item,
          description: item.description || item.content || item.category,
          outcome: item.outcome || item.note,
        })
      )
      .filter(Boolean);

    bs.company_info = {
      company_name: pickStr(listing.company_name, fs.company_name),
      representative: pickStr(fs.representative, listing.representative),
      postal_code: pickStr(fs.postal_code),
      address: pickStr(fs.address),
      established_year: pickStr(fs.established_year, listing.established_year, listing.established),
      business_content: pickStr(fs.business_content),
      website_url: pickStr(fs.website_url, listing.hp_url),
      invoice_number: pickStr(fs.invoice_number, listing.invoice_number),
      sns_url: pickStr(fs.sns_url),
      phone: pickStr(listing.phone),
      business_hours: pickStr(listing.business_hours, fs.service_hours),
    };

    bs.area_info = {
      primary: pickStr(fs.primary_service_area, fs.visit_area, listing.service_area),
      secondary: pickStr(fs.secondary_service_area),
      online_support: pickStr(fs.online_support),
      visit_support: pickStr(fs.visit_support),
      map_url: pickStr(fs.map_url, listing.google_map_url),
      map_embed_url: pickStr(fs.map_embed_url),
    };

    bs.flow_steps = Array.isArray(fs.flow_steps) ? fs.flow_steps : [];
    bs.certifications = Array.isArray(fs.license_items)
      ? fs.license_items
      : Array.isArray(fs.certifications)
        ? fs.certifications
        : [];
    bs.certification_image_url = pickStr(
      fs.certification_image_url,
      fs.license_cert_image_url
    );
    bs.certifications_images = collectCertificationImages(fs, listing);

    const docName = pickStr(fs.materials_name);
    const docUrl = pickStr(fs.materials_url, listing.hp_url);
    if (docName || docUrl) bs.documents = [{ name: docName, url: docUrl, image_url: "" }];

    bs.cta = normalizeCta({}, fs);

    return normalizeBusinessService(bs, listing);
  }

  function hasStoredBusinessService(fd) {
    return fd?.business_service && typeof fd.business_service === "object";
  }

  /** 優先: business_service → field_service マイグレーション → 空 */
  function getBusinessService(listing) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    if (hasStoredBusinessService(fd)) {
      return normalizeBusinessService(fd.business_service, listing);
    }
    return migrateLegacyBusinessService(listing);
  }

  function collectBusinessServiceFromForm(form, core = {}) {
    const bs = emptyBusinessService();

    const contact_methods = Array.from(
      new Set(
        Array.from(form.querySelectorAll("[data-fs-contact-method]:checked")).map((el) =>
          String(el.value || "").trim()
        )
      )
    )
      .filter(Boolean)
      .slice(0, 10);

    bs.hero = {
      catch_copy: form.querySelector("#fsCatchCopy")?.value?.trim() ?? "",
      service_description:
        form.querySelector("#bizExtraFieldServiceDesc")?.value?.trim() ?? "",
      phone: form.querySelector("#fsHeroPhone")?.value?.trim() ?? "",
      business_hours: form.querySelector("#fsHeroHours")?.value?.trim() ?? "",
      service_area_summary: form.querySelector("#fsHeroAreaSummary")?.value?.trim() ?? "",
      contact_methods,
      contact_method: contact_methods.join("・"),
    };

    bs.badges = [];
    const badgeSeen = new Set();
    const pushBadge = (label) => {
      const t = String(label || "").trim();
      if (!t || badgeSeen.has(t)) return;
      badgeSeen.add(t);
      bs.badges.push(t);
    };
    form
      .querySelectorAll(
        "[data-fs-feature-preset]:checked, [data-fs-badge-preset]:checked"
      )
      .forEach((el) => pushBadge(el.value));
    form
      .querySelectorAll("[data-fs-feature-custom-label], [data-fs-badge-label]")
      .forEach((el) => pushBadge(el.value));

    bs.overview.text = form.querySelector("#fsOverviewText")?.value?.trim() ?? "";
    bs.overview.features = [...bs.badges];
    if (window.TasuPostFieldServiceForm?.collectOverviewKpis) {
      bs.overview.kpis = window.TasuPostFieldServiceForm.collectOverviewKpis(form);
    } else {
      bs.overview.kpis = normalizeOverviewKpis(bs.overview.kpis);
    }

    bs.menu_items = (Array.isArray(core.service_menu_items) ? core.service_menu_items : [])
      .map(normalizeMenuItem)
      .filter(Boolean);
    if (!bs.menu_items.length && window.TasuPostFieldServiceForm?.collectMenuItems) {
      bs.menu_items = window.TasuPostFieldServiceForm.collectMenuItems(form);
    }
    bs.work_cases = (Array.isArray(core.work_cases) ? core.work_cases : [])
      .map((item) => normalizeWorkCase(item))
      .filter(Boolean);
    if (!bs.work_cases.length && window.TasuPostFieldServiceForm?.collectWorkCases) {
      bs.work_cases = window.TasuPostFieldServiceForm.collectWorkCases(form);
    }

    bs.company_info = {
      company_name: form.querySelector("#bizCompanyName")?.value?.trim() ?? "",
      representative: form.querySelector("#fsRepresentative")?.value?.trim() ?? "",
      postal_code: form.querySelector("#fsPostalCode")?.value?.trim() ?? "",
      address: form.querySelector("#fsAddress")?.value?.trim() ?? "",
      established_year: form.querySelector("#fsEstablished")?.value?.trim() ?? "",
      business_content: form.querySelector("#fsBusinessContent")?.value?.trim() ?? "",
      website_url: form.querySelector("#fsWebsiteUrl")?.value?.trim() ?? "",
      invoice_number: form.querySelector("#fsInvoiceNumber")?.value?.trim() ?? "",
      sns_url: form.querySelector("#fsSnsUrl")?.value?.trim() ?? "",
      phone: form.querySelector("#fsCompanyPhone")?.value?.trim() ?? "",
      business_hours: form.querySelector("#fsCompanyHours")?.value?.trim() ?? "",
    };

    bs.area_info = {
      primary: form.querySelector("#fsPrimaryArea")?.value?.trim() ?? "",
      secondary: form.querySelector("#fsSecondaryArea")?.value?.trim() ?? "",
      online_support: form.querySelector("#fsOnlineSupport")?.value?.trim() ?? "",
      visit_support: form.querySelector("#fsVisitSupport")?.value?.trim() ?? "",
      map_url: form.querySelector("#fsMapUrl")?.value?.trim() ?? "",
    };

    bs.flow_steps = [];
    form.querySelectorAll("[data-fs-flow-step-row]").forEach((row) => {
      const title = row.querySelector("[data-fs-flow-title]")?.value?.trim() ?? "";
      const desc = row.querySelector("[data-fs-flow-desc]")?.value?.trim() ?? "";
      if (!title && !desc) return;
      bs.flow_steps.push({ title, desc });
    });

    bs.certifications = [];
    form.querySelectorAll("[data-fs-cert-row]").forEach((row) => {
      const label = row.querySelector("[data-fs-cert-label]")?.value?.trim() ?? "";
      const value = row.querySelector("[data-fs-cert-value]")?.value?.trim() ?? "";
      if (!label && !value) return;
      bs.certifications.push({ label, value });
    });
    const certUrls = Array.from(form.querySelectorAll("[data-fs-cert-image-url]"))
      .map((el) => String(el.value || "").trim())
      .filter(Boolean);
    const certUniq = [];
    const seen = new Set();
    certUrls.forEach((u) => {
      if (seen.has(u)) return;
      seen.add(u);
      certUniq.push(u);
    });
    bs.certifications_images = collectCertificationImages({
      certifications_images: certUniq.map((image_url) => ({ image_url })),
      certification_image_url: form.querySelector("#fsLicenseCertUrl")?.value?.trim() ?? "",
    });
    bs.certification_image_url = bs.certifications_images[0]?.image_url || "";

    const docName = form.querySelector("#fsMaterialsName")?.value?.trim() ?? "";
    const docUrl = form.querySelector("#fsMaterialsUrl")?.value?.trim() ?? "";
    const docImage =
      form.querySelector("#fsDocImageUrl")?.value?.trim() ??
      form.querySelector("[data-fs-doc-image-url]")?.value?.trim() ??
      "";
    bs.documents =
      docName || docUrl || docImage ? [{ name: docName, url: docUrl, image_url: docImage }] : [];

    bs.review_settings = { use_demo: true };

    const ad = window.TasuPostFieldServiceForm?.readAdOptions?.(form) || {};
    bs.ad_options = {
      pr_plan: ad.pr_plan || core.pr_plan || "none",
      featured_plan: ad.featured_plan || core.featured_plan || "none",
      pr_payment_url: ad.pr_payment_url || core.pr_payment_url || "",
      pr_bank_info: ad.pr_bank_info || core.pr_bank_info || "",
      featured_payment_url: ad.featured_payment_url || core.featured_payment_url || "",
      featured_bank_info: ad.featured_bank_info || core.featured_bank_info || "",
    };

    bs.cta = {
      estimate_enabled: form.querySelector("[data-fs-show-estimate-chk]")?.checked !== false,
      inquiry_enabled: form.querySelector("[data-fs-show-inquiry-chk]")?.checked !== false,
      phone_enabled: form.querySelector("[data-fs-show-phone-btn-chk]")?.checked !== false,
      ai_enabled: form.querySelector("[data-fs-show-ai-chk]")?.checked !== false,
      estimate_text: form.querySelector("#fsCtaEstimateText")?.value?.trim() || "見積もりを依頼する",
      inquiry_text: form.querySelector("#fsCtaInquiryText")?.value?.trim() || "チャットで問い合わせ",
      show_estimate: form.querySelector("[data-fs-show-estimate-chk]")?.checked ? "yes" : "",
      show_inquiry: form.querySelector("[data-fs-show-inquiry-chk]")?.checked ? "yes" : "",
      show_phone: form.querySelector("[data-fs-show-phone-btn-chk]")?.checked ? "yes" : "",
    };

    return buildListingPayloadFromBusinessService(bs, core);
  }

  function buildListingPayloadFromBusinessService(bs, core) {
    const description =
      pickStr(bs.hero.service_description, bs.overview.text) || core.description || "";
    const phone =
      pickStr(bs.hero.phone, bs.company_info.phone, core.phone) || "";
    const businessHours =
      pickStr(bs.hero.business_hours, bs.company_info.business_hours) || core.business_hours || "";
    const serviceArea =
      pickStr(bs.hero.service_area_summary, bs.area_info.primary, core.service_area) || "";
    const hpUrl =
      pickStr(bs.documents[0]?.url, bs.company_info.website_url) || core.hp_url || "";

    const menuItems = bs.menu_items.map((item) => ({
      title: item.title,
      description: item.description,
      scope: item.scope || "",
      price: item.price,
      notes: item.notes,
      image_url: item.image_url || "",
    }));

    const workCases = bs.work_cases.map((item) => ({
      title: item.title,
      description: item.description,
      outcome: item.outcome,
      region: item.region,
      period: item.period,
      price: item.price,
      image_url: item.image_url,
    }));

    const ad = bs.ad_options || {};

    const fieldServiceLegacy = {
      catch_copy: bs.hero.catch_copy,
      service_description: bs.hero.service_description,
      service_hours: bs.hero.business_hours,
      visit_area: bs.hero.service_area_summary,
      contact_method: bs.hero.contact_method,
      contact_methods: Array.isArray(bs.hero.contact_methods) ? bs.hero.contact_methods : [],
      hero_badges: bs.badges,
      overview_text: bs.overview.text,
      overview_features: bs.overview.features,
      overview_kpis: bs.overview.kpis,
      license_items: bs.certifications,
      license_cert_image_url: bs.certification_image_url,
      certifications_images: Array.isArray(bs.certifications_images) ? bs.certifications_images : [],
      flow_steps: bs.flow_steps,
      representative: bs.company_info.representative,
      postal_code: bs.company_info.postal_code,
      address: bs.company_info.address,
      established_year: bs.company_info.established_year,
      business_content: bs.company_info.business_content,
      website_url: bs.company_info.website_url,
      invoice_number: bs.company_info.invoice_number,
      sns_url: bs.company_info.sns_url,
      primary_service_area: bs.area_info.primary,
      secondary_service_area: bs.area_info.secondary,
      online_support: bs.area_info.online_support,
      visit_support: bs.area_info.visit_support,
      materials_name: bs.documents[0]?.name || "",
      materials_url: bs.documents[0]?.url || "",
      show_estimate: bs.cta.show_estimate,
      show_inquiry: bs.cta.show_inquiry,
      show_phone: bs.cta.show_phone,
    };

    return {
      ...core,
      company_name: pickStr(bs.company_info.company_name, core.company_name),
      title: core.title || "",
      catch_copy: bs.hero.catch_copy,
      description,
      phone,
      business_hours: businessHours,
      service_area: serviceArea,
      hp_url: hpUrl,
      google_map_url: bs.area_info.map_url || null,
      license_info: core.license_info || "",
      service_menu_items: menuItems,
      work_cases: workCases,
      pr_plan: ad.pr_plan || core.pr_plan || "none",
      featured_plan: ad.featured_plan || core.featured_plan || "none",
      pr_payment_url: ad.pr_payment_url || "",
      pr_bank_info: ad.pr_bank_info || "",
      featured_payment_url: ad.featured_payment_url || "",
      featured_bank_info: ad.featured_bank_info || "",
      form_data: {
        ...(core.form_data || {}),
        business_service: sanitizeBusinessServiceForStorage(bs),
        service_menu_items: menuItems,
        work_cases: workCases,
        contact_method: bs.hero.contact_method,
        category_extra: {
          ...(core.form_data?.category_extra || {}),
          field_service: fieldServiceLegacy,
        },
      },
    };
  }

  function sanitizeBusinessServiceForStorage(bs) {
    const out = normalizeBusinessService(bs, null);
    if (Array.isArray(out.certifications)) {
      out.certifications = out.certifications.map((c) => ({
        label: c.label,
        value: c.value,
        image_url: pickImageUrl(c),
      }));
    }
    return out;
  }

  /** 編集画面へ business_service を完全復元 */
  function applyBusinessServiceListingToForm(form, listing, hooks) {
    if (!form || !listing) return;
    const bs = getBusinessService(listing);
    const h = hooks || {};

    const set = (sel, val) => {
      const el = form.querySelector(sel);
      if (el && val != null) el.value = String(val);
    };

    set("#bizCompanyName", listing.company_name || bs.company_info.company_name);
    set("#listingTitle", listing.title);
    set("#fsCatchCopy", bs.hero.catch_copy || listing.catch_copy);
    set("#bizExtraFieldServiceDesc", bs.hero.service_description || listing.description);
    set("#listingDescription", listing.description);
    set("#fsHeroHours", bs.hero.business_hours || listing.business_hours);
    set("#fsHeroAreaSummary", bs.hero.service_area_summary || listing.service_area);
    set("#fsHeroPhone", bs.hero.phone || listing.phone);
    const picked = new Set(Array.isArray(bs.hero.contact_methods) ? bs.hero.contact_methods : []);
    form.querySelectorAll("[data-fs-contact-method]").forEach((el) => {
      el.checked = picked.has(el.value);
    });
    set("#bizPhone", bs.company_info.phone || listing.phone);
    set("#bizBusinessHours", bs.company_info.business_hours);
    set("#bizServiceArea", bs.area_info.primary || listing.service_area);
    set("#bizGoogleMapUrl", bs.area_info.map_url || listing.google_map_url);
    set("#bizHpUrl", bs.company_info.website_url || listing.hp_url);
    set("#bizLicenseInfo", listing.license_info);

    window.TasuPostFieldServiceForm?.applyBusinessServiceToForm?.(form, bs);

    if (h.fillMenuItems) h.fillMenuItems(bs.menu_items || []);
    else if (window.TasuPostBusinessServiceApply?.fillMenuItems) {
      window.TasuPostBusinessServiceApply.fillMenuItems(form, bs.menu_items || []);
    }

    if (h.fillWorkCases) h.fillWorkCases(bs.work_cases || []);
    else if (window.TasuPostBusinessServiceApply?.fillWorkCases) {
      window.TasuPostBusinessServiceApply.fillWorkCases(form, bs.work_cases || [], listing.business_category);
    }

    const ad = bs.ad_options || {};
    const pickPlan = (name, val) => {
      const v = String(val || "none").trim();
      form.querySelectorAll(`[name="${name}"]`).forEach((el) => {
        if (el instanceof HTMLInputElement) el.checked = el.value === v;
      });
    };
    pickPlan("bizPrPlan", ad.pr_plan || listing.pr_plan);
    pickPlan("bizFeaturedPlan", ad.featured_plan || listing.featured_plan);
    set("#bizPrPaymentUrl", ad.pr_payment_url || listing.pr_payment_url);
    set("#bizPrBankInfo", ad.pr_bank_info || listing.pr_bank_info);
    set("#bizFeaturedPaymentUrl", ad.featured_payment_url || listing.featured_payment_url);
    set("#bizFeaturedBankInfo", ad.featured_bank_info || listing.featured_bank_info);

    const cta = bs.cta || {};
    const chk = (sel, on) => {
      const el = form.querySelector(sel);
      if (el) el.checked = on !== false;
    };
    chk("[data-fs-show-estimate-chk]", cta.estimate_enabled);
    chk("[data-fs-show-inquiry-chk]", cta.inquiry_enabled);
    chk("[data-fs-show-phone-btn-chk]", cta.phone_enabled);
    chk("[data-fs-show-ai-chk]", cta.ai_enabled);
    set("#fsCtaEstimateText", cta.estimate_text);
    set("#fsCtaInquiryText", cta.inquiry_text);

    form.dataset.loadedBusinessService = "1";
  }

  function pickCertImageArray(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    const out = [];
    const seen = new Set();
    arr.forEach((item) => {
      const image_url = pickImageUrl(item?.image_url ?? item);
      if (!image_url || seen.has(image_url)) return;
      seen.add(image_url);
      out.push({ image_url });
    });
    return out.length ? out.slice(0, 5) : null;
  }

  function pickCertImageUrl(...urls) {
    const image_url = pickImageUrl(...urls);
    return image_url ? [{ image_url }] : null;
  }

  function getFieldServiceExtra(listing) {
    return (
      listing?.category_extra?.field_service ||
      listing?.form_data?.category_extra?.field_service ||
      {}
    );
  }

  /**
   * 資格証画像（優先順で最初に見つかったソースを採用、最大5枚）
   * 1. certifications_images[] 2. certification_images[]
   * 3. certification_image_url 4. field_service.certifications_images[]
   * 5. field_service.certification_image_url / license_cert_image_url
   */
  function collectCertificationImages(bs, listing) {
    const src = bs && typeof bs === "object" ? bs : {};
    const legacyFs = getFieldServiceExtra(listing);

    return (
      pickCertImageArray(src.certifications_images) ||
      pickCertImageArray(src.certification_images) ||
      pickCertImageUrl(src.certification_image_url, src.license_cert_image_url) ||
      pickCertImageArray(legacyFs.certifications_images) ||
      pickCertImageUrl(
        legacyFs.certification_image_url,
        legacyFs.license_cert_image_url
      ) ||
      []
    );
  }

  function hasMenuItems(bs) {
    return Array.isArray(bs.menu_items) && bs.menu_items.length > 0;
  }
  function hasWorkCases(bs) {
    return Array.isArray(bs.work_cases) && bs.work_cases.length > 0;
  }
  function hasCertifications(bs, listing) {
    const certList = Array.isArray(bs?.certifications) ? bs.certifications : [];
    const hasCertList = certList.some((c) => pickStr(c?.label, c?.value));
    const certImages = collectCertificationImages(bs, listing);
    return hasCertList || certImages.length > 0;
  }
  function hasFlowSteps(bs) {
    return Array.isArray(bs.flow_steps) && bs.flow_steps.length > 0;
  }
  function hasDocuments(bs) {
    return (
      Array.isArray(bs.documents) &&
      bs.documents.some((d) => pickStr(d?.name, d?.url))
    );
  }
  function toGoogleMapsEmbedUrl(rawUrl) {
    const input = String(rawUrl || "").trim();
    if (!input) return "";
    if (/\/maps\/embed/i.test(input)) return input;

    try {
      const absolute = /^https?:\/\//i.test(input) ? input : `https://${input}`;
      const u = new URL(absolute);
      const host = u.hostname.replace(/^www\./, "").toLowerCase();

      if (host === "maps.google.com" && u.searchParams.has("q")) {
        const q = u.searchParams.get("q");
        return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
      }

      if (
        (host === "google.com" || host.endsWith(".google.com") || host === "maps.google.com") &&
        (/\/maps/i.test(u.pathname) || u.searchParams.has("q"))
      ) {
        const out = new URL(absolute);
        if (host === "maps.google.com" && (out.pathname === "/" || out.pathname === "")) {
          out.pathname = "/maps";
        }
        if (!out.searchParams.has("output")) {
          out.searchParams.set("output", "embed");
        }
        return out.toString();
      }
    } catch (_) {
      /* fall through */
    }

    if (/google\.(com|co\.jp)/i.test(input) || /maps\.google\./i.test(input)) {
      if (/output=embed/i.test(input)) return input;
      return input.includes("?") ? `${input}&output=embed` : `${input}?output=embed`;
    }

    return input;
  }

  function resolveAreaMapUrl(bs, listing) {
    const a = bs?.area_info && typeof bs.area_info === "object" ? bs.area_info : {};
    const legacyFs = getFieldServiceExtra(listing);
    return pickStr(
      a.map_embed_url,
      a.map_url,
      bs?.map_embed_url,
      bs?.map_url,
      listing?.map_embed_url,
      listing?.map_url,
      listing?.google_map_url,
      legacyFs.map_embed_url,
      legacyFs.map_url
    );
  }

  function hasAreaInfo(bs, listing) {
    const a = bs.area_info || {};
    return Boolean(
      pickStr(a.primary, a.secondary, a.map_url, a.map_embed_url, resolveAreaMapUrl(bs, listing)) ||
        a.online_support === "yes" ||
        a.visit_support === "yes"
    );
  }
  function hasOverview(bs) {
    return Boolean(
      pickStr(bs.overview?.text) ||
        (bs.overview?.features || []).length ||
        (bs.overview?.kpis || []).length
    );
  }
  function hasCompanyInfo(bs) {
    const c = bs.company_info || {};
    return Boolean(
      pickStr(
        c.company_name,
        c.representative,
        c.address,
        c.business_content,
        c.website_url
      )
    );
  }

  window.TasuBusinessServiceData = {
    BADGE_PRESETS,
    emptyBusinessService,
    getBusinessService,
    normalizeBusinessService,
    collectBusinessServiceFromForm,
    applyBusinessServiceListingToForm,
    buildListingPayloadFromBusinessService,
    migrateLegacyBusinessService,
    normalizeMenuItem,
    normalizeWorkCase,
    pickImageUrl,
    collectCertificationImages,
    toGoogleMapsEmbedUrl,
    resolveAreaMapUrl,
    normalizeCta,
    hasMenuItems,
    hasWorkCases,
    hasCertifications,
    hasFlowSteps,
    hasDocuments,
    hasAreaInfo,
    hasOverview,
    hasCompanyInfo,
  };
})();
