/**
 * TASFUL Materials — SFX一覧（Screenshot-to-Code 正本の完全移植）
 * category=sfx のみ。canonical: reports/materials-stc-audit/canonical/sfx-list.html
 * 既存 Search / Filter / Sort / Play / Download / Favorite / Member Access Contract を接続。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const GENERIC_TAGS = new Set(["sfx", "wav", "bgm", "audio"]);

  /** @type {HTMLAudioElement | null} */
  let sharedAudio = null;
  /** @type {string} */
  let playingId = "";
  /** @type {{ items: object[], page: number, filters: object, sort: string, q: string } | null} */
  let state = null;

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

  function genreFilter() {
    return global.TasuMaterialsGenreFilter;
  }

  function resolveStyleKey(item) {
    return pickStr(item.style, item.mood);
  }

  function formatCount(n) {
    const num = Number(n) || 0;
    if (num >= 10000) return `${(num / 10000).toFixed(1).replace(/\.0$/, "")}万`;
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(num);
  }

  function formatDurationSec(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "";
    const total = Math.max(0, Math.round(sec));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function parseDurationToSec(label) {
    const raw = String(label || "").trim();
    const m = raw.match(/^(\d+):(\d{1,2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function durationBucket(sec) {
    if (sec == null || !Number.isFinite(sec)) return "";
    if (sec <= 3) return "0-3";
    if (sec <= 10) return "3-10";
    return "10+";
  }

  function enrichItem(raw) {
    const data = global.TasuMaterialsData;
    if (data?.enrichDetail) return data.enrichDetail(raw) || raw;
    return raw;
  }

  function resolveAudioSrc(item) {
    return pickStr(item.audio_src, item.download_url);
  }

  function resolveDurationLabel(item) {
    return pickStr(item.meta_duration, item.duration);
  }

  function usageLabel(sub) {
    const map = {
      pop: "ポップ / テロップ",
      heavy: "インパクト / シネマ",
      impact: "インパクト",
    };
    const key = String(sub || "").toLowerCase();
    return map[key] || (sub ? String(sub) : "");
  }

  /** タグ表示ラベル（内部 value / 保存データは変更しない） */
  function tagDisplayLabel(tag) {
    const raw = String(tag ?? "").trim();
    if (!raw) return "";
    const map = {
      impact: "衝撃",
      heavy: "重厚",
      pop: "ポップ",
      sfx: "効果音",
      telop: "テロップ",
      whoosh: "ウーシュ",
      click: "クリック",
      transition: "トランジション",
      comedy: "コメディ",
      quiz: "クイズ",
      flip: "フリップ",
    };
    const key = raw.toLowerCase();
    return map[key] || raw;
  }

  /** カード上の形式チップは技術表記維持、タグのみ表示日本語化 */
  function chipDisplayLabel(token, formatsSet) {
    const raw = String(token ?? "").trim();
    if (!raw) return "";
    if (formatsSet?.has(raw.toUpperCase()) || formatsSet?.has(raw)) return raw;
    if (/^(wav|mp3|ogg|aac|flac|aiff|m4a)$/i.test(raw)) return raw.toUpperCase() === raw ? raw : raw.toUpperCase();
    return tagDisplayLabel(raw);
  }

  function itemTags(item) {
    return (item.tags || []).filter((t) => !GENERIC_TAGS.has(String(t).toLowerCase()));
  }

  function icon(name) {
    const icons = {
      play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
      pause:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
      search:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.47 6.47 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.5 6.5 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.47 6.47 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25a1 1 0 0 0 1.41-1.41L15.5 14zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>',
      star:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 17.3l6.18 3.7-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
      download:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 20h14v-2H5v2zm7-18L5.33 9h3.84v6h5.66V9h3.84L12 2z"/></svg>',
      heart:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.2-4.5-9.3-8.4C1.3 9.7 2.8 6.5 6 5.7c1.8-.4 3.5.3 4.5 1.6C11.5 6 13.2 5.3 15 5.7c3.2.8 4.7 4 3.3 6.9C19.2 16.5 12 21 12 21z"/></svg>',
      chevronLeft:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
      chevronRight:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>',
      close:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.7 2.88 18.3 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.29-6.3z"/></svg>',
      sfx:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
      bgm: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>',
      image:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z"/></svg>',
      illustration:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>',
      background:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16v16H4V4zm2 2v12h12V6H6z"/></svg>',
      icon:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm3.5 5.5l-2 5-5 2 2-5z"/></svg>',
      web: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 4h18v16H3V4zm2 4v10h14V8H5zm0-2h14V6H5z"/></svg>',
      code:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2 0l4.6-4.6L14.6 7.4 16 6l6 6-6 6z"/></svg>',
      template:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 2h9l5 5v15H6zm8 1.5V8h4.5z"/></svg>',
      document:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 2h9l5 5v15H6zm8 1.5V8h4.5zM8 12h8v1.5H8zm0 3h8v1.5H8z"/></svg>',
      presentation:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 3H3v14h8v2H7v2h10v-2h-4v-2h8zM5 15V5h14v10z"/></svg>',
      tool:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6l-3 3-4.3-4.3C.6 7.1 1 10.1 3 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.4-.4.4-1 0-1.4z"/></svg>',
    };
    return icons[name] || "";
  }

  function waveBars(seedStr) {
    let seed = 0;
    const s = String(seedStr || "sfx");
    for (let i = 0; i < s.length; i += 1) seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
    let html = "";
    for (let i = 0; i < 48; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const r = (seed % 1000) / 1000;
      const mid = 1 - Math.abs(i - 24) / 28;
      const h = Math.min(32, 4 + r * 26 * Math.max(0.25, mid));
      html += `<span style="height:${h.toFixed(1)}px"></span>`;
    }
    return html;
  }

  function readUrlState() {
    const params = new URLSearchParams(global.location.search);
    return {
      q: params.get("q") || "",
      sort: params.get("sort") === "newest" ? "newest" : "popular",
      genre: params.get("genre") || "",
      usage: params.get("usage") || "",
      length: params.get("length") || "",
      style: params.get("style") || "",
      format: params.get("format") || "",
      tag: params.get("tag") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeUrlState(next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", "sfx");
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("genre", next.genre);
    setOrDel("usage", next.usage);
    setOrDel("length", next.length);
    setOrDel("style", next.style);
    setOrDel("format", next.format);
    setOrDel("tag", next.tag);
    setOrDel("page", next.page > 1 ? String(next.page) : "");
    if (replace) global.history.replaceState({ materialsSfxList: true }, "", url);
    else global.history.pushState({ materialsSfxList: true }, "", url);
  }

  function stopAudio() {
    if (sharedAudio) {
      try {
        sharedAudio.pause();
        sharedAudio.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    playingId = "";
    document.querySelectorAll("[data-sfx-card].is-playing").forEach((el) => {
      el.classList.remove("is-playing");
      const btn = el.querySelector("[data-sfx-play]");
      if (btn) {
        btn.setAttribute("aria-label", "再生");
        btn.innerHTML = icon("play");
      }
      const prog = el.querySelector("[data-sfx-progress]");
      if (prog) prog.style.width = "0%";
    });
  }

  function ensureAudio() {
    if (!sharedAudio) {
      sharedAudio = new global.Audio();
      sharedAudio.preload = "metadata";
      sharedAudio.addEventListener("ended", () => {
        const id = playingId;
        stopAudio();
        const card = document.querySelector(`[data-sfx-card][data-item-id="${CSS.escape(id)}"]`);
        if (card) {
          const btn = card.querySelector("[data-sfx-play]");
          if (btn) {
            btn.setAttribute("aria-label", "再生");
            btn.innerHTML = icon("play");
          }
        }
      });
      sharedAudio.addEventListener("timeupdate", () => {
        if (!playingId || !sharedAudio) return;
        const card = document.querySelector(`[data-sfx-card][data-item-id="${CSS.escape(playingId)}"]`);
        if (!card) return;
        const dur = sharedAudio.duration;
        const prog = card.querySelector("[data-sfx-progress]");
        if (prog && Number.isFinite(dur) && dur > 0) {
          prog.style.width = `${Math.min(100, (sharedAudio.currentTime / dur) * 100)}%`;
        }
        const durEl = card.querySelector("[data-sfx-duration]");
        if (durEl && Number.isFinite(dur) && dur > 0) {
          durEl.textContent = formatDurationSec(dur);
          durEl.dataset.resolved = "1";
        }
      });
      sharedAudio.addEventListener("loadedmetadata", () => {
        if (!playingId || !sharedAudio) return;
        const card = document.querySelector(`[data-sfx-card][data-item-id="${CSS.escape(playingId)}"]`);
        const durEl = card?.querySelector("[data-sfx-duration]");
        const dur = sharedAudio.duration;
        if (durEl && Number.isFinite(dur) && dur > 0) {
          durEl.textContent = formatDurationSec(dur);
          durEl.dataset.resolved = "1";
        }
      });
    }
    return sharedAudio;
  }

  async function togglePlay(item, card) {
    const src = resolveAudioSrc(item);
    if (!src) return;
    const audio = ensureAudio();
    const id = String(item.id);

    if (playingId === id && !audio.paused) {
      audio.pause();
      card.classList.remove("is-playing");
      const btn = card.querySelector("[data-sfx-play]");
      if (btn) {
        btn.setAttribute("aria-label", "再生");
        btn.innerHTML = icon("play");
      }
      return;
    }

    if (playingId && playingId !== id) stopAudio();

    if (audio.src !== new URL(src, global.location.origin).href) {
      audio.src = src;
    }
    playingId = id;
    card.classList.add("is-playing");
    const btn = card.querySelector("[data-sfx-play]");
    if (btn) {
      btn.setAttribute("aria-label", "一時停止");
      btn.innerHTML = icon("pause");
    }
    try {
      await audio.play();
    } catch (err) {
      console.warn("[Materials SFX] play failed", err);
      stopAudio();
    }
  }

  function renderCard(item) {
    const Fav = global.TasuMaterialsFavorites;
    const href = `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
    const tags = itemTags(item);
    const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
    const duration = resolveDurationLabel(item) || "—";
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const favOn = Fav?.isFavorited?.(item.id);
    const chipTags = [...formats, ...tags].slice(0, 4);
    const formatSet = new Set(formats);

    return (
      `<article class="mat-sfx-card" data-sfx-card data-item-id="${escapeHtml(item.id)}" data-slug="${escapeHtml(item.slug || "")}">` +
      `<div class="mat-sfx-card__top">` +
      `<div class="mat-sfx-card__badges">` +
      `<span class="mat-sfx-card__cat">効果音 / SFX</span>` +
      (item.is_free !== false ? `<span class="mat-sfx-card__free">無料</span>` : "") +
      `</div>` +
      `<div class="mat-sfx-card__player">` +
      `<button type="button" class="mat-sfx-card__play" data-sfx-play aria-label="再生">${icon("play")}</button>` +
      `<div class="mat-sfx-card__wave" aria-hidden="true">` +
      `<div class="mat-sfx-card__wave-bars">${waveBars(item.id)}</div>` +
      `<div class="mat-sfx-card__wave-progress" data-sfx-progress style="width:0%"></div>` +
      `</div>` +
      `<span class="mat-sfx-card__dur" data-sfx-duration>${escapeHtml(duration)}</span>` +
      `</div>` +
      `</div>` +
      `<div class="mat-sfx-card__body">` +
      `<h3 class="mat-sfx-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="mat-sfx-card__desc">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-sfx-card__tags">` +
      chipTags
        .map((t) => `<span class="mat-sfx-card__tag">${escapeHtml(chipDisplayLabel(t, formatSet))}</span>`)
        .join("") +
      `</div>` +
      `</div>` +
      `<div class="mat-sfx-card__foot">` +
      `<span class="mat-sfx-card__meta"><span class="mat-sfx-card__ico mat-sfx-card__ico--star" aria-hidden="true">${icon("star")}</span>${rating}</span>` +
      `<span class="mat-sfx-card__meta"><span class="mat-sfx-card__ico" aria-hidden="true">${icon("download")}</span>${dl}</span>` +
      `<div class="mat-sfx-card__actions">` +
      `<button type="button" class="mat-sfx-card__icon-btn${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}" title="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">` +
      `<span class="mat-sfx-card__ico" aria-hidden="true">${icon("heart")}</span>` +
      `</button>` +
      `<button type="button" class="mat-sfx-card__icon-btn mat-sfx-card__icon-btn--dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード" title="ダウンロード">` +
      `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
      `<span class="mat-sfx-card__ico" aria-hidden="true">${icon("download")}</span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  function applyFilters(items, filters) {
    const GF = genreFilter();
    return items.filter((item) => {
      if (filters.genre && !(GF && GF.matchGenre(item, "sfx", filters.genre))) return false;
      if (filters.usage && pickStr(item.use_case) !== filters.usage) return false;
      if (filters.format) {
        const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
        if (!formats.includes(String(filters.format).toUpperCase())) return false;
      }
      if (filters.tag) {
        const tags = (item.tags || []).map((t) => String(t));
        if (!tags.includes(filters.tag)) return false;
      }
      if (filters.length) {
        const sec = parseDurationToSec(resolveDurationLabel(item));
        if (durationBucket(sec) !== filters.length) return false;
      }
      if (filters.style) {
        if (resolveStyleKey(item) !== filters.style) return false;
      }
      return true;
    });
  }

  function collectFilterOptions(items) {
    const GF = genreFilter();
    const formats = new Map();
    const tags = new Map();
    const lengths = new Map();
    const styles = new Map();
    const usages = new Map();
    const genreCounts = GF ? GF.collectDemandCounts(items, "sfx") : {};
    items.forEach((item) => {
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        formats.set(key, (formats.get(key) || 0) + 1);
      });
      itemTags(item).forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
      const bucket = durationBucket(parseDurationToSec(resolveDurationLabel(item)));
      if (bucket) lengths.set(bucket, (lengths.get(bucket) || 0) + 1);
      const style = resolveStyleKey(item);
      if (style) styles.set(style, (styles.get(style) || 0) + 1);
      const usage = pickStr(item.use_case);
      if (usage) usages.set(usage, (usages.get(usage) || 0) + 1);
    });
    return { genreCounts, formats, tags, lengths, styles, usages };
  }

  function lengthLabel(bucket) {
    if (bucket === "0-3") return "〜3秒";
    if (bucket === "3-10") return "3〜10秒";
    if (bucket === "10+") return "10秒〜";
    return bucket;
  }

  function styleLabel(value) {
    const GF = genreFilter();
    const rows = GF?.PAYLOAD?.sfxStyles || [];
    const hit = rows.find((row) => row.id === value);
    return hit?.label || value;
  }

  function renderSelect(name, label, optionsMap, selected) {
    const entries = [...optionsMap.entries()];
    if (!entries.length) {
      return (
        `<select class="mat-sfx-filter" data-sfx-filter="${escapeHtml(name)}" disabled aria-label="${escapeHtml(label)}">` +
        `<option value="">${escapeHtml(label)}</option>` +
        `</select>`
      );
    }
    return (
      `<select class="mat-sfx-filter" data-sfx-filter="${escapeHtml(name)}" aria-label="${escapeHtml(label)}">` +
      `<option value="">${escapeHtml(label)}</option>` +
      entries
        .map(([value, count]) => {
          const text =
            name === "length"
              ? lengthLabel(value)
              : name === "tag"
                ? tagDisplayLabel(value)
                : name === "style"
                  ? styleLabel(value)
                  : value;
          const sel = selected === value ? " selected" : "";
          return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(text)} (${count})</option>`;
        })
        .join("") +
      `</select>`
    );
  }

  function renderPagination(page, totalPages) {
    if (totalPages <= 1) {
      return `<nav class="mat-sfx-pager" aria-label="ページネーション" data-sfx-pager></nav>`;
    }
    const buttons = [];
    buttons.push(
      `<button type="button" class="mat-sfx-pager__btn" data-sfx-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">${icon("chevronLeft")}</button>`
    );
    const pushPage = (p) => {
      buttons.push(
        `<button type="button" class="mat-sfx-pager__btn${p === page ? " is-active" : ""}" data-sfx-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`
      );
    };
    const windowSize = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      pushPage(1);
      if (start > 2) buttons.push(`<span class="mat-sfx-pager__ellipsis">…</span>`);
    }
    for (let p = start; p <= end; p += 1) pushPage(p);
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(`<span class="mat-sfx-pager__ellipsis">…</span>`);
      pushPage(totalPages);
    }
    buttons.push(
      `<button type="button" class="mat-sfx-pager__btn" data-sfx-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">${icon("chevronRight")}</button>`
    );
    return `<nav class="mat-sfx-pager" aria-label="ページネーション" data-sfx-pager>${buttons.join("")}</nav>`;
  }

  function listCategoryChips() {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    return Array.isArray(chips) ? chips : [];
  }

  function renderShell(opts) {
    const { q, sort, filters, options, resultCount, page, totalPages, cardsHtml, tagEntries } =
      opts;

    const activeChips = [{ key: "", label: "効果音 / SFX", removable: false }];
    if (sort === "newest") activeChips.push({ key: "sort", label: "新着順" });
    if (filters.genre) {
      const GF = genreFilter();
      activeChips.push({ key: "genre", label: (GF && GF.genreLabel("sfx", filters.genre)) || filters.genre });
    }
    if (filters.usage) activeChips.push({ key: "usage", label: filters.usage });
    if (filters.length) activeChips.push({ key: "length", label: lengthLabel(filters.length) });
    if (filters.style) activeChips.push({ key: "style", label: styleLabel(filters.style) });
    if (filters.format) activeChips.push({ key: "format", label: filters.format });
    if (filters.tag) activeChips.push({ key: "tag", label: tagDisplayLabel(filters.tag) });
    if (q) activeChips.push({ key: "q", label: `「${q}」` });

    const activeChipsHtml = activeChips
      .map((c) =>
        c.removable === false
          ? `<span class="mat-sfx-chip-active">${escapeHtml(c.label)}</span>`
          : `<span class="mat-sfx-chip-active mat-sfx-chip-active--muted">${escapeHtml(c.label)}<button type="button" class="mat-sfx-chip-active__x" data-sfx-remove-filter="${escapeHtml(c.key)}" aria-label="解除">${icon("close")}</button></span>`
      )
      .join("");

    const chips = listCategoryChips()
      .map((c) => {
        const active = c.id === "sfx";
        const href = c.id ? `list.html?category=${encodeURIComponent(c.id)}` : "list.html";
        return `<a class="mat-sfx-cat-chip${active ? " is-active" : ""}" href="${href}" ${active ? 'aria-current="true"' : ""}>${escapeHtml(c.label)}</a>`;
      })
      .join("");

    const popularTags = tagEntries
      .slice(0, 8)
      .map(
        ([tag, count]) =>
          `<button type="button" class="mat-sfx-popular-tag" data-sfx-tag="${escapeHtml(tag)}">${escapeHtml(tagDisplayLabel(tag))} <span>${count}</span></button>`
      )
      .join("");

    return (
      `<div class="mat-sfx-layout">` +
      `<div class="mat-sfx-main">` +
      (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
      `<div class="mat-sfx-head">` +
      `<h1 class="mat-sfx-head__title">素材一覧</h1>` +
      `<p class="mat-sfx-head__lead">高品質な無料素材をカテゴリやキーワードで探せます</p>` +
      `</div>` +
      `<form class="mat-sfx-search" data-sfx-search role="search">` +
      `<div class="mat-sfx-search__field">` +
      `<span class="mat-sfx-search__ico" aria-hidden="true">${icon("search")}</span>` +
      `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="キーワードで検索（例：インパクト、テロップ）" aria-label="キーワードで検索" data-sfx-q>` +
      `</div>` +
      `<button type="submit" class="mat-sfx-search__btn">検索</button>` +
      `<label class="mat-sfx-sort">` +
      `<span class="visually-hidden">並び順</span>` +
      `<select data-sfx-sort aria-label="並び順">` +
      `<option value="popular"${sort === "popular" ? " selected" : ""}>人気順</option>` +
      `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
      `</select>` +
      `</label>` +
      `</form>` +
      `<div class="mat-sfx-cat-chips mat-list-m-chips" data-sfx-chips>${chips}</div>` +
      `<div class="mat-sfx-filters mat-list-m-filters" data-sfx-filters>` +
      (genreFilter()?.renderGenreSelect?.({
        categoryId: "sfx",
        selected: filters.genre,
        counts: options.genreCounts,
        className: "mat-sfx-filter",
        dataAttr: "data-sfx-filter",
      }) || renderSelect("genre", "ジャンル", new Map(), filters.genre)) +
      renderSelect("usage", "用途", options.usages, filters.usage) +
      renderSelect("style", "スタイル", options.styles, filters.style) +
      renderSelect("length", "長さ", options.lengths, filters.length) +
      renderSelect("format", "形式", options.formats, filters.format) +
      `<button type="button" class="mat-sfx-clear" data-sfx-clear>すべてクリア</button>` +
      `<span class="mat-sfx-result-count" data-sfx-count>検索結果：${resultCount}件</span>` +
      `</div>` +
      (cardsHtml
        ? `<div class="mat-sfx-grid" data-sfx-grid>${cardsHtml}</div>`
        : `<p class="mat-sfx-empty">該当する素材がありません。</p>`) +
      renderPagination(page, totalPages) +
      `<div class="mat-sfx-promo" data-sfx-promo>` +
      `<div class="mat-sfx-promo__icon" aria-hidden="true">${icon("download")}</div>` +
      `<div class="mat-sfx-promo__body">` +
      `<h3>無料で使える高品質素材</h3>` +
      `<p>商用利用OK・クレジット表記不要の素材を無料でダウンロードできます。</p>` +
      `<p data-sfx-promo-guest-copy>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</p>` +
      `</div>` +
      `<a class="mat-sfx-promo__cta" data-sfx-promo-cta href="/login.html">無料会員登録する</a>` +
      `</div>` +
      `</div>` +
      `<aside class="mat-sfx-sidebar" aria-label="絞り込みサイドバー">` +
      `<div class="mat-sfx-side-card">` +
      `<h3 class="mat-sfx-side-card__title">現在の絞り込み</h3>` +
      `<div class="mat-sfx-side-active">${activeChipsHtml}` +
      `<button type="button" class="mat-sfx-side-clear" data-sfx-clear>すべてクリア <span aria-hidden="true">${icon("close")}</span></button>` +
      `</div>` +
      `</div>` +
      `<div class="mat-sfx-side-card">` +
      `<h3 class="mat-sfx-side-card__title">カテゴリ</h3>` +
      (global.TasuMaterialsListSidebar?.renderNav?.({ activeId: "sfx" }) || "") +
      `</div>` +
      (popularTags
        ? `<div class="mat-sfx-side-card">` +
          `<h3 class="mat-sfx-side-card__title">人気タグ</h3>` +
          `<div class="mat-sfx-popular-tags">${popularTags}</div>` +
          `<a class="mat-sfx-side-alltags" href="list.html?category=sfx">すべてのタグを見る</a>` +
          `</div>`
        : "") +
      `<div class="mat-sfx-side-card mat-sfx-side-card--fav">` +
      `<div class="mat-sfx-side-fav">` +
      `<div class="mat-sfx-side-fav__icon" aria-hidden="true">${icon("heart")}</div>` +
      `<div>` +
      `<h3 class="mat-sfx-side-card__title">お気に入りに保存</h3>` +
      `<p>気になる素材を保存して後からまとめてダウンロードできます</p>` +
      `</div>` +
      `</div>` +
      `<a class="mat-sfx-side-fav__link" href="/materials/mypage.html#favorites">ダッシュボードのお気に入り</a>` +
      `</div>` +
      `</aside>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  async function loadBaseItems(urlState) {
    const repo = global.TasuMaterialsData?.repository;
    if (!repo) return [];
    let items;
    if (urlState.q) {
      items = await repo.searchItems(urlState.q);
      items = (items || []).filter((i) => i.category_id === "sfx");
      if (urlState.sort === "newest") {
        items = items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      } else {
        items = items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
      }
    } else {
      const sort = urlState.sort === "newest" ? "newest" : "popular";
      items = await repo.fetchAllItems(sort);
      items = (items || []).filter((i) => i.category_id === "sfx");
    }
    return (items || []).map((raw) => enrichItem(raw));
  }

  function wireInteractions(root, allItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(allItems.map((i) => [i.id, i]));

    root.querySelector("[data-sfx-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-sfx-q]")?.value || "";
      const next = { ...urlState, q: String(q).trim(), page: 1 };
      writeUrlState(next, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-sfx-sort]")?.addEventListener("change", (ev) => {
      const sort = ev.target.value === "newest" ? "newest" : "popular";
      writeUrlState({ ...urlState, sort, page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-sfx-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = {
          ...urlState,
          genre: root.querySelector('[data-sfx-filter="genre"]')?.value || "",
          usage: root.querySelector('[data-sfx-filter="usage"]')?.value || "",
          length: root.querySelector('[data-sfx-filter="length"]')?.value || "",
          style: root.querySelector('[data-sfx-filter="style"]')?.value || "",
          format: root.querySelector('[data-sfx-filter="format"]')?.value || "",
          tag: urlState.tag || "",
          page: 1,
        };
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-sfx-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState({ q: "", sort: "popular", genre: "", usage: "", length: "", style: "", format: "", tag: "", page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-sfx-remove-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-sfx-remove-filter") || "";
        const next = { ...urlState, page: 1 };
        if (key === "sort") next.sort = "popular";
        else if (key === "q") next.q = "";
        else if (key === "genre" || key === "usage" || key === "length" || key === "style" || key === "format" || key === "tag") next[key] = "";
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-sfx-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-sfx-tag") || "";
        writeUrlState({ ...urlState, tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-sfx-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-sfx-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-sfx-page") || 1);
      if (!Number.isFinite(page) || page < 1) return;
      writeUrlState({ ...urlState, page }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-sfx-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;

      card.querySelector("[data-sfx-play]")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        togglePlay(item, card);
      });

      Download?.wireDownloadAndFavorite?.(card, item);

      const favBtn = card.querySelector("[data-mat-favorite-btn]");
      Fav?.updateButton?.(favBtn, item);
      if (favBtn) {
        const syncFavTitle = () => {
          favBtn.setAttribute("title", favBtn.getAttribute("aria-label") || "お気に入りに追加");
        };
        syncFavTitle();
        favBtn.addEventListener("click", () => {
          setTimeout(syncFavTitle, 0);
        });
      }
    });

    applyPromoAuth(root);
  }

  async function applyPromoAuth(root) {
    const cta = root?.querySelector("[data-sfx-promo-cta]");
    if (!cta) return;
    const Member = global.TasuMaterialsMemberAccess;
    let authed = Boolean(Member?.isAuthenticatedSync?.());
    if (!authed && Member?.isAuthenticated) {
      try {
        authed = Boolean(await Member.isAuthenticated());
      } catch {
        authed = false;
      }
    }
    if (!authed) return;
    const guestCopy = root.querySelector("[data-sfx-promo-guest-copy]");
    if (guestCopy) guestCopy.hidden = true;
    cta.textContent = "マイページを見る";
    cta.setAttribute("href", "/materials/mypage");
    cta.setAttribute("data-sfx-promo-member", "1");
  }

  async function refresh() {
    const classic = document.querySelector("[data-materials-list-classic]");
    const root = document.querySelector("[data-materials-list-sfx]");
    if (!root) return;

    showSfxRoot(root, classic);
    const bgmRoot = document.querySelector("[data-materials-list-bgm]");
    if (bgmRoot) {
      bgmRoot.hidden = true;
      bgmRoot.innerHTML = "";
    }
    global.TasuMaterialsBgmList?.stopAudio?.();

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* optional */
    }

    const urlState = readUrlState();
    const baseItems = await loadBaseItems(urlState);
    const filters = {
      genre: urlState.genre,
      usage: urlState.usage,
      length: urlState.length,
      style: urlState.style,
      format: urlState.format,
      tag: urlState.tag,
    };
    const options = collectFilterOptions(baseItems);
    const filtered = applyFilters(baseItems, filters);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = Math.min(urlState.page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);
    const tagEntries = [...options.tags.entries()].sort((a, b) => b[1] - a[1]);

    stopAudio();
    root.innerHTML = renderShell({
      q: urlState.q,
      sort: urlState.sort,
      filters,
      options,
      resultCount: filtered.length,
      page,
      totalPages,
      cardsHtml: pageItems.map(renderCard).join(""),
      tagEntries,
    });

    state = { items: filtered, page, filters, sort: urlState.sort, q: urlState.q };
    wireInteractions(root, pageItems, { ...urlState, page });

    try {
      const q = String(urlState.q || "").trim();
      if (q.length >= 2) {
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, {
            category_id: "sfx",
            result_count: filtered.length,
          })
        ).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  function hide() {
    stopAudio();
    const classic = document.querySelector("[data-materials-list-classic]");
    const root = document.querySelector("[data-materials-list-sfx]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const otherOn =
      (document.querySelector("[data-materials-list-bgm]") && !document.querySelector("[data-materials-list-bgm]").hidden) ||
      (document.querySelector("[data-materials-list-image]") && !document.querySelector("[data-materials-list-image]").hidden) ||
      (document.querySelector("[data-materials-list-illustration]") && !document.querySelector("[data-materials-list-illustration]").hidden) ||
      (document.querySelector("[data-materials-list-background]") && !document.querySelector("[data-materials-list-background]").hidden) ||
      (document.querySelector("[data-materials-list-icon]") && !document.querySelector("[data-materials-list-icon]").hidden) ||
      (document.querySelector("[data-materials-list-web]") && !document.querySelector("[data-materials-list-web]").hidden) ||
      (document.querySelector("[data-materials-list-code]") && !document.querySelector("[data-materials-list-code]").hidden) ||
      (document.querySelector("[data-materials-list-document]") && !document.querySelector("[data-materials-list-document]").hidden) ||
      (document.querySelector("[data-materials-list-presentation]") && !document.querySelector("[data-materials-list-presentation]").hidden) ||
      (document.querySelector("[data-materials-list-template]") && !document.querySelector("[data-materials-list-template]").hidden);
    if (classic && !otherOn) {
      classic.hidden = false;
      classic.removeAttribute("aria-hidden");
      if ("inert" in classic) classic.inert = false;
    }
  }

  function showSfxRoot(root, classic) {
    if (classic) {
      classic.hidden = true;
      classic.setAttribute("aria-hidden", "true");
      if ("inert" in classic) classic.inert = true;
    }
    root.hidden = false;
    root.removeAttribute("aria-hidden");
    if ("inert" in root) root.inert = false;
  }

  function isActive() {
    const params = new URLSearchParams(global.location.search);
    return params.get("category") === "sfx";
  }

  async function mount() {
    if (!isActive()) {
      hide();
      return false;
    }
    global.TasuMaterialsBgmList?.hide?.();
    global.TasuMaterialsBgmList?.stopAudio?.();
    global.TasuMaterialsImageList?.hide?.();
    global.TasuMaterialsIllustrationList?.hide?.();
    global.TasuMaterialsBackgroundList?.hide?.();
    global.TasuMaterialsIconList?.hide?.();
    await refresh();
    return true;
  }

  
  function wireCard(card, item) {
    if (!card || !item) return;
    card.querySelector("[data-sfx-play]")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      togglePlay(item, card);
    });
    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, item);
    const Fav = global.TasuMaterialsFavorites;
    const favBtn = card.querySelector("[data-mat-favorite-btn]");
    Fav?.updateButton?.(favBtn, item);
  }

  global.TasuMaterialsSfxList = {
    renderCard,
    wireCard,
    
    mount,
    refresh,
    hide,
    isActive,
    stopAudio,
  };
})(typeof window !== "undefined" ? window : globalThis);
