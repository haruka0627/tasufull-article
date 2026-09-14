/**
 * TASFUL Materials — BGM一覧（Screenshot-to-Code 正本の完全移植）
 * category=bgm のみ。STC DOM/CSS をそのまま採用し、既存 Contract のみ再接続。
 * 他カテゴリ UI・TOP・マイページ・BGM詳細は変更しない。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const GENERIC_TAGS = new Set(["bgm", "wav", "mp3", "audio", "音楽"]);

  const MOOD_HINTS = /爽やか|穏やか|クール|癒し|明るい|壮大|おしゃれ|ポジティブ|幻想|リラックス|静か|夜|やさしい|日常|疾走感/;
  const TEMPO_HINTS = /テンポ|アップ|スロー|ゆったり|疾走|ビート|リズム/;
  const GENRE_HINTS = /ピアノ|アコースティック|エレクトロ|ローファイ|ビジネス|カフェ|企業|Vlog|ストリングス|アンビエント|テクノ|ジャズ|ロック/;

  /** @type {HTMLAudioElement | null} */
  let sharedAudio = null;
  /** @type {string} */
  let playingId = "";

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
    const num = Number(n) || 0;
    if (num >= 10000) return `${(num / 10000).toFixed(1).replace(/\.0$/, "")}万`;
    if (num >= 1000) return num.toLocaleString("en-US");
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

  function lengthLabel(bucket) {
    if (bucket === "0-3") return "〜3秒";
    if (bucket === "3-10") return "3〜10秒";
    if (bucket === "10+") return "10秒〜";
    return bucket;
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
      vlog: "Vlog",
      corporate: "企業 / ビジネス",
      cafe: "カフェ",
    };
    const key = String(sub || "").toLowerCase();
    return map[key] || (sub ? String(sub) : "");
  }

  function tagDisplayLabel(tag) {
    return String(tag ?? "").trim();
  }

  function itemTags(item) {
    return (item.tags || []).filter((t) => !GENERIC_TAGS.has(String(t).toLowerCase()));
  }

  function classifyTag(tag) {
    const t = String(tag || "");
    if (TEMPO_HINTS.test(t)) return "tempo";
    if (GENRE_HINTS.test(t)) return "genre";
    if (MOOD_HINTS.test(t)) return "mood";
    return "mood";
  }

  function seedFromId(id) {
    const s = String(id || "bgm");
    let n = 0;
    for (let i = 0; i < s.length; i += 1) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    return (n % 97) + 1;
  }

  /** STC wave(seed) をそのまま移植 */
  function waveHtml(seed) {
    let s = Number(seed) * 9973;
    let out = "";
    for (let i = 0; i < 110; i += 1) {
      s = (s * 1103515245 + 12345) % 2147483648;
      const r = s / 2147483648;
      const env = Math.sin((i / 110) * Math.PI);
      const h = Math.max(3, (0.25 + r * 0.75) * 30 * (0.4 + env * 0.8));
      out += `<span style="height:${Math.min(h, 32).toFixed(1)}px"></span>`;
    }
    return out;
  }

  function playIconHtml(playing) {
    if (playing) return `<i class="fas fa-pause text-[13px]"></i>`;
    return `<i class="fas fa-play text-[13px] ml-0.5"></i>`;
  }

  function heartIconHtml(on) {
    return on ? `<i class="fas fa-heart"></i>` : `<i class="far fa-heart"></i>`;
  }

  function readUrlState() {
    const params = new URLSearchParams(global.location.search);
    const sortRaw = params.get("sort") || "popular";
    const sort = sortRaw === "newest" ? "newest" : sortRaw === "downloads" ? "downloads" : "popular";
    return {
      q: params.get("q") || "",
      sort,
      usage: params.get("usage") || "",
      length: params.get("length") || "",
      format: params.get("format") || "",
      genre: params.get("genre") || "",
      mood: params.get("mood") || "",
      tag: params.get("tag") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeUrlState(next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", "bgm");
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("usage", next.usage);
    setOrDel("length", next.length);
    setOrDel("format", next.format);
    setOrDel("genre", next.genre);
    setOrDel("mood", next.mood);
    setOrDel("tag", next.tag);
    setOrDel("page", next.page > 1 ? String(next.page) : "");
    if (replace) global.history.replaceState({ materialsBgmList: true }, "", url);
    else global.history.pushState({ materialsBgmList: true }, "", url);
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
    document.querySelectorAll("[data-bgm-card].is-playing").forEach((el) => {
      el.classList.remove("is-playing");
      const btn = el.querySelector("[data-bgm-play]");
      if (btn) {
        btn.setAttribute("aria-label", "再生");
        btn.innerHTML = playIconHtml(false);
      }
    });
  }

  function ensureAudio() {
    if (!sharedAudio) {
      sharedAudio = new global.Audio();
      sharedAudio.preload = "metadata";
      sharedAudio.addEventListener("ended", () => {
        const id = playingId;
        stopAudio();
        const card = document.querySelector(`[data-bgm-card][data-item-id="${CSS.escape(id)}"]`);
        const btn = card?.querySelector("[data-bgm-play]");
        if (btn) {
          btn.setAttribute("aria-label", "再生");
          btn.innerHTML = playIconHtml(false);
        }
      });
      sharedAudio.addEventListener("loadedmetadata", () => {
        if (!playingId || !sharedAudio) return;
        const card = document.querySelector(`[data-bgm-card][data-item-id="${CSS.escape(playingId)}"]`);
        const durEl = card?.querySelector("[data-bgm-duration]");
        const dur = sharedAudio.duration;
        if (durEl && Number.isFinite(dur) && dur > 0) {
          const label = formatDurationSec(dur);
          durEl.textContent = label;
          card.querySelectorAll("[data-bgm-duration]").forEach((el) => {
            el.textContent = label;
          });
        }
      });
    }
    return sharedAudio;
  }

  async function togglePlay(item, card) {
    const src = resolveAudioSrc(item);
    if (!src) return;
    global.TasuMaterialsSfxList?.stopAudio?.();
    const audio = ensureAudio();
    const id = String(item.id);

    if (playingId === id && !audio.paused) {
      audio.pause();
      card.classList.remove("is-playing");
      const btn = card.querySelector("[data-bgm-play]");
      if (btn) {
        btn.setAttribute("aria-label", "再生");
        btn.innerHTML = playIconHtml(false);
      }
      return;
    }

    if (playingId && playingId !== id) stopAudio();

    if (audio.src !== new URL(src, global.location.origin).href) {
      audio.src = src;
    }
    playingId = id;
    card.classList.add("is-playing");
    const btn = card.querySelector("[data-bgm-play]");
    if (btn) {
      btn.setAttribute("aria-label", "一時停止");
      btn.innerHTML = playIconHtml(true);
    }
    try {
      await audio.play();
    } catch (err) {
      console.warn("[Materials BGM] play failed", err);
      stopAudio();
    }
  }

  function renderCard(item) {
    const Fav = global.TasuMaterialsFavorites;
    const href = `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
    const tags = itemTags(item).slice(0, 4);
    const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
    const formatLabel = formats[0] || "MP3";
    const duration = resolveDurationLabel(item) || "—";
    const rating = Number(item.rating || 0) > 0 ? Number(item.rating).toFixed(1) : "—";
    const dl = formatCount(item.download_count);
    const favOn = Boolean(Fav?.isFavorited?.(item.id));
    const desc = item.description || "";

    return (
      `<div class="bg-white border border-slate-200 rounded-xl p-5 relative" data-bgm-card data-item-id="${escapeHtml(item.id)}" data-slug="${escapeHtml(item.slug || "")}">` +
      `<div class="flex justify-between mb-3">` +
      `<span class="bg-blue-600 text-white text-[10px] font-bold rounded px-2 py-1">BGM</span>` +
      (item.is_free !== false
        ? `<span class="bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded px-2 py-1">無料</span>`
        : `<span></span>`) +
      `</div>` +
      `<div class="flex items-center gap-4 mb-4">` +
      `<button type="button" class="w-11 h-11 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0" data-bgm-play aria-label="再生">${playIconHtml(false)}</button>` +
      `<div class="wave" aria-hidden="true">${waveHtml(seedFromId(item.id))}</div>` +
      `<span class="text-[12px] text-slate-500 shrink-0" data-bgm-duration>${escapeHtml(duration)}</span>` +
      `</div>` +
      `<h3 class="font-bold text-[15px] mb-1"><a class="mat-bgm-title-link" href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="text-[12px] text-slate-500 mb-3">${escapeHtml(desc)}</p>` +
      `<div class="flex flex-wrap gap-2 mb-4">` +
      tags.map((t) => `<span class="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] rounded px-2 py-1">${escapeHtml(tagDisplayLabel(t))}</span>`).join("") +
      `</div>` +
      `<div class="flex items-center gap-5 text-[12px] text-slate-500">` +
      `<span><i class="fas fa-star text-amber-400"></i> ${escapeHtml(rating)}</span>` +
      `<span><i class="fas fa-arrow-down text-slate-400"></i> ${escapeHtml(dl)}</span>` +
      `<span><i class="far fa-clock text-slate-400"></i> <span data-bgm-duration>${escapeHtml(duration)}</span></span>` +
      `<span><i class="fas fa-file-audio text-slate-400"></i> ${escapeHtml(formatLabel)}</span>` +
      `<div class="ml-auto flex gap-2">` +
      `<button type="button" class="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 flex items-center justify-center${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">${heartIconHtml(favOn)}</button>` +
      `<button type="button" class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード"><span class="visually-hidden" data-mat-download-label>ダウンロード</span><i class="fas fa-download text-[13px]"></i></button>` +
      `</div>` +
      `</div>` +
      `</div>`
    );
  }

  function applyFilters(items, filters) {
    const GF = global.TasuMaterialsGenreFilter;
    return items.filter((item) => {
      if (filters.genre) {
        if (GF?.matchListGenre) {
          if (!GF.matchListGenre(item, "bgm", filters.genre)) return false;
        } else if (GF?.matchGenre) {
          if (!GF.matchGenre(item, "bgm", filters.genre)) return false;
        } else {
          return false;
        }
      }
      if (filters.usage) return false;
      if (filters.format) {
        const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
        if (!formats.includes(String(filters.format).toUpperCase())) return false;
      }
      if (filters.mood) {
        const tags = (item.tags || []).map((t) => String(t));
        if (!tags.includes(filters.mood)) return false;
      }
      if (filters.tag) {
        const tags = (item.tags || []).map((t) => String(t));
        if (!tags.includes(filters.tag)) return false;
      }
      if (filters.length) {
        const sec = parseDurationToSec(resolveDurationLabel(item));
        if (durationBucket(sec) !== filters.length) return false;
      }
      return true;
    });
  }

  function collectFilterOptions(items) {
    const usage = new Map();
    const formats = new Map();
    const moods = new Map();
    const tempos = new Map();
    const genres = new Map();
    const lengths = new Map();
    items.forEach((item) => {
      const sub = pickStr(item.subcategory);
      if (sub) usage.set(sub, (usage.get(sub) || 0) + 1);
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        formats.set(key, (formats.get(key) || 0) + 1);
      });
      itemTags(item).forEach((t) => {
        const bucket = classifyTag(t);
        const map = bucket === "tempo" ? tempos : bucket === "genre" ? genres : moods;
        map.set(t, (map.get(t) || 0) + 1);
      });
      const bucket = durationBucket(parseDurationToSec(resolveDurationLabel(item)));
      if (bucket) lengths.set(bucket, (lengths.get(bucket) || 0) + 1);
    });
    const GF = global.TasuMaterialsGenreFilter;
    const genreCounts = GF?.collectDemandCounts ? GF.collectDemandCounts(items, "bgm") : {};
    return { usage, formats, moods, tempos, genres, lengths, genreCounts };
  }

  function renderSelect(name, label, optionsMap, selected) {
    const entries = [...optionsMap.entries()];
    const disabled = !entries.length ? " disabled" : "";
    return (
      `<div class="relative mat-list-m-filter-cell">` +
      `<select class="appearance-none bg-white border border-slate-200 rounded-lg h-9 pl-4 pr-9 text-[12px] focus:outline-none" data-bgm-filter="${escapeHtml(name)}" aria-label="${escapeHtml(label)}"${disabled}>` +
      `<option value="">${escapeHtml(label)}</option>` +
      entries
        .map(([value, count]) => {
          const text =
            name === "usage"
              ? usageLabel(value) || value
              : name === "length"
                ? lengthLabel(value)
                : tagDisplayLabel(value);
          const sel = selected === value ? " selected" : "";
          return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(text)}（${count}）</option>`;
        })
        .join("") +
      `</select>` +
      `<i class="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>` +
      `</div>`
    );
  }

  function renderPagination(page, totalPages) {
    if (totalPages <= 1) {
      return `<div class="flex justify-center items-center gap-2 mt-8 text-[13px]" data-bgm-pager aria-label="ページネーション"></div>`;
    }
    const buttons = [];
    buttons.push(
      `<button type="button" class="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-400" data-bgm-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ"><i class="fas fa-chevron-left text-[11px]"></i></button>`
    );
    const pushPage = (p) => {
      const active = p === page;
      buttons.push(
        `<button type="button" class="w-9 h-9 rounded-lg ${active ? "bg-blue-600 text-white font-bold" : "bg-white border border-slate-200"}" data-bgm-page="${p}" ${active ? 'aria-current="page"' : ""}>${p}</button>`
      );
    };
    const windowSize = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      pushPage(1);
      if (start > 2) buttons.push(`<span class="w-9 h-9 flex items-center justify-center text-slate-400">…</span>`);
    }
    for (let p = start; p <= end; p += 1) pushPage(p);
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(`<span class="w-9 h-9 flex items-center justify-center text-slate-400">…</span>`);
      pushPage(totalPages);
    }
    buttons.push(
      `<button type="button" class="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-500" data-bgm-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ"><i class="fas fa-chevron-right text-[11px]"></i></button>`
    );
    return `<div class="flex justify-center items-center gap-2 mt-8 text-[13px]" data-bgm-pager aria-label="ページネーション">${buttons.join("")}</div>`;
  }

  function listCategoryChips() {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    return Array.isArray(chips) ? chips : [];
  }

  function sortLabel(sort) {
    if (sort === "newest") return "新着順";
    if (sort === "downloads") return "ダウンロード順";
    return "人気順";
  }

  function renderShell(opts) {
    const { q, sort, filters, options, resultCount, page, totalPages, cardsHtml, moodEntries } = opts;

    const chips = listCategoryChips().map((c) => {
      const active = c.id === "bgm";
      const href = c.id ? `list.html?category=${encodeURIComponent(c.id)}` : "list.html";
      return `<a href="${href}" class="text-[13px] rounded-full px-4 py-2 border ${active ? "bg-blue-50 border-blue-500 text-blue-600 font-medium" : "bg-white border-slate-200 text-slate-600"}" ${active ? 'aria-current="true"' : ""}>${escapeHtml(c.label)}</a>`;
    }).join("");

    const activeFilterChips = [];
    activeFilterChips.push(
      `<span class="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[12px] font-medium rounded-md px-3 py-1.5">BGM</span>`
    );
    if (sort && sort !== "popular") {
      activeFilterChips.push(
        `<span class="inline-flex items-center gap-2 bg-rose-50 text-rose-500 text-[12px] font-medium rounded-md px-3 py-1.5">${escapeHtml(sortLabel(sort))} <button type="button" data-bgm-remove-filter="sort" aria-label="解除"><i class="fas fa-times text-[10px]"></i></button></span>`
      );
    } else {
      activeFilterChips.push(
        `<span class="inline-flex items-center gap-2 bg-rose-50 text-rose-500 text-[12px] font-medium rounded-md px-3 py-1.5">人気順</span>`
      );
    }
    if (filters.genre) {
      const GF = global.TasuMaterialsGenreFilter;
      activeFilterChips.push(
        `<span class="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[12px] font-medium rounded-md px-3 py-1.5">${escapeHtml((GF && GF.genreLabel("bgm", filters.genre)) || filters.genre)} <button type="button" data-bgm-remove-filter="genre" aria-label="解除"><i class="fas fa-times text-[10px]"></i></button></span>`
      );
    }
    if (filters.usage) {
      activeFilterChips.push(
        `<span class="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[12px] font-medium rounded-md px-3 py-1.5">${escapeHtml(usageLabel(filters.usage) || filters.usage)} <button type="button" data-bgm-remove-filter="usage" aria-label="解除"><i class="fas fa-times text-[10px]"></i></button></span>`
      );
    }
    if (filters.length) {
      activeFilterChips.push(
        `<span class="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[12px] font-medium rounded-md px-3 py-1.5">${escapeHtml(lengthLabel(filters.length))} <button type="button" data-bgm-remove-filter="length" aria-label="解除"><i class="fas fa-times text-[10px]"></i></button></span>`
      );
    }
    if (filters.format) {
      activeFilterChips.push(
        `<span class="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[12px] font-medium rounded-md px-3 py-1.5">${escapeHtml(filters.format)} <button type="button" data-bgm-remove-filter="format" aria-label="解除"><i class="fas fa-times text-[10px]"></i></button></span>`
      );
    }
    if (filters.tag) {
      activeFilterChips.push(
        `<span class="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[12px] font-medium rounded-md px-3 py-1.5">${escapeHtml(tagDisplayLabel(filters.tag))} <button type="button" data-bgm-remove-filter="tag" aria-label="解除"><i class="fas fa-times text-[10px]"></i></button></span>`
      );
    }
    if (q) {
      activeFilterChips.push(
        `<span class="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[12px] font-medium rounded-md px-3 py-1.5">「${escapeHtml(q)}」 <button type="button" data-bgm-remove-filter="q" aria-label="解除"><i class="fas fa-times text-[10px]"></i></button></span>`
      );
    }

    const moodSelected = filters.tag && options.moods.has(filters.tag) ? filters.tag : "";
    const tempoSelected = filters.tag && options.tempos.has(filters.tag) ? filters.tag : "";
    const genreSelected = filters.tag && options.genres.has(filters.tag) ? filters.tag : "";

    const moodsHtml = moodEntries
      .slice(0, 8)
      .map(
        ([m, n]) =>
          `<button type="button" class="bg-blue-50/60 text-blue-600 text-[12px] rounded-md px-3 py-1.5" data-bgm-tag="${escapeHtml(m)}">${escapeHtml(tagDisplayLabel(m))} <span class="text-blue-400">${n}</span></button>`
      )
      .join("");

    return (
      `<div class="max-w-[1500px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start" data-bgm-list>` +
      `<div>` +
      (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
      `<div class="flex items-end gap-4 mb-6">` +
      `<h1 class="text-[30px] font-black tracking-tight">BGM一覧</h1>` +
      `<p class="text-[13px] text-slate-500 mb-1.5">商用利用OKのBGMを用途や雰囲気から探せます</p>` +
      `</div>` +
      `<form class="flex flex-wrap items-center gap-3 mb-5" data-bgm-search role="search">` +
      `<div class="relative flex-1 min-w-[280px] max-w-[650px]">` +
      `<i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[13px]"></i>` +
      `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="キーワードで検索（例：癒し、ピアノ、エンディング）" class="w-full bg-white border border-slate-200 rounded-lg h-[42px] pl-10 pr-4 text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" data-bgm-q aria-label="BGMを検索">` +
      `</div>` +
      `<button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-lg px-8 h-[42px]">検索</button>` +
      `<div class="ml-auto relative">` +
      `<select class="appearance-none bg-white border border-slate-200 rounded-lg h-[42px] pl-6 pr-12 text-[13px] focus:outline-none" data-bgm-sort aria-label="並び替え">` +
      `<option value="popular"${sort === "popular" ? " selected" : ""}>人気順</option>` +
      `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
      `<option value="downloads"${sort === "downloads" ? " selected" : ""}>ダウンロード順</option>` +
      `</select>` +
      `<i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] pointer-events-none"></i>` +
      `</div>` +
      `</form>` +
      `<div class="flex flex-wrap gap-2 mb-4 mat-list-m-chips" data-bgm-chips>${chips}</div>` +
      `<div class="flex flex-wrap items-center gap-2 mb-6 mat-list-m-filters">` +
      `<div class="flex flex-wrap gap-2" data-bgm-filters>` +
      (global.TasuMaterialsGenreFilter?.renderGenreSelect?.({
        categoryId: "bgm",
        selected: filters.genre,
        counts: options.genreCounts || {},
        className: "appearance-none bg-white border border-slate-200 rounded-lg h-9 pl-4 pr-9 text-[12px] focus:outline-none",
        dataAttr: "data-bgm-filter",
        includeZero: true,
        label: "ジャンル",
        wrapTag: "div",
        wrapClass: "relative mat-list-m-filter-cell",
      }) || renderSelect("genre", "ジャンル", new Map(), filters.genre)) +
      renderSelect("usage", "用途", new Map(), filters.usage) +
      renderSelect("mood", "雰囲気", options.moods, filters.mood) +
      renderSelect("length", "長さ", options.lengths, filters.length) +
      renderSelect("format", "形式", options.formats, filters.format) +
      `</div>` +
      `<button type="button" class="text-[12px] text-slate-500 ml-2 hover:text-slate-700" data-bgm-clear>すべてクリア</button>` +
      `<span class="ml-auto text-[12px] text-slate-500" data-bgm-count>検索結果：${resultCount}件</span>` +
      `</div>` +
      (cardsHtml
        ? `<div class="grid grid-cols-1 xl:grid-cols-2 gap-5" data-bgm-grid>${cardsHtml}</div>`
        : `<p class="materials-list-empty">該当する素材がありません。</p>`) +
      renderPagination(page, totalPages) +
      `<div class="mt-8 bg-blue-50/70 border border-blue-100 rounded-xl p-7 flex flex-wrap items-center gap-6" data-bgm-promo>` +
      `<div class="w-14 h-14 rounded-xl bg-white flex items-center justify-center shadow-sm">` +
      `<i class="fas fa-music text-violet-500 text-xl"></i>` +
      `</div>` +
      `<div>` +
      `<h3 class="font-bold text-[17px] mb-1.5">高品質なBGMを無料でダウンロード</h3>` +
      `<p class="text-[13px] text-slate-600 leading-6">商用利用OK・クレジット表記不要のBGMを無料でダウンロードできます。<br><span data-bgm-promo-guest-copy>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</span></p>` +
      `</div>` +
      `<a href="/login.html" class="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-lg px-7 py-3.5" data-bgm-promo-cta>無料会員登録する</a>` +
      `</div>` +
      `</div>` +
      `<aside class="space-y-5" aria-label="BGMサイドバー">` +
      `<div class="bg-white border border-slate-200 rounded-xl p-5">` +
      `<h3 class="text-[13px] font-bold mb-4">現在の絞り込み</h3>` +
      `<div class="flex flex-wrap items-center gap-2">${activeFilterChips.join("")}` +
      `<button type="button" class="ml-auto text-[12px] border border-slate-200 rounded-md px-3 py-1.5 text-slate-600" data-bgm-clear>すべてクリア</button>` +
      `</div>` +
      `</div>` +
      `<div class="bg-white border border-slate-200 rounded-xl p-5">` +
      `<h3 class="text-[13px] font-bold mb-3">カテゴリ</h3>` +
      (global.TasuMaterialsListSidebar?.renderNav?.({ activeId: "bgm" }) || "") +
      `</div>` +
      `<div class="bg-white border border-slate-200 rounded-xl p-5">` +
      `<h3 class="text-[13px] font-bold mb-4">人気の雰囲気</h3>` +
      `<div class="flex flex-wrap gap-2">${moodsHtml || `<span class="text-[12px] text-slate-400">まだありません</span>`}</div>` +
      `<a href="list.html?category=bgm" class="block text-right text-[12px] text-blue-600 mt-4">すべての雰囲気を見る <i class="fas fa-chevron-right text-[9px]"></i></a>` +
      `</div>` +
      `<div class="bg-white border border-slate-200 rounded-xl p-5">` +
      `<div class="flex gap-3">` +
      `<div class="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0"><i class="fas fa-heart text-rose-500 text-sm"></i></div>` +
      `<div>` +
      `<h3 class="text-[15px] font-bold mb-1.5">お気に入りに保存</h3>` +
      `<p class="text-[12px] text-slate-500 leading-5">気になる素材を保存して<br>後からまとめてダウンロードできます</p>` +
      `</div>` +
      `</div>` +
      `<div class="flex gap-3 mt-4">` +
      `<div class="w-9 h-9 rounded-lg bg-slate-100 shrink-0"></div>` +
      `<a href="/materials/mypage.html#favorites" class="flex-1 border border-slate-200 rounded-lg py-2.5 text-[12px] font-medium text-slate-700 text-center">使い方を見る</a>` +
      `</div>` +
      `</div>` +
      `</aside>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function sortItems(items, sort) {
    if (sort === "newest") {
      return items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
    }
    // popular / downloads — 既存 popular と同じ download_count 順
    return items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
  }

  async function loadBaseItems(urlState) {
    const repo = global.TasuMaterialsData?.repository;
    if (!repo) return [];
    let items;
    if (urlState.q) {
      items = await repo.searchItems(urlState.q);
      items = (items || []).filter((i) => i.category_id === "bgm");
    } else {
      const sortKey = urlState.sort === "newest" ? "newest" : "popular";
      items = await repo.fetchAllItems(sortKey);
      items = (items || []).filter((i) => i.category_id === "bgm");
    }
    items = (items || []).map((raw) => enrichItem(raw));
    return sortItems(items, urlState.sort);
  }

  function readFiltersFromRoot(root, urlState) {
    const usage = root.querySelector('[data-bgm-filter="usage"]')?.value || "";
    const length = root.querySelector('[data-bgm-filter="length"]')?.value || "";
    const format = root.querySelector('[data-bgm-filter="format"]')?.value || "";
    const mood = root.querySelector('[data-bgm-filter="mood"]')?.value || "";
    const genre = root.querySelector('[data-bgm-filter="genre"]')?.value || "";
    return { ...urlState, usage, length, format, mood, genre, tag: "", page: 1 };
  }

  function wireInteractions(root, pageItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(pageItems.map((i) => [i.id, i]));
    const listRoot = root.querySelector("[data-bgm-list]") || root;

    listRoot.querySelector("[data-bgm-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = listRoot.querySelector("[data-bgm-q]")?.value || "";
      writeUrlState({ ...urlState, q: String(q).trim(), page: 1 }, false);
      refresh().catch(() => {});
    });

    listRoot.querySelector("[data-bgm-sort]")?.addEventListener("change", (ev) => {
      const v = ev.target.value;
      const sort = v === "newest" ? "newest" : v === "downloads" ? "downloads" : "popular";
      writeUrlState({ ...urlState, sort, page: 1 }, false);
      refresh().catch(() => {});
    });

    listRoot.querySelectorAll("[data-bgm-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = readFiltersFromRoot(listRoot, urlState);
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    listRoot.querySelectorAll("[data-bgm-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState({ q: "", sort: "popular", genre: "", usage: "", length: "", format: "", mood: "", tag: "", page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    listRoot.querySelectorAll("[data-bgm-remove-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-bgm-remove-filter") || "";
        const next = { ...urlState, page: 1 };
        if (key === "sort") next.sort = "popular";
        else if (key === "q") next.q = "";
        else if (key === "length" || key === "format" || key === "tag" || key === "mood" || key === "genre") next[key] = "";
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    listRoot.querySelectorAll("[data-bgm-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-bgm-tag") || "";
        writeUrlState({ ...urlState, tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    listRoot.querySelector("[data-bgm-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-bgm-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-bgm-page") || 1);
      if (!Number.isFinite(page) || page < 1) return;
      writeUrlState({ ...urlState, page }, false);
      refresh().catch(() => {});
    });

    listRoot.querySelectorAll("[data-bgm-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;

      card.querySelector("[data-bgm-play]")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        togglePlay(item, card);
      });

      Download?.wireDownloadAndFavorite?.(card, item);

      const favBtn = card.querySelector("[data-mat-favorite-btn]");
      Fav?.updateButton?.(favBtn, item);
      if (favBtn) {
        const syncHeart = () => {
          const on = favBtn.getAttribute("aria-pressed") === "true" || favBtn.classList.contains("is-favorited");
          favBtn.innerHTML = heartIconHtml(on);
        };
        syncHeart();
        favBtn.addEventListener("click", () => setTimeout(syncHeart, 0));
      }
    });

    applyPromoAuth(listRoot);
  }

  async function applyPromoAuth(root) {
    const cta = root?.querySelector("[data-bgm-promo-cta]");
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
    const guestCopy = root.querySelector("[data-bgm-promo-guest-copy]");
    if (guestCopy) guestCopy.hidden = true;
    cta.textContent = "マイページを見る";
    cta.setAttribute("href", "/materials/mypage");
    cta.setAttribute("data-bgm-promo-member", "1");
  }

  async function refresh() {
    const classic = document.querySelector("[data-materials-list-classic]");
    const root = document.querySelector("[data-materials-list-bgm]");
    if (!root) return;

    showBgmRoot(root, classic);
    const sfxRoot = document.querySelector("[data-materials-list-sfx]");
    if (sfxRoot) {
      sfxRoot.hidden = true;
      sfxRoot.innerHTML = "";
    }
    global.TasuMaterialsSfxList?.stopAudio?.();

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
      format: urlState.format,
      mood: urlState.mood,
      tag: urlState.tag,
    };
    const options = collectFilterOptions(baseItems);
    const filtered = applyFilters(baseItems, filters);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);
    const page = Math.min(urlState.page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);
    const moodEntries = [...options.moods.entries()].sort((a, b) => b[1] - a[1]);

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
      moodEntries,
    });

    wireInteractions(root, pageItems, { ...urlState, page });

    try {
      const q = String(urlState.q || "").trim();
      if (q.length >= 2) {
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, {
            category_id: "bgm",
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
    const root = document.querySelector("[data-materials-list-bgm]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const otherSelectors = [
      "[data-materials-list-sfx]",
      "[data-materials-list-image]",
      "[data-materials-list-illustration]",
      "[data-materials-list-background]",
      "[data-materials-list-icon]",
      "[data-materials-list-web]",
      "[data-materials-list-code]",
      "[data-materials-list-document]",
      "[data-materials-list-presentation]",
      "[data-materials-list-template]",
    ];
    const otherOn = otherSelectors.some((sel) => {
      const el = document.querySelector(sel);
      return el && !el.hidden;
    });
    if (classic && !otherOn) {
      classic.hidden = false;
      classic.removeAttribute("aria-hidden");
      if ("inert" in classic) classic.inert = false;
    }
  }

  function showBgmRoot(root, classic) {
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
    return params.get("category") === "bgm";
  }

  async function mount() {
    if (!isActive()) {
      hide();
      return false;
    }
    global.TasuMaterialsSfxList?.hide?.();
    global.TasuMaterialsSfxList?.stopAudio?.();
    global.TasuMaterialsImageList?.hide?.();
    global.TasuMaterialsIllustrationList?.hide?.();
    global.TasuMaterialsBackgroundList?.hide?.();
    global.TasuMaterialsIconList?.hide?.();
    global.TasuMaterialsWebList?.hide?.();
    global.TasuMaterialsCodeList?.hide?.();
    global.TasuMaterialsDocumentList?.hide?.();
    global.TasuMaterialsPresentationList?.hide?.();
    await refresh();
    return true;
  }

  
  function wireCard(card, item) {
    if (!card || !item) return;
    card.querySelector("[data-bgm-play]")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      togglePlay(item, card);
    });
    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, item);
    const Fav = global.TasuMaterialsFavorites;
    Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
  }

  global.TasuMaterialsBgmList = {
    renderCard,
    wireCard,
    
    mount,
    refresh,
    hide,
    isActive,
    stopAudio,
  };
})(typeof window !== "undefined" ? window : globalThis);
