/**
 * job 掲載フィールド解決（listings 直下優先 + form_data fallback）
 */
(function () {
  "use strict";

  const SALARY_TYPE_LABELS = {
    hourly: "時給",
    daily: "日給",
    monthly: "月給",
    yearly: "年俸",
    project: "プロジェクト",
  };

  function parseFormData(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      let parsed = JSON.parse(raw);
      while (typeof parsed === "string" && parsed.trim()) {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          break;
        }
      }
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  function safeStr(value, fallback) {
    if (value == null) return fallback ?? "";
    const text = String(value).trim();
    if (!text || text === "undefined" || text === "null") return fallback ?? "";
    return text;
  }

  function pickFormValue(formData, keys) {
    if (!formData || typeof formData !== "object") return "";
    for (let i = 0; i < keys.length; i += 1) {
      const value = formData[keys[i]];
      if (value == null || value === "") continue;
      if (typeof value === "number" && !Number.isNaN(value)) {
        return String(value);
      }
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  }

  function pickListingValue(listing, formData, listingKeys, formKeys) {
    const fd = formData || {};
    const keys = listingKeys || [];
    for (let i = 0; i < keys.length; i += 1) {
      const value = listing?.[keys[i]];
      if (value == null || value === "") continue;
      if (typeof value === "number" && !Number.isNaN(value)) {
        return String(value);
      }
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return pickFormValue(fd, formKeys || listingKeys);
  }

  function coerceTagArray(raw) {
    if (Array.isArray(raw)) {
      return raw.map((t) => safeStr(t, "")).filter(Boolean);
    }
    if (typeof raw === "string" && raw.trim()) {
      return raw
        .split(/[,、]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return [];
  }

  function normalizeUrl(url) {
    if (!url) return "";
    if (window.TasuListingImages?.normalizeImageUrl) {
      return window.TasuListingImages.normalizeImageUrl(url) || "";
    }
    return String(url).trim();
  }

  function normalizeCategoryValue(value) {
    if (value == null || value === "") return "";
    if (typeof value === "string") {
      const text = value.trim();
      if (!text || text === "[object Object]") return "";
      return text;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      return safeStr(
        value.label || value.name || value.value || value.category || value.subcategory,
        ""
      );
    }
    const text = String(value).trim();
    return text === "[object Object]" ? "" : text;
  }

  function coerceGalleryUrls(listing, formData) {
    const Images = window.TasuListingImages;
    const fd = formData || {};
    const merged = [];
    const seen = new Set();

    const add = (url) => {
      const resolved = normalizeUrl(url);
      if (!resolved || seen.has(resolved)) return;
      seen.add(resolved);
      merged.push(resolved);
    };

    const listingGallery = listing?.gallery_urls ?? listing?.galleryUrls;
    const listingImages = listing?.images;

    if (Images?.coerceImageUrlList) {
      Images.coerceImageUrlList(listingGallery).forEach(add);
      Images.coerceImageUrlList(listingImages).forEach(add);
      Images.coerceImageUrlList(fd.gallery_urls ?? fd.galleryUrls).forEach(add);
      Images.coerceImageUrlList(fd.images).forEach(add);
      return merged;
    }

    [listingGallery, listingImages, fd.gallery_urls, fd.galleryUrls, fd.images].forEach(
      (raw) => {
        if (Array.isArray(raw)) {
          raw.forEach(add);
        } else if (typeof raw === "string" && raw.trim()) {
          raw
            .split(/[,、\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach(add);
        }
      }
    );

    return merged;
  }

  function resolveJobPrimaryImageUrl(listing, formData) {
    const fd = formData || getFormData(listing);
    const gallery = coerceGalleryUrls(listing, fd);
    const candidates = [
      listing?.image_url,
      listing?.imageUrl,
      listing?.thumbnail_url,
      listing?.thumbnailUrl,
      gallery[0],
      Array.isArray(listing?.images) ? listing.images[0] : null,
      fd.image_url,
      fd.imageUrl,
      fd.thumbnail_url,
      fd.thumbnailUrl,
      fd.main_image_url,
      fd.mainImageUrl,
      Array.isArray(fd.gallery_urls) ? fd.gallery_urls[0] : null,
      Array.isArray(fd.galleryUrls) ? fd.galleryUrls[0] : null,
      Array.isArray(fd.images) ? fd.images[0] : null,
    ];

    for (let i = 0; i < candidates.length; i += 1) {
      const resolved = normalizeUrl(candidates[i]);
      if (resolved) return resolved;
    }
    return "";
  }

  function resolveJobThumbnail(listing, formData, primaryImage) {
    const fd = formData || getFormData(listing);
    const candidates = [
      listing?.thumbnail_url,
      listing?.thumbnailUrl,
      listing?.image_url,
      listing?.imageUrl,
      fd.thumbnail_url,
      fd.thumbnailUrl,
      fd.image_url,
      primaryImage,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const resolved = normalizeUrl(candidates[i]);
      if (resolved) return resolved;
    }
    return primaryImage || "";
  }

  function resolveJobGallery(listing, formData, primaryImage) {
    const gallery = coerceGalleryUrls(listing, formData || getFormData(listing));
    if (!primaryImage) return gallery;
    return gallery.filter((url) => url !== primaryImage);
  }

  function resolveJobCategory(listing, formData) {
    const fd = formData || getFormData(listing);
    let category = normalizeCategoryValue(listing?.category);
    if (category) return category;
    category = normalizeCategoryValue(fd.category);
    if (category) return category;
    if (fd.category && typeof fd.category === "object" && !Array.isArray(fd.category)) {
      return normalizeCategoryValue(fd.category.category || fd.category.productCategory);
    }
    return normalizeCategoryValue(fd.jobCategory);
  }

  function resolveJobSubcategory(listing, formData) {
    const fd = formData || getFormData(listing);
    let subcategory = normalizeCategoryValue(listing?.subcategory);
    if (subcategory) return subcategory;
    subcategory = normalizeCategoryValue(fd.subcategory || fd.subCategory);
    if (subcategory) return subcategory;
    if (fd.category && typeof fd.category === "object" && !Array.isArray(fd.category)) {
      return normalizeCategoryValue(fd.category.subCategory || fd.category.subcategory);
    }
    return "";
  }

  function formatJobAmountDisplay(num, salaryType) {
    if (!Number.isFinite(num) || num <= 0) return "";
    const type = safeStr(salaryType, "");
    if (/月|monthly/i.test(type) || type === "月給") {
      const man = num / 10000;
      if (man >= 1) {
        const rounded =
          Math.abs(man - Math.round(man)) < 0.05
            ? Math.round(man)
            : Math.round(man * 10) / 10;
        return `月${rounded}万円〜`;
      }
    }
    if (/時|hourly/i.test(type) || type === "時給") {
      return `時給¥${num.toLocaleString("ja-JP")}〜`;
    }
    if (/日|daily/i.test(type) || type === "日給") {
      return `日給¥${num.toLocaleString("ja-JP")}〜`;
    }
    if (/年|yearly/i.test(type) || type === "年俸") {
      const man = num / 10000;
      if (man >= 1) {
        return `年俸${Math.round(man)}万円〜`;
      }
    }
    if (/プロジェクト|案件|project/i.test(type)) {
      return "案件単価制";
    }
    return `¥${num.toLocaleString("ja-JP")}〜`;
  }

  function getFormData(listing) {
    return parseFormData(listing?.form_data);
  }

  function isJobListing(listing) {
    const type = safeStr(listing?.listing_type || listing?.type, "").toLowerCase();
    return type === "job";
  }

  function formatSalaryTypeLabel(raw) {
    const key = safeStr(raw, "").toLowerCase();
    if (!key) return "";
    return SALARY_TYPE_LABELS[key] || raw;
  }

  function resolveJobPrice(listing, formData) {
    const fd = formData || getFormData(listing);
    const salaryFromListing =
      listing?.salary_amount != null && listing.salary_amount !== ""
        ? listing.salary_amount
        : null;
    const priceFromListing =
      listing?.price_amount != null && listing.price_amount !== ""
        ? listing.price_amount
        : null;
    const salaryAmount = pickListingValue(
      listing,
      fd,
      ["salary_amount"],
      ["salary_amount", "salaryAmount", "salary"]
    );
    const priceAmount = pickListingValue(
      listing,
      fd,
      ["price_amount"],
      ["price_amount", "price", "basePrice"]
    );
    const amountRaw =
      salaryFromListing ??
      priceFromListing ??
      (salaryAmount || priceAmount);
    const num = Number(String(amountRaw).replace(/[^\d.]/g, ""));
    const salaryType = formatSalaryTypeLabel(
      pickListingValue(
        listing,
        fd,
        ["salary_type"],
        ["salary_type", "salaryType", "pay_type"]
      )
    );
    let text = "";
    if (Number.isFinite(num) && num > 0) {
      text = formatJobAmountDisplay(num, salaryType);
    } else if (amountRaw && Number(String(amountRaw).replace(/[^\d.]/g, "")) !== 0) {
      text = amountRaw;
    }
    const salaryText = pickListingValue(
      listing,
      fd,
      [],
      ["salary", "salary_text", "salaryText", "compensation"]
    );
    if (!text && salaryText && !/^¥?\s*0/.test(salaryText)) text = salaryText;
    if (!text && salaryType) {
      if (/プロジェクト|案件|project/i.test(salaryType)) {
        text = "案件単価制";
      } else {
        text = salaryType;
      }
    }
    if (!text) text = "応相談";
    return {
      amount: Number.isFinite(num) && num > 0 ? num : null,
      salaryType,
      text,
    };
  }

  function resolveJobApplicationMethod(listing, formData) {
    const fd = formData || getFormData(listing);
    const direct = pickListingValue(
      listing,
      fd,
      ["application_method"],
      ["application_method", "applicationMethod", "how_to_apply"]
    );
    if (direct) return direct;

    const email = pickListingValue(
      listing,
      fd,
      ["contact_email"],
      ["contact_email", "companyEmail"]
    );
    const recruiter = pickListingValue(
      listing,
      fd,
      ["recruiter_name"],
      ["recruiter_name", "companyContact"]
    );
    const phone = pickListingValue(
      listing,
      fd,
      ["phone"],
      ["phone", "companyPhone"]
    );
    const parts = [];
    if (email) parts.push(`メール: ${email}`);
    if (recruiter) parts.push(`担当: ${recruiter}`);
    if (phone) parts.push(`電話: ${phone}`);
    return parts.join(" / ");
  }

  function resolveJobSalaryAmountRaw(listing, formData) {
    const fd = formData || getFormData(listing);
    if (listing?.salary_amount != null && listing.salary_amount !== "") {
      return String(listing.salary_amount);
    }
    if (listing?.price_amount != null && listing.price_amount !== "") {
      return String(listing.price_amount);
    }
    return pickListingValue(
      listing,
      fd,
      ["salary_amount"],
      ["salary_amount", "salaryAmount"]
    );
  }

  function resolveJobTags(listing, formData) {
    const fd = formData || getFormData(listing);
    const direct = coerceTagArray(listing?.available_tags);
    if (direct.length) return direct;
    const fromTags = coerceTagArray(listing?.tags);
    if (fromTags.length) return fromTags;
    return coerceTagArray(fd?.available_tags || fd?.tags);
  }

  function formatDeadline(raw) {
    const text = safeStr(raw, "");
    if (!text) return "";
    const dateOnly = text.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      const [y, m, d] = dateOnly.split("-").map(Number);
      try {
        return new Date(y, m - 1, d).toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch {
        return dateOnly;
      }
    }
    return text;
  }

  /**
   * @param {object} listing
   * @returns {object|null}
   */
  /** listings 直下を優先し、無ければ form_data から取得 */
  function jobColumn(listing, fd, columnKey, formKeys) {
    const fromListing = listing?.[columnKey];
    if (fromListing != null && fromListing !== "") {
      if (typeof fromListing === "number" && !Number.isNaN(fromListing)) {
        return String(fromListing);
      }
      if (typeof fromListing === "string" && fromListing.trim()) {
        return fromListing.trim();
      }
    }
    return pickFormValue(fd, formKeys || [columnKey]);
  }

  function normalizeJobListing(listing) {
    if (!listing) return null;

    const fd = getFormData(listing);
    const image = resolveJobPrimaryImageUrl(listing, fd);
    const thumbnail = resolveJobThumbnail(listing, fd, image);
    const gallery = resolveJobGallery(listing, fd, image);

    const price = resolveJobPrice(listing, fd);
    const recruitmentRaw = jobColumn(listing, fd, "recruitment_count", [
      "recruitment_count",
      "recruitmentCount",
      "headcount",
    ]);
    let recruitmentCount = recruitmentRaw;
    const recruitmentNum = Number(recruitmentRaw);
    if (Number.isFinite(recruitmentNum) && recruitmentNum >= 0) {
      recruitmentCount = String(recruitmentNum);
    }

    const applicationRequirements = jobColumn(listing, fd, "required_skills", [
      "required_skills",
      "application_requirements",
      "requiredSkills",
      "requirements",
      "must_have",
    ]);

    return {
      id: listing.id,
      title: safeStr(listing?.title, "") || safeStr(fd?.job_title, "") || "",
      description:
        safeStr(listing?.description, "") ||
        safeStr(fd?.description, "") ||
        safeStr(fd?.job_description, "") ||
        "",
      image,
      thumbnail,
      category: resolveJobCategory(listing, fd),
      subcategory: resolveJobSubcategory(listing, fd),
      gallery,
      location: jobColumn(listing, fd, "job_location", [
        "job_location",
        "location",
        "work_location",
        "workLocation",
      ]),
      workStyle: jobColumn(listing, fd, "work_style", [
        "work_style",
        "workStyle",
        "remote_type",
      ]),
      employmentType: jobColumn(listing, fd, "employment_type", [
        "employment_type",
        "employmentType",
        "employment",
      ]),
      salaryType: jobColumn(listing, fd, "salary_type", ["salary_type", "salaryType"]),
      salaryAmount: resolveJobSalaryAmountRaw(listing, fd),
      salary: jobColumn(listing, fd, "salary_amount", [
        "salary_amount",
        "salaryAmount",
        "salary",
        "salary_text",
      ]),
      price,
      workingHours: jobColumn(listing, fd, "working_hours", [
        "working_hours",
        "workingHours",
        "hours",
        "jobWorkingHours",
      ]),
      applicationRequirements,
      requiredSkills: applicationRequirements,
      welcomeSkills: jobColumn(listing, fd, "welcome_skills", [
        "welcome_skills",
        "welcomeSkills",
        "nice_to_have",
      ]),
      benefits: jobColumn(listing, fd, "job_benefits", [
        "job_benefits",
        "jobBenefits",
        "benefits",
        "welfare",
      ]),
      applicationDeadline: formatDeadline(
        jobColumn(listing, fd, "application_deadline", [
          "application_deadline",
          "applicationDeadline",
          "deadline",
        ])
      ),
      recruitmentCount,
      applicationMethod: resolveJobApplicationMethod(listing, fd),
      contractTerms: jobColumn(listing, fd, "contract_terms", [
        "contract_terms",
        "contractTerms",
        "contract",
      ]),
      contactEmail: jobColumn(listing, fd, "contact_email", [
        "contact_email",
        "companyEmail",
      ]),
      tags: resolveJobTags(listing, fd),
      seller: {
        userId: safeStr(listing?.user_id, ""),
        companyName:
          safeStr(listing?.company_name, "") ||
          pickFormValue(fd, ["company", "companyName"]),
      },
      raw: listing,
    };
  }

  window.TasuJobListingFields = {
    parseFormData,
    isJobListing,
    normalizeJobListing,
    normalizeCategoryValue,
    pickListingValue,
    resolveJobPrice,
    resolveJobTags,
    resolveJobPrimaryImageUrl,
    resolveJobThumbnail,
    resolveJobGallery,
    coerceGalleryUrls,
    resolveJobCategory,
    resolveJobSubcategory,
    formatSalaryTypeLabel,
    formatDeadline,
    formatJobAmountDisplay,
  };
})();
