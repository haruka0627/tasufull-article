/**
 * worker 掲載フィールド解決（listings 直下優先 + form_data fallback）
 */
(function () {
  "use strict";

  const WORKER_DETAIL_EMPTY = "未登録";

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

  function workerColumn(listing, fd, columnKey, formKeys) {
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

  function parseWorkerPriceAmount(raw) {
    if (raw == null || raw === "") return null;
    const direct = Number(raw);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const digits = String(raw).replace(/[^\d]/g, "");
    const parsed = Number(digits);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function formatWorkerPriceDisplay(listing) {
    const fd = parseFormData(listing?.form_data);
    const priceType = workerColumn(listing, fd, "worker_price_type", [
      "worker_price_type",
      "workerPriceType",
      "price_type",
    ]);
    const amountRaw =
      listing?.worker_price_amount ??
      pickFormValue(fd, ["worker_price_amount", "workerPrice", "price"]);
    const amount = parseWorkerPriceAmount(amountRaw);

    if (amount != null) {
      const formatted = amount.toLocaleString("ja-JP");
      if (priceType) return `${priceType} ${formatted}円`;
      return `${formatted}円`;
    }
    if (priceType) return priceType;
    return "";
  }

  function normalizeWorkerListing(listing) {
    if (!listing) return null;
    const fd = parseFormData(listing.form_data);

    return {
      profile: workerColumn(listing, fd, "worker_profile", [
        "worker_profile",
        "workerBio",
        "bio",
      ]),
      services: workerColumn(listing, fd, "worker_services", [
        "worker_services",
        "workerScope",
        "scope",
      ]),
      area: workerColumn(listing, fd, "worker_area", [
        "worker_area",
        "service_area",
        "serviceArea",
      ]),
      availability: workerColumn(listing, fd, "worker_availability", [
        "worker_availability",
        "workerHours",
        "work_hours",
      ]),
      experience: workerColumn(listing, fd, "worker_experience", [
        "worker_experience",
        "experience",
      ]),
      certifications: workerColumn(listing, fd, "worker_certifications", [
        "worker_certifications",
        "certifications",
      ]),
      displayName: workerColumn(listing, fd, "worker_display_name", [
        "worker_display_name",
        "workerDisplayName",
      ]),
      ageGroup: workerColumn(listing, fd, "worker_age_group", [
        "worker_age_group",
        "workerAgeGroup",
      ]),
      notes: workerColumn(listing, fd, "worker_notes", [
        "worker_notes",
        "workerNotes",
      ]),
      priceType: workerColumn(listing, fd, "worker_price_type", [
        "worker_price_type",
        "workerPriceType",
      ]),
      priceAmount: parseWorkerPriceAmount(
        listing?.worker_price_amount ??
          pickFormValue(fd, ["worker_price_amount", "workerPrice"])
      ),
      priceText: formatWorkerPriceDisplay(listing),
      supportTags: workerColumn(listing, fd, "worker_support_tags", [
        "worker_support_tags",
      ]),
      raw: listing,
    };
  }

  window.TasuWorkerListingFields = {
    WORKER_DETAIL_EMPTY,
    parseFormData,
    workerColumn,
    parseWorkerPriceAmount,
    formatWorkerPriceDisplay,
    normalizeWorkerListing,
  };
})();
