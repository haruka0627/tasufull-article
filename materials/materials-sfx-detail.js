/**
 * TASFUL Materials — SFX詳細（Screenshot-to-Code 正本の完全移植）
 * canonical: reports/materials-stc-audit/canonical/sfx-detail.html
 * category=sfx のみ。旧 mat-sfx-d BEM UI は使用しない。
 * Contract: Play/Pause/seek · Download · Favorite · Related · reward-ad
 */
(function (global) {
  "use strict";

  /** @type {HTMLAudioElement | null} */
  let audioEl = null;
  let seeking = false;
  /** @type {Float32Array | null} */
  let peakCache = null;
  /** @type {string} */
  let activeSeg = "full";

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function formatCount(n) {
    return (Number(n) || 0).toLocaleString("ja-JP");
  }

  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  function parseDurationLabel(label) {
    const m = String(label || "")
      .trim()
      .match(/^(\d+):(\d{1,2})$/);
    if (!m) return 0;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function resolveAudioSrc(item) {
    return pickStr(item.audio_src, item.preview_url, item.download_url);
  }

  function itemTags(item) {
    return (item.tags || []).filter((t) => {
      const s = String(t);
      const low = s.toLowerCase();
      return s && low !== "sfx" && low !== "wav" && s !== "効果音";
    });
  }

  function displayTag(tag) {
    const map = {
      impact: "衝撃",
      heavy: "重厚",
      pop: "ポップ",
      whoosh: "ウーシュ",
      click: "クリック",
      telop: "テロップ",
    };
    const key = String(tag || "").toLowerCase();
    return map[key] || String(tag || "");
  }

  function ensureAudio() {
    if (audioEl) return audioEl;
    audioEl = new global.Audio();
    audioEl.preload = "metadata";
    return audioEl;
  }

  function stopAudio() {
    if (!audioEl) return;
    try {
      audioEl.pause();
      audioEl.currentTime = 0;
    } catch {
      /* ignore */
    }
  }

  /** Deterministic SVG waveform matching STC <img class="w-full h-8 object-contain"> slot */
  function relatedWaveDataUri(seed) {
    let s = 0;
    const str = String(seed || "sfx");
    for (let i = 0; i < str.length; i += 1) s = (s * 31 + str.charCodeAt(i)) >>> 0;
    const bars = [];
    const n = 40;
    for (let i = 0; i < n; i += 1) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const r = (s % 1000) / 1000;
      const mid = 1 - Math.abs(i - (n - 1) / 2) / (n / 2);
      const h = Math.min(28, 6 + r * 22 * Math.max(0.25, mid));
      const x = 4 + i * 5.8;
      const y = 16 - h / 2;
      bars.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="3.2" height="${h.toFixed(1)}" rx="0.6" fill="#fda4af"/>`
      );
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="32" viewBox="0 0 240 32">${bars.join("")}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function usageBullets(item) {
    const clean = (list) =>
      (list || [])
        .map((x) => String(x).trim())
        .filter((s) => {
          const low = s.toLowerCase();
          return s && low !== "sfx" && low !== "wav" && low !== "effect" && s !== "効果音";
        })
        .slice(0, 4);
    const fromData = clean(item.usage_tags || []);
    if (fromData.length) return fromData.map((t) => `${displayTag(t)}の演出に`);
    const tags = clean(itemTags(item)).map(displayTag);
    if (!tags.length) {
      return [
        "テキストの出現演出に",
        "ボタンのクリック演出に",
        "UIアニメーションに",
        "動画のテロップ表示に",
      ];
    }
    return tags.map((t) => `${t}の演出に`);
  }

  function buildInfoRows(item, formats, durationLabel) {
    const rows = [];
    const formatText = formats.map((f) => String(f).toUpperCase()).join(" / ");
    if (formatText) rows.push(["ファイル形式", formatText]);
    if (durationLabel) rows.push(["長さ", durationLabel]);
    const sample = pickStr(item.meta_sample_rate, item.sample_rate);
    if (sample) rows.push(["サンプルレート", sample]);
    const bit = pickStr(item.meta_bit_depth, item.bit_depth);
    if (bit) rows.push(["ビット深度", bit]);
    const ch = pickStr(item.meta_channels, item.channels);
    if (ch) rows.push(["チャンネル", ch]);
    const size = pickStr(item.file_size, item.meta_file_size);
    if (size) rows.push(["ファイルサイズ", size]);
    const published = pickStr(item.meta_published, item.meta_updated, item.updated_at);
    if (published) {
      const d = new Date(published);
      rows.push([
        "公開日",
        Number.isNaN(d.getTime())
          ? published
          : `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`,
      ]);
    }
    const id = pickStr(item.slug, item.id);
    if (id) rows.push(["素材ID", id]);
    return rows;
  }

  function descParagraphs(item) {
    const long = pickStr(item.long_description);
    if (long) {
      const parts = long
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) return parts.slice(0, 2);
      if (parts.length === 1) {
        return [parts[0], pickStr(item.description) || "短く軽やかなサウンドで、動画やアプリの演出に自然に馴染みます。"];
      }
    }
    const desc = pickStr(item.description) || "効果音 / SFX 素材です。";
    return [
      desc,
      "短く軽やかなサウンドで、動画やアプリの演出に自然に馴染みます。",
    ];
  }

  function renderRelatedCard(item) {
    const href = `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
    const dur = pickStr(item.meta_duration, "0:00");
    const rating = Number(item.rating || 0);
    const ratingLabel = rating > 0 ? rating.toFixed(1) : "—";
    const dl = formatCount(item.download_count);
    const wave = relatedWaveDataUri(item.id);
    return (
      `<div class="border border-gray-100 rounded-xl p-3 bg-white hover:shadow-md transition-shadow" data-sfx-d-related data-item-id="${escapeHtml(item.id)}">` +
      `<div class="flex items-center justify-between mb-2">` +
      `<span class="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">効果音 / SFX</span>` +
      (item.is_free !== false
        ? `<span class="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-bold">無料</span>`
        : `<span></span>`) +
      `</div>` +
      `<div class="mb-3">` +
      `<a href="${href}" aria-label="${escapeHtml(item.title)}"><img src="${wave}" alt="Waveform" class="w-full h-8 object-contain"></a>` +
      `<div class="text-[10px] text-gray-400 text-right mt-1">${escapeHtml(dur)}</div>` +
      `</div>` +
      `<h3 class="text-xs font-bold mb-2 truncate"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<div class="flex items-center justify-between text-[10px]">` +
      `<div class="flex items-center text-gray-500">` +
      `<i class="fas fa-star text-orange-400 mr-1"></i> ${escapeHtml(ratingLabel)}` +
      `<span class="ml-1 text-gray-400">${dl}</span>` +
      `</div>` +
      `<button type="button" class="text-red-500 hover:text-red-600" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
      `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
      `<i class="fas fa-download" aria-hidden="true"></i>` +
      `</button>` +
      `</div>` +
      `</div>`
    );
  }

  function infoRowsHtml(rows) {
    return rows
      .map(
        ([k, v]) =>
          `<div class="flex justify-between"><span class="text-gray-500">${escapeHtml(k)}</span><span class="font-medium">${escapeHtml(v)}</span></div>`
      )
      .join("");
  }

  function mobileInfoRowsHtml(rows) {
    return rows
      .map(
        ([k, v]) =>
          `<div class="flex justify-between"><span>${escapeHtml(k)}</span> <span>${escapeHtml(v)}</span></div>`
      )
      .join("");
  }

  function renderShell(item, related) {
    const Fav = global.TasuMaterialsFavorites;
    const Download = global.TasuMaterialsDownload;
    const tags = itemTags(item);
    const favOn = !!Fav?.isFavorited?.(item.id);
    const dlLabel =
      Download?.primaryButtonLabel?.(item) || item.button_label || "無料ダウンロード";
    const formats = (item.file_formats || []).length
      ? item.file_formats
      : String(item.meta_format || "WAV")
          .split(/[/·,]/)
          .map((s) => s.trim())
          .filter(Boolean);
    const durationLabel = pickStr(item.meta_duration, "0:00");
    const durationSec = parseDurationLabel(durationLabel) || 2;
    const half = Math.max(1, Math.floor(durationSec / 2));
    const midLabel = formatTime(half);
    const endLabel = durationLabel || formatTime(durationSec);
    const rating = Number(item.rating || 0);
    const ratingLabel = rating > 0 ? rating.toFixed(1) : "—";
    const ratingCount = Number(item.rating_count || 0);
    const listHref = "/materials/list.html?category=sfx";
    const bullets = usageBullets(item);
    const [p1, p2] = descParagraphs(item);
    const relatedSfx = (related || []).filter((r) => r && r.category_id === "sfx" && r.id !== item.id);
    const relatedFallback = (relatedSfx.length ? relatedSfx : (related || []).filter((r) => r && r.id !== item.id)).slice(
      0,
      5
    );
    const infoRows = buildInfoRows(item, formats, durationLabel);
    const formatOptions = formats
      .map((f, i) => {
        const upper = String(f).toUpperCase();
        const label = upper === "WAV" ? "WAV（高品質）推奨" : upper;
        return `<option value="${escapeHtml(upper)}"${i === 0 ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");
    const qualityDefault = pickStr(
      [pickStr(item.meta_sample_rate, "44.1kHz"), pickStr(item.meta_bit_depth, "16bit")].filter(Boolean).join(" / "),
      "44.1kHz / 16bit"
    );
    const tagBadges = tags.map((t) => `<span class="tag-badge">${escapeHtml(displayTag(t))}</span>`).join("");
    const sideTags = tags
      .map(
        (t) =>
          `<a href="/materials/list.html?category=sfx&q=${encodeURIComponent(t)}" class="tag-badge bg-red-50 text-red-600 m-0">${escapeHtml(displayTag(t))}</a>`
      )
      .join("");
    const bulletLis = bullets
      .map(
        (b) =>
          `<li class="flex items-start"><span class="text-red-500 mr-2">•</span><span class="text-gray-700 text-sm">${escapeHtml(b)}</span></li>`
      )
      .join("");
    const bulletLisMobile = bullets
      .map(
        (b) =>
          `<li class="flex items-start"><span class="text-red-500 mr-2">•</span> ${escapeHtml(b)}</li>`
      )
      .join("");
    const commentLabel = ratingCount > 0 ? `コメント (${formatCount(ratingCount)})` : "コメント";

    return (
      `<div class="bg-gray-50/30" data-sfx-detail data-item-id="${escapeHtml(item.id)}">` +
      `<main class="container mx-auto px-4 lg:px-8 py-6">` +
      `<div class="lg:hidden mb-4">` +
      `<a href="${listHref}" class="text-xs font-medium text-gray-500 flex items-center">` +
      `<i class="fas fa-chevron-left mr-2"></i> 効果音 / SFX 一覧に戻る` +
      `</a>` +
      `</div>` +
      `<nav class="hidden lg:flex text-xs text-gray-500 mb-6 items-center space-x-2" aria-label="パンくず">` +
      `<a href="/materials/" class="hover:underline">ホーム</a>` +
      `<i class="fas fa-chevron-right text-[10px]"></i>` +
      `<a href="/materials/" class="hover:underline">素材を探す</a>` +
      `<i class="fas fa-chevron-right text-[10px]"></i>` +
      `<a href="${listHref}" class="hover:underline">効果音 / SFX</a>` +
      `<i class="fas fa-chevron-right text-[10px]"></i>` +
      `<span class="text-gray-400">${escapeHtml(item.title)}</span>` +
      `</nav>` +
      `<div class="flex flex-col lg:flex-row lg:space-x-8">` +
      `<div class="flex-1">` +
      `<div class="mb-6">` +
      `<div class="flex items-center space-x-2 mb-2">` +
      `<span class="sfx-badge">効果音 / SFX</span>` +
      (item.is_free !== false ? `<span class="free-badge">無料</span>` : "") +
      `</div>` +
      `<h1 class="text-3xl font-bold mb-2">${escapeHtml(item.title)}</h1>` +
      `<p class="text-gray-600 mb-4">${escapeHtml(item.description || "")}</p>` +
      (tagBadges ? `<div class="flex flex-wrap mb-4">${tagBadges}</div>` : "") +
      `<div class="flex items-center space-x-6 text-sm text-gray-500">` +
      `<div class="flex items-center">` +
      `<i class="fas fa-star text-orange-400 mr-1"></i>` +
      `<span class="font-bold text-gray-700">${escapeHtml(ratingLabel)}</span>` +
      (ratingCount ? `<span class="ml-1">(${formatCount(ratingCount)})</span>` : "") +
      `</div>` +
      `<div class="flex items-center">` +
      `<i class="fas fa-download mr-1"></i>` +
      `<span>${formatCount(item.download_count)} ダウンロード</span>` +
      `</div>` +
      `<button type="button" class="flex items-center hover:text-red-500 transition-colors${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<i class="${favOn ? "fas" : "far"} fa-heart mr-1" data-sfx-fav-icon></i>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `<div class="waveform-container mb-8" data-sfx-d-player>` +
      `<div class="flex items-center space-x-4 mb-6">` +
      `<button type="button" class="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white text-2xl hover:bg-red-700 transition-colors" data-sfx-d-play aria-label="再生" disabled>` +
      `<i class="fas fa-play ml-1" data-sfx-d-play-icon></i>` +
      `</button>` +
      `<div class="flex-1 relative h-16 flex items-center">` +
      `<div class="w-full h-10" data-sfx-d-wave>` +
      `<canvas data-sfx-d-canvas width="960" height="80" aria-hidden="true"></canvas>` +
      `<button type="button" data-sfx-d-seekhit aria-label="波形上で再生位置を指定" disabled></button>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="flex items-center justify-between text-xs text-gray-400 mb-6">` +
      `<span class="lg:block hidden" data-sfx-d-current>0:00</span>` +
      `<span class="lg:hidden" data-sfx-d-current-m>0:00</span>` +
      `<span class="lg:block hidden" data-sfx-d-total>${escapeHtml(endLabel)}</span>` +
      `<span class="lg:hidden" data-sfx-d-total-m>${escapeHtml(endLabel)}</span>` +
      `</div>` +
      `<div class="flex flex-wrap lg:flex-nowrap items-center gap-2 lg:gap-2">` +
      `<button type="button" class="w-10 h-10 border border-gray-200 rounded-lg flex items-center justify-center text-red-600 hover:bg-gray-50" data-sfx-d-restart aria-label="先頭に戻す" disabled>` +
      `<i class="fas fa-redo-alt text-sm"></i>` +
      `</button>` +
      `<div class="flex-1 flex gap-2" role="group" aria-label="再生区間">` +
      `<button type="button" class="flex-1 py-2 px-1 rounded-lg bg-red-600 text-white text-[10px] lg:text-sm font-medium" data-sfx-d-seg="full" disabled>0:00 - ${escapeHtml(endLabel)}</button>` +
      `<button type="button" class="flex-1 py-2 px-1 rounded-lg bg-gray-100 text-gray-700 text-[10px] lg:text-sm font-medium" data-sfx-d-seg="a" disabled>0:00 - ${escapeHtml(midLabel)}</button>` +
      `<button type="button" class="flex-1 py-2 px-1 rounded-lg bg-gray-100 text-gray-700 text-[10px] lg:text-sm font-medium" data-sfx-d-seg="b" disabled>${escapeHtml(midLabel)} - ${escapeHtml(endLabel)}</button>` +
      `</div>` +
      `<button type="button" class="w-full lg:w-auto px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium flex items-center justify-center hover:bg-gray-50 mt-2 lg:mt-0" data-sfx-d-copy disabled>` +
      `区間をコピー <i class="far fa-copy ml-2"></i>` +
      `</button>` +
      `</div>` +
      `<p class="text-xs text-red-500 mt-2 hidden" data-sfx-d-status></p>` +
      `</div>` +
      `<div class="hidden lg:block mb-12" data-sfx-d-tabs>` +
      `<div class="flex border-b border-gray-100 mb-6" role="tablist">` +
      `<button type="button" class="px-6 py-3 font-bold text-sm tab-active" role="tab" aria-selected="true" data-sfx-d-tab="desc">説明</button>` +
      `<button type="button" class="px-6 py-3 font-medium text-sm text-gray-500 hover:text-gray-700" role="tab" aria-selected="false" data-sfx-d-tab="usage">利用シーン</button>` +
      `<button type="button" class="px-6 py-3 font-medium text-sm text-gray-500 hover:text-gray-700" role="tab" aria-selected="false" data-sfx-d-tab="related">関連素材</button>` +
      `<button type="button" class="px-6 py-3 font-medium text-sm text-gray-500 hover:text-gray-700" role="tab" aria-selected="false" data-sfx-d-tab="comments">${escapeHtml(commentLabel)}</button>` +
      `</div>` +
      `<div data-sfx-d-panel="desc">` +
      `<p class="text-gray-700 mb-2 leading-relaxed">${escapeHtml(p1)}</p>` +
      `<p class="text-gray-700 mb-6 leading-relaxed" data-sfx-d-more-desk hidden>${escapeHtml(p2)}</p>` +
      `<ul class="space-y-2 mb-6">${bulletLis}</ul>` +
      `<button type="button" class="text-sm font-medium border border-gray-200 rounded-lg px-4 py-1.5 hover:bg-gray-50 flex items-center" data-sfx-d-more-btn>` +
      `もっと見る <i class="fas fa-chevron-down ml-2 text-xs"></i>` +
      `</button>` +
      `</div>` +
      `<div class="hidden" data-sfx-d-panel="usage">` +
      `<ul class="space-y-2 mb-6">${bulletLis}</ul>` +
      `</div>` +
      `<div class="hidden" data-sfx-d-panel="related">` +
      `<p class="text-gray-700 text-sm">下記の関連素材をご覧ください。</p>` +
      `</div>` +
      `<div class="hidden" data-sfx-d-panel="comments">` +
      `<p class="text-gray-500 text-sm">コメント機能は準備中です。</p>` +
      `</div>` +
      `</div>` +
      `<div class="lg:hidden mb-6">` +
      `<p class="text-sm text-gray-700 mb-2">${escapeHtml(p1)}</p>` +
      `<p class="text-sm text-gray-700 mb-4" data-sfx-d-more-mob hidden>${escapeHtml(p2)}</p>` +
      `<ul class="text-sm text-gray-700 space-y-2 mb-4">${bulletLisMobile}</ul>` +
      `<button type="button" class="text-xs font-bold border border-gray-200 rounded-lg px-4 py-2 flex items-center" data-sfx-d-more-btn-m>` +
      `もっと見る <i class="fas fa-chevron-down ml-2"></i>` +
      `</button>` +
      `</div>` +
      `<div class="mb-12">` +
      `<div class="flex items-center justify-between mb-6">` +
      `<h2 class="text-sm lg:text-lg font-bold flex items-center max-w-[200px] lg:max-w-none">` +
      `<i class="fas fa-music text-red-500 mr-2 flex-shrink-0"></i>` +
      `この素材を使用している人はこんな素材も使っています` +
      `</h2>` +
      `<a href="${listHref}" class="text-xs lg:text-sm font-bold text-red-500 hover:underline flex items-center whitespace-nowrap">` +
      `すべて見る <i class="fas fa-chevron-right ml-1 text-[10px]"></i>` +
      `</a>` +
      `</div>` +
      (relatedFallback.length
        ? `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">${relatedFallback.map(renderRelatedCard).join("")}</div>`
        : `<p class="text-sm text-gray-500">関連素材はまだありません。</p>`) +
      `</div>` +
      `</div>` +
      `<aside class="w-full lg:w-96">` +
      `<div class="sidebar-card">` +
      `<div class="flex items-center justify-between lg:block mb-4 lg:mb-6 cursor-pointer lg:cursor-default" data-sfx-dl-toggle>` +
      `<h3 class="font-bold text-base lg:text-lg flex items-center">` +
      `<i class="fas fa-download text-red-500 mr-2"></i> ダウンロード` +
      `</h3>` +
      `<i class="fas fa-chevron-down lg:hidden text-gray-400" data-sfx-dl-chevron></i>` +
      `</div>` +
      `<div class="lg:block" data-sfx-dl-body>` +
      `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
      `<div class="space-y-4 mb-6">` +
      `<div>` +
      `<label class="text-xs text-gray-500 mb-1.5 block">ファイル形式</label>` +
      `<div class="relative">` +
      `<select class="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm appearance-none bg-white" data-sfx-d-format aria-label="ファイル形式">` +
      (formatOptions || "<option>WAV（高品質）推奨</option>") +
      `</select>` +
      `<i class="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>` +
      `</div>` +
      `</div>` +
      `<div>` +
      `<label class="text-xs text-gray-500 mb-1.5 block">品質</label>` +
      `<div class="relative">` +
      `<select class="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm appearance-none bg-white" aria-label="品質">` +
      `<option>${escapeHtml(qualityDefault)}</option>` +
      `</select>` +
      `<i class="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<button type="button" class="btn-red mb-3" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `<p class="text-[10px] text-gray-400 text-center">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</div>` +
      `</div>` +
      `<div class="lg:hidden space-y-4">` +
      `<div class="border-b border-gray-100 py-4 flex items-center justify-between font-bold" data-sfx-acc-toggle>` +
      `<span>素材情報</span> <i class="fas fa-chevron-down text-gray-400"></i>` +
      `</div>` +
      `<div class="hidden py-4 space-y-2 text-sm text-gray-600">${mobileInfoRowsHtml(infoRows)}</div>` +
      `<div class="border-b border-gray-100 py-4 flex items-center justify-between font-bold" data-sfx-acc-toggle>` +
      `<span>説明</span> <i class="fas fa-chevron-down text-gray-400"></i>` +
      `</div>` +
      `<div class="hidden py-4 text-sm text-gray-700">${escapeHtml(p1)}</div>` +
      `<div class="border-b border-gray-100 py-4 flex items-center justify-between font-bold" data-sfx-acc-toggle>` +
      `<span>利用シーン</span> <i class="fas fa-chevron-down text-gray-400"></i>` +
      `</div>` +
      `<div class="hidden py-4"><ul class="text-sm text-gray-700 space-y-2">${bulletLisMobile}</ul></div>` +
      `<div class="border-b border-gray-100 py-4 flex items-center justify-between font-bold" data-sfx-acc-toggle>` +
      `<span>関連素材</span> <i class="fas fa-chevron-down text-gray-400"></i>` +
      `</div>` +
      `<div class="hidden py-4 text-sm text-gray-500">下記の関連素材をご覧ください。</div>` +
      `<div class="border-b border-gray-100 py-4 flex items-center justify-between font-bold" data-sfx-acc-toggle>` +
      `<span>タグ</span> <i class="fas fa-chevron-down text-gray-400"></i>` +
      `</div>` +
      `<div class="hidden py-4"><div class="flex flex-wrap gap-2">${sideTags}</div></div>` +
      `<div class="border-b border-gray-100 py-4 flex items-center justify-between font-bold" data-sfx-acc-toggle>` +
      `<span>${escapeHtml(commentLabel)}</span> <i class="fas fa-chevron-down text-gray-400"></i>` +
      `</div>` +
      `<div class="hidden py-4 text-sm text-gray-500">コメント機能は準備中です。</div>` +
      `</div>` +
      (infoRows.length
        ? `<div class="hidden lg:block sidebar-card">` +
          `<h3 class="font-bold text-lg mb-6 flex items-center">` +
          `<i class="fas fa-info-circle text-red-500 mr-2"></i> 素材情報` +
          `</h3>` +
          `<div class="space-y-3 text-sm">${infoRowsHtml(infoRows)}</div>` +
          `</div>`
        : "") +
      `<div class="hidden lg:block sidebar-card">` +
      `<h3 class="font-bold text-lg mb-4 flex items-center">` +
      `<i class="fas fa-shield-alt text-red-500 mr-2"></i> ライセンス` +
      `</h3>` +
      `<p class="text-sm text-gray-700 mb-2 font-medium">${escapeHtml(item.commercial_use || "商用利用OK・クレジット表記不要")}</p>` +
      `<p class="text-sm text-gray-500 mb-4">再配布・販売は禁止されています</p>` +
      `<a href="/company/legal/materials.html" class="text-sm font-bold text-red-500 hover:underline flex items-center justify-end">` +
      `ライセンス詳細を見る <i class="fas fa-chevron-right ml-1 text-xs"></i>` +
      `</a>` +
      `</div>` +
      (sideTags
        ? `<div class="hidden lg:block sidebar-card">` +
          `<h3 class="font-bold text-lg mb-6 flex items-center">` +
          `<i class="fas fa-tags text-red-500 mr-2"></i> タグ` +
          `</h3>` +
          `<div class="flex flex-wrap gap-2 mb-6">${sideTags}</div>` +
          `<a href="${listHref}" class="text-sm font-bold text-red-500 hover:underline flex items-center justify-end">` +
          `すべてのタグを見る (${tags.length}) <i class="fas fa-chevron-right ml-1 text-xs"></i>` +
          `</a>` +
          `</div>`
        : "") +
      `<div class="lg:hidden mt-6 pb-12">` +
      `<button type="button" class="w-full py-4 border border-gray-200 rounded-full font-bold text-gray-700 flex items-center justify-center space-x-2${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<i class="${favOn ? "fas" : "far"} fa-heart text-red-500" data-sfx-fav-icon></i>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</div>` +
      `</aside>` +
      `</div>` +
      `</main>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function setPlayingUi(root, playing) {
    const btn = root.querySelector("[data-sfx-d-play]");
    const icon = root.querySelector("[data-sfx-d-play-icon]");
    if (btn) btn.setAttribute("aria-label", playing ? "一時停止" : "再生");
    if (icon) {
      icon.className = playing ? "fas fa-pause" : "fas fa-play ml-1";
    }
  }

  function setSegActive(root, kind) {
    activeSeg = kind;
    root.querySelectorAll("[data-sfx-d-seg]").forEach((btn) => {
      const on = btn.getAttribute("data-sfx-d-seg") === kind;
      btn.classList.toggle("bg-red-600", on);
      btn.classList.toggle("text-white", on);
      btn.classList.toggle("bg-gray-100", !on);
      btn.classList.toggle("text-gray-700", !on);
    });
  }

  function downsamplePeaks(channelData, buckets) {
    const peaks = new Float32Array(buckets);
    const block = Math.floor(channelData.length / buckets) || 1;
    for (let i = 0; i < buckets; i += 1) {
      let max = 0;
      const start = i * block;
      const end = Math.min(channelData.length, start + block);
      for (let j = start; j < end; j += 1) {
        const v = Math.abs(channelData[j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  }

  function paintWaveform(canvas, peaks, progressRatio) {
    if (!canvas || !peaks || !peaks.length) return;
    const dpr = Math.max(1, global.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || 640;
    const cssH = canvas.clientHeight || 40;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const mid = cssH / 2;
    const barW = Math.max(1, cssW / peaks.length - 1);
    const playedTo = Math.floor(peaks.length * Math.max(0, Math.min(1, progressRatio || 0)));
    for (let i = 0; i < peaks.length; i += 1) {
      const h = Math.max(2, peaks[i] * (cssH * 0.9));
      const x = (i / peaks.length) * cssW;
      ctx.fillStyle = i <= playedTo ? "#e11d48" : "#fecdd3";
      ctx.fillRect(x, mid - h / 2, barW, h);
    }
  }

  async function loadPeaks(src) {
    if (!src || (!global.AudioContext && !global.webkitAudioContext)) return null;
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      const AC = global.AudioContext || global.webkitAudioContext;
      const ac = new AC();
      const buffer = await ac.decodeAudioData(ab.slice(0));
      try {
        await ac.close();
      } catch {
        /* ignore */
      }
      return downsamplePeaks(buffer.getChannelData(0), 180);
    } catch {
      return null;
    }
  }

  function wireAudio(root, item) {
    const src = resolveAudioSrc(item);
    const playBtn = root.querySelector("[data-sfx-d-play]");
    const seekHit = root.querySelector("[data-sfx-d-seekhit]");
    const currentEls = [...root.querySelectorAll("[data-sfx-d-current], [data-sfx-d-current-m]")];
    const totalEls = [...root.querySelectorAll("[data-sfx-d-total], [data-sfx-d-total-m]")];
    const restartBtn = root.querySelector("[data-sfx-d-restart]");
    const status = root.querySelector("[data-sfx-d-status]");
    const canvas = root.querySelector("[data-sfx-d-canvas]");
    const copyBtn = root.querySelector("[data-sfx-d-copy]");
    const segBtns = [...root.querySelectorAll("[data-sfx-d-seg]")];
    const fallbackDur = parseDurationLabel(item.meta_duration);

    if (!src) {
      if (status) {
        status.classList.remove("hidden");
        status.textContent = "音声プレビューを準備できませんでした。";
      }
      return;
    }

    const audio = ensureAudio();
    audio.pause();
    audio.src = src;
    audio.load();

    const unlock = () => {
      playBtn?.removeAttribute("disabled");
      seekHit?.removeAttribute("disabled");
      restartBtn?.removeAttribute("disabled");
      segBtns.forEach((b) => b.removeAttribute("disabled"));
      copyBtn?.removeAttribute("disabled");
    };

    const updateProgress = () => {
      if (seeking) return;
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDur;
      const cur = audio.currentTime || 0;
      const ratio = dur > 0 ? Math.min(1, cur / dur) : 0;
      const curLabel = formatTime(cur);
      const totLabel = dur > 0 ? formatTime(dur) : formatTime(fallbackDur);
      currentEls.forEach((el) => {
        el.textContent = curLabel;
      });
      totalEls.forEach((el) => {
        el.textContent = totLabel;
      });
      paintWaveform(canvas, peakCache, ratio);
    };

    audio.onloadedmetadata = () => {
      unlock();
      updateProgress();
    };
    audio.oncanplay = unlock;
    audio.ontimeupdate = updateProgress;
    audio.onended = () => {
      setPlayingUi(root, false);
      updateProgress();
    };
    audio.onerror = () => {
      if (status) {
        status.classList.remove("hidden");
        status.textContent = "音声の読み込みに失敗しました。";
      }
      setPlayingUi(root, false);
    };

    playBtn?.addEventListener("click", async () => {
      try {
        if (audio.paused) {
          const dur =
            Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDur;
          if (dur > 0 && audio.currentTime >= dur - 0.05) audio.currentTime = 0;
          await audio.play();
          setPlayingUi(root, true);
        } else {
          audio.pause();
          setPlayingUi(root, false);
        }
      } catch {
        if (status) {
          status.classList.remove("hidden");
          status.textContent = "再生できませんでした。";
        }
      }
    });

    restartBtn?.addEventListener("click", () => {
      audio.currentTime = 0;
      updateProgress();
    });

    const seekRatio = (ratio) => {
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDur;
      if (!(dur > 0)) return;
      seeking = true;
      audio.currentTime = Math.max(0, Math.min(dur, ratio * dur));
      seeking = false;
      updateProgress();
    };

    seekHit?.addEventListener("click", (ev) => {
      const rect = seekHit.getBoundingClientRect();
      const r = rect.width > 0 ? (ev.clientX - rect.left) / rect.width : 0;
      seekRatio(Math.max(0, Math.min(1, r)));
    });

    segBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-sfx-d-seg");
        setSegActive(root, kind);
        if (kind === "a") seekRatio(0);
        else if (kind === "b") seekRatio(0.5);
        else seekRatio(0);
      });
    });

    copyBtn?.addEventListener("click", async () => {
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDur;
      let text = `0:00 - ${formatTime(dur)}`;
      if (activeSeg === "a") text = `0:00 - ${formatTime(dur / 2)}`;
      if (activeSeg === "b") text = `${formatTime(dur / 2)} - ${formatTime(dur)}`;
      try {
        await global.navigator?.clipboard?.writeText?.(text);
        const toast = root.querySelector("[data-mat-toast]");
        if (toast) {
          toast.hidden = false;
          toast.textContent = "区間をコピーしました";
          setTimeout(() => {
            toast.hidden = true;
          }, 1600);
        }
      } catch {
        /* ignore */
      }
    });

    loadPeaks(src).then((peaks) => {
      peakCache = peaks;
      paintWaveform(canvas, peakCache, 0);
    });

    if (audio.readyState >= 1) unlock();
    global.addEventListener("resize", () => paintWaveform(canvas, peakCache, 0), { passive: true });
  }

  function wireTabs(root) {
    const tabs = [...root.querySelectorAll("[data-sfx-d-tab]")];
    const panels = [...root.querySelectorAll("[data-sfx-d-panel]")];
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-sfx-d-tab");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("tab-active", on);
          t.classList.toggle("font-bold", on);
          t.classList.toggle("font-medium", !on);
          t.classList.toggle("text-gray-500", !on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-sfx-d-panel") === id;
          if (id === "desc") {
            // desc panel keeps flex layout classes; others use hidden
            if (p.getAttribute("data-sfx-d-panel") === "desc") {
              p.classList.toggle("hidden", !on);
            } else {
              p.classList.toggle("hidden", !on);
            }
          } else {
            p.classList.toggle("hidden", !on);
          }
        });
      });
    });
  }

  function wireUiChrome(root) {
    const dlToggle = root.querySelector("[data-sfx-dl-toggle]");
    const dlBody = root.querySelector("[data-sfx-dl-body]");
    const dlChevron = root.querySelector("[data-sfx-dl-chevron]");
    dlToggle?.addEventListener("click", () => {
      if (global.matchMedia("(min-width: 1024px)").matches) return;
      dlBody?.classList.toggle("hidden");
      dlChevron?.classList.toggle("rotate-180");
    });

    root.querySelectorAll("[data-sfx-acc-toggle]").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const panel = toggle.nextElementSibling;
        panel?.classList.toggle("hidden");
        toggle.querySelector("i.fa-chevron-down")?.classList.toggle("rotate-180");
      });
    });

    const reveal = () => {
      root.querySelectorAll("[data-sfx-d-more-desk], [data-sfx-d-more-mob]").forEach((el) => {
        el.classList.remove("hidden");
      });
      root.querySelectorAll("[data-sfx-d-more-btn], [data-sfx-d-more-btn-m]").forEach((btn) => {
        btn.classList.add("hidden");
      });
    };
    root.querySelector("[data-sfx-d-more-btn]")?.addEventListener("click", reveal);
    root.querySelector("[data-sfx-d-more-btn-m]")?.addEventListener("click", reveal);
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== "sfx") return false;
    stopAudio();
    peakCache = null;
    activeSeg = "full";
    root.innerHTML = renderShell(item, related || []);
    document.title = `${item.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    const shell = root.querySelector("[data-sfx-detail]");
    if (!shell) return false;

    wireTabs(shell);
    wireUiChrome(shell);
    wireAudio(shell, item);

    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(shell, item);

    const byId = new Map((related || []).map((r) => [r.id, r]));
    shell.querySelectorAll("[data-sfx-d-related]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const rel = byId.get(id);
      if (rel) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, rel);
    });

    return true;
  }

  function destroy() {
    stopAudio();
    peakCache = null;
    if (audioEl) {
      audioEl.removeAttribute("src");
      audioEl.load();
    }
  }

  global.TasuMaterialsSfxDetail = {
    mount,
    destroy,
    renderShell,
  };
})(typeof window !== "undefined" ? window : globalThis);
