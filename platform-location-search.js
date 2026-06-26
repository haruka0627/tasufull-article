/**
 * Platform — 位置検索（都道府県 · 市区町村 · 半径 · 近い順）
 */
(function (global) {
  "use strict";

  const PREF_COORDS = Object.freeze({
    北海道: { lat: 43.06, lng: 141.35 },
    青森: { lat: 40.82, lng: 140.74 },
    岩手: { lat: 39.7, lng: 141.15 },
    宮城: { lat: 38.27, lng: 140.87 },
    秋田: { lat: 39.72, lng: 140.1 },
    山形: { lat: 38.24, lng: 140.34 },
    福島: { lat: 37.75, lng: 140.47 },
    茨城: { lat: 36.34, lng: 140.45 },
    栃木: { lat: 36.57, lng: 139.88 },
    群馬: { lat: 36.39, lng: 139.06 },
    埼玉: { lat: 35.86, lng: 139.65 },
    千葉: { lat: 35.61, lng: 140.12 },
    東京: { lat: 35.68, lng: 139.76 },
    神奈川: { lat: 35.45, lng: 139.64 },
    新潟: { lat: 37.9, lng: 139.02 },
    富山: { lat: 36.7, lng: 137.21 },
    石川: { lat: 36.59, lng: 136.63 },
    福井: { lat: 36.07, lng: 136.22 },
    山梨: { lat: 35.66, lng: 138.57 },
    長野: { lat: 36.65, lng: 138.18 },
    岐阜: { lat: 35.39, lng: 136.72 },
    静岡: { lat: 34.98, lng: 138.38 },
    愛知: { lat: 35.18, lng: 136.91 },
    三重: { lat: 34.73, lng: 136.51 },
    滋賀: { lat: 35.0, lng: 135.87 },
    京都: { lat: 35.01, lng: 135.77 },
    大阪: { lat: 34.69, lng: 135.52 },
    兵庫: { lat: 34.69, lng: 135.18 },
    奈良: { lat: 34.69, lng: 135.83 },
    和歌山: { lat: 34.23, lng: 135.17 },
    鳥取: { lat: 35.5, lng: 134.24 },
    島根: { lat: 35.47, lng: 133.05 },
    岡山: { lat: 34.66, lng: 133.93 },
    広島: { lat: 34.4, lng: 132.46 },
    山口: { lat: 34.19, lng: 131.47 },
    徳島: { lat: 34.07, lng: 134.56 },
    香川: { lat: 34.34, lng: 134.04 },
    愛媛: { lat: 33.84, lng: 132.77 },
    高知: { lat: 33.56, lng: 133.53 },
    福岡: { lat: 33.59, lng: 130.4 },
    佐賀: { lat: 33.25, lng: 130.3 },
    長崎: { lat: 32.75, lng: 129.88 },
    熊本: { lat: 32.8, lng: 130.71 },
    大分: { lat: 33.24, lng: 131.61 },
    宮崎: { lat: 31.91, lng: 131.42 },
    鹿児島: { lat: 31.56, lng: 130.56 },
    沖縄: { lat: 26.21, lng: 127.68 },
  });

  function haversineKm(a, b) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function detectPref(text) {
    const t = String(text || "");
    for (const pref of Object.keys(PREF_COORDS)) {
      if (t.includes(pref)) return pref;
    }
    return "";
  }

  function listingCoord(listing) {
    const lat = Number(listing?.lat ?? listing?.latitude);
    const lng = Number(listing?.lng ?? listing?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    const pref = detectPref(listing?.area || listing?.service_area || listing?.prefecture || "");
    return pref ? PREF_COORDS[pref] : null;
  }

  /**
   * @param {object[]} listings
   * @param {{ lat?: number, lng?: number, pref?: string, city?: string, radiusKm?: number }} origin
   */
  function filterAndSortByDistance(listings, origin) {
    let center = null;
    if (Number.isFinite(origin?.lat) && Number.isFinite(origin?.lng)) {
      center = { lat: origin.lat, lng: origin.lng };
    } else if (origin?.pref && PREF_COORDS[origin.pref]) {
      center = PREF_COORDS[origin.pref];
    } else if (origin?.pref) {
      const p = detectPref(origin.pref);
      center = p ? PREF_COORDS[p] : null;
    }

    const radius = Number(origin?.radiusKm) > 0 ? Number(origin.radiusKm) : 50;
    const city = String(origin?.city || "").trim();

    const rows = (listings || [])
      .map((listing) => {
        const coord = listingCoord(listing);
        const areaText = String(listing?.area || listing?.service_area || listing?.city || "");
        if (city && areaText && !areaText.includes(city)) {
          return { listing, distanceKm: Infinity, nearby: false };
        }
        if (!center || !coord) {
          return { listing, distanceKm: Infinity, nearby: false };
        }
        const distanceKm = haversineKm(center, coord);
        return { listing, distanceKm, nearby: distanceKm <= radius };
      })
      .filter((r) => r.nearby || !center)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return rows;
  }

  function getCurrentPosition() {
    return new Promise((resolve) => {
      if (!global.navigator?.geolocation) {
        resolve({ ok: false, error: "unsupported" });
        return;
      }
      global.navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => resolve({ ok: false, error: err.message || "denied" }),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  global.TasuPlatformLocationSearch = {
    PREF_COORDS,
    detectPref,
    filterAndSortByDistance,
    getCurrentPosition,
    haversineKm,
  };
})(typeof window !== "undefined" ? window : globalThis);
