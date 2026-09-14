/**
 * TASFUL Materials — BGM詳細（Screenshot-to-Code 正本の完全移植）
 * category=bgm のみ。STC DOM/CSS をそのまま採用し、既存 Contract のみ再接続。
 * Desktop 3カラム: lg:grid-cols-[1fr_400px_300px]
 * 他カテゴリ・BGM一覧・TOP・マイページは変更しない。
 */
(function (global) {
  "use strict";

  /** @type {HTMLAudioElement | null} */
  let audioEl = null;
  let seeking = false;
  /** @type {{ start: number, end: number } | null} */
  let activeSegment = null;

  /** Desktop related grid is 4-col × 1 row — do not render a 5th card onto a second row. */
  const RELATED_DISPLAY_LIMIT = 4;

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
      return s && low !== "bgm" && low !== "wav" && low !== "mp3";
    });
  }

  function isQaFixtureMode() {
    return new URLSearchParams(global.location.search).get("qa_fixture") === "1";
  }

  function detailHref(item) {
    const qs = new URLSearchParams();
    qs.set("slug", String(item.slug || item.id || ""));
    if (isQaFixtureMode() || item._qa_fixture) qs.set("qa_fixture", "1");
    return `detail.html?${qs.toString()}`;
  }

  function listHref() {
    const qs = new URLSearchParams();
    qs.set("category", "bgm");
    if (isQaFixtureMode()) qs.set("qa_fixture", "1");
    return `/materials/list.html?${qs.toString()}`;
  }

  /** STC rand(seed) */
  function makeRand(seed) {
    let s = seed;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  /** STC wave bars: height % */
  function waveBarsHtml(count, seed) {
    const r = makeRand(seed);
    let html = "";
    for (let k = 0; k < count; k += 1) {
      const v = 25 + Math.abs(Math.sin(k / 3.1)) * 45 + r() * 35;
      html += `<span style="height:${Math.min(100, v)}%"></span>`;
    }
    return html;
  }

  function relatedWaveHtml(seed) {
    const r = makeRand(seed);
    let bars = "";
    for (let k = 0; k < 48; k += 1) {
      bars += `<span style="height:${20 + Math.abs(Math.sin(k / 2.7)) * 45 + r() * 35}%"></span>`;
    }
    return bars;
  }

  function seedFromId(id, offset) {
    const str = String(id || "bgm");
    let n = offset || 0;
    for (let i = 0; i < str.length; i += 1) n = (n * 31 + str.charCodeAt(i)) >>> 0;
    return (n % 900) + 11;
  }

  function buildInfoRows(item, formats, durationLabel) {
    const rows = [];
    const formatText = formats.map((f) => String(f).toUpperCase()).join(" / ");
    if (formatText) rows.push(["ファイル形式", formatText]);
    if (durationLabel) rows.push(["長さ", durationLabel]);
    const bpm = pickStr(item.meta_bpm);
    if (bpm) rows.push(["BPM", bpm]);
    const loop = pickStr(item.meta_loop);
    if (loop) rows.push(["ループ", loop]);
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

  function usageBullets(item) {
    const fromData = (item.usage_tags || item.recommended_for || [])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .slice(0, 4);
    if (fromData.length) return fromData;
    const tags = itemTags(item).slice(0, 3);
    if (!tags.length) return [];
    return tags.map((t) => `${t}の演出に`);
  }

  function buildSegments(durationSec) {
    const dur = Math.max(1, Number(durationSec) || 1);
    const step = dur <= 60 ? 15 : 30;
    const segs = [];
    for (let start = 0; start < dur; start += step) {
      const end = Math.min(dur, start + step);
      segs.push({ start, end, label: `${formatTime(start)} - ${formatTime(end)}` });
      if (segs.length >= 6) break;
    }
    if (!segs.length) segs.push({ start: 0, end: dur, label: `0:00 - ${formatTime(dur)}` });
    return segs;
  }

  function renderRelatedCard(item, index) {
    const href = detailHref(item);
    const dur = pickStr(item.meta_duration, "0:00");
    const rating = Number(item.rating || 0) > 0 ? Number(item.rating).toFixed(1) : "—";
    const dl = formatCount(item.download_count);
    const bars = relatedWaveHtml(11 + index * 7 + seedFromId(item.id, 3));
    return (
      `<div class="border border-slate-200 rounded-xl overflow-hidden" data-bgm-d-related data-item-id="${escapeHtml(item.id)}">` +
      `<div class="relative bg-slate-50 h-[70px] px-3 flex items-end">` +
      `<span class="absolute top-2 left-2 bg-indigo-500 text-white text-[9px] font-bold rounded px-1.5 py-0.5">BGM</span>` +
      (item.is_free !== false
        ? `<span class="absolute top-2 right-2 bg-emerald-50 text-emerald-600 text-[9px] font-bold rounded px-1.5 py-0.5">無料</span>`
        : "") +
      `<a href="${href}" class="wave h-8 w-full mb-2" style="gap:1px" aria-label="${escapeHtml(item.title)}">${bars}</a>` +
      `<span class="absolute bottom-1.5 right-2 text-[10px] text-slate-500">${escapeHtml(dur)}</span>` +
      `</div>` +
      `<div class="p-3">` +
      `<p class="text-[12px] font-bold text-slate-800 truncate"><a href="${href}" class="text-slate-800" style="text-decoration:none;color:inherit">${escapeHtml(item.title)}</a></p>` +
      `<div class="flex items-center gap-2 mt-2 text-[10px] text-slate-600">` +
      `<span class="flex items-center gap-1"><i class="fas fa-star text-amber-400"></i>${escapeHtml(rating)}</span>` +
      `<span class="flex items-center gap-1"><i class="fas fa-download text-slate-400"></i>${escapeHtml(dl)}</span>` +
      `<button type="button" class="ml-auto text-blue-600 text-[12px]" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード"><span class="visually-hidden" data-mat-download-label>ダウンロード</span><i class="fas fa-download"></i></button>` +
      `</div>` +
      `</div>` +
      `</div>`
    );
  }

  function renderSegmentButtons(segments, size) {
    const isMain = size === "main";
    return segments
      .map((seg, i) => {
        const active = i === 0 ? " is-active bg-blue-600 text-white font-bold" : " border border-slate-200 text-slate-600 hover:bg-slate-50";
        const pad = isMain ? "px-5 py-2 text-[12px]" : "px-3 py-1.5 text-[11px]";
        const activeCls = i === 0 ? (isMain ? "bg-blue-600 text-white text-[12px] font-bold rounded-md px-5 py-2" : "bg-blue-600 text-white text-[11px] font-bold rounded-md px-3 py-1.5") : `border border-slate-200 text-slate-600 ${pad} rounded-md hover:bg-slate-50`;
        return `<button type="button" class="${activeCls}" data-bgm-d-seg data-seg-start="${seg.start}" data-seg-end="${seg.end}"${i === 0 && isMain ? "" : ""}>${escapeHtml(seg.label)}</button>`;
      })
      .join("");
  }

  function renderShell(item, related) {
    const Fav = global.TasuMaterialsFavorites;
    const Download = global.TasuMaterialsDownload;
    const tags = itemTags(item);
    const favOn = Boolean(Fav?.isFavorited?.(item.id));
    const dlLabel = Download?.primaryButtonLabel?.(item) || item.button_label || "無料ダウンロード";
    const formats = (item.file_formats || []).length
      ? item.file_formats
      : String(item.meta_format || "WAV")
          .split(/[/·,]/)
          .map((s) => s.trim())
          .filter(Boolean);
    const durationLabel = pickStr(item.meta_duration, "0:00");
    const durationSec = parseDurationLabel(durationLabel) || 165;
    const segments = buildSegments(durationSec);
    const rating = Number(item.rating || 0);
    const ratingLabel = rating > 0 ? rating.toFixed(1) : "—";
    const ratingCount = Number(item.rating_count || 0);
    const bullets = usageBullets(item);
    const desc = pickStr(item.long_description, item.description) || "BGM素材です。";
    const relatedBgm = (related || []).filter((r) => r && r.category_id === "bgm" && r.id !== item.id);
    const relatedFallback = (relatedBgm.length ? relatedBgm : (related || []).filter((r) => r && r.id !== item.id)).slice(
      0,
      RELATED_DISPLAY_LIMIT,
    );
    const infoRows = buildInfoRows(item, formats, durationLabel);
    const formatOptions = formats
      .map((f, i) => {
        const upper = String(f).toUpperCase();
        const label = upper === "WAV" ? "WAV（高音質）　推奨" : upper;
        return `<option value="${escapeHtml(upper)}"${i === 0 ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");
    const qualityOptions = (() => {
      const sample = pickStr(item.meta_sample_rate, item.sample_rate);
      const bit = pickStr(item.meta_bit_depth, item.bit_depth);
      const primary = sample || bit ? `${sample || "44.1kHz"} / ${bit || "16bit"}` : "44.1kHz / 16bit";
      const alt = primary === "48kHz / 24bit" ? "44.1kHz / 16bit" : "48kHz / 24bit";
      return `<option selected>${escapeHtml(primary)}</option><option>${escapeHtml(alt)}</option>`;
    })();

    const headTags = tags
      .slice(0, 8)
      .map((t) => `<span class="border border-slate-200 rounded-md px-3 py-1.5 text-[12px] text-slate-600">${escapeHtml(t)}</span>`)
      .join("");
    const sideTags = tags
      .map(
        (t) =>
          `<a href="/materials/list.html?category=bgm&q=${encodeURIComponent(t)}" class="bg-blue-50 text-blue-600 text-[12px] rounded-md px-3 py-1.5">${escapeHtml(t)}</a>`
      )
      .join("");
    const infoDl = infoRows
      .map(
        ([k, v]) =>
          `<div class="flex py-2"><dt class="w-32 text-slate-500">${escapeHtml(k)}</dt><dd class="text-slate-800">${escapeHtml(v)}</dd></div>`
      )
      .join("");
    const bulletLis = bullets
      .map(
        (b) =>
          `<li class="flex gap-3"><span class="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 shrink-0"></span>${escapeHtml(b)}</li>`
      )
      .join("");
    const mainSegs = segments
      .map((seg, i) => {
        if (i === 0) {
          return `<button type="button" class="bg-blue-600 text-white text-[12px] font-bold rounded-md px-5 py-2 is-active" data-bgm-d-seg data-seg-start="${seg.start}" data-seg-end="${seg.end}">${escapeHtml(seg.label)}</button>`;
        }
        return `<button type="button" class="border border-slate-200 text-slate-600 text-[12px] rounded-md px-5 py-2 hover:bg-slate-50" data-bgm-d-seg data-seg-start="${seg.start}" data-seg-end="${seg.end}">${escapeHtml(seg.label)}</button>`;
      })
      .join("");
    const rightSegs = segments
      .slice(0, 3)
      .map((seg, i) => {
        if (i === 0) {
          return `<button type="button" class="bg-blue-600 text-white text-[11px] font-bold rounded-md px-3 py-1.5 is-active" data-bgm-d-seg data-seg-start="${seg.start}" data-seg-end="${seg.end}">${escapeHtml(seg.label)}</button>`;
        }
        return `<button type="button" class="border border-slate-200 text-slate-600 text-[11px] rounded-md px-3 py-1.5" data-bgm-d-seg data-seg-start="${seg.start}" data-seg-end="${seg.end}">${escapeHtml(seg.label)}</button>`;
      })
      .join("");

    const mainWave = waveBarsHtml(90, 97 + seedFromId(item.id, 0));
    const miniWave = waveBarsHtml(55, 97 + 13 + seedFromId(item.id, 1));
    const favHeart = favOn ? "fas fa-heart" : "far fa-heart";
    const commentLabel = ratingCount > 0 ? `コメント（${formatCount(ratingCount)}）` : "コメント";

    return (
      `<div data-bgm-detail data-item-id="${escapeHtml(item.id)}" class="bg-white text-slate-800">` +
      `<div class="px-6 pt-4 pb-1 text-[12px] text-slate-500 flex items-center gap-2 flex-wrap mat-bgm-d-crumb" aria-label="パンくず">` +
      `<a href="/materials/" class="hover:text-blue-600">ホーム</a><i class="fas fa-chevron-right text-[8px] text-slate-400"></i>` +
      `<a href="/materials/" class="hover:text-blue-600">素材を探す</a><i class="fas fa-chevron-right text-[8px] text-slate-400"></i>` +
      `<a href="${listHref()}" class="hover:text-blue-600">BGM一覧</a><i class="fas fa-chevron-right text-[8px] text-slate-400"></i>` +
      `<span class="text-slate-700">${escapeHtml(item.title)}</span>` +
      `</div>` +
      `<div class="px-6 pb-16">` +
      `<div class="grid grid-cols-1 lg:grid-cols-[1fr_400px_300px] gap-6 items-start">` +
      /* ===== Main ===== */
      `<main class="pt-2" data-bgm-d-main>` +
      `<div class="flex items-center gap-2 mb-4">` +
      `<span class="bg-indigo-500 text-white text-[11px] font-bold rounded px-2.5 py-1">BGM</span>` +
      (item.is_free !== false ? `<span class="bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded px-2.5 py-1">無料</span>` : "") +
      `</div>` +
      `<h1 class="text-[30px] font-bold text-slate-900 leading-tight">${escapeHtml(item.title)}</h1>` +
      `<p class="text-[13px] text-slate-600 mt-1.5">${escapeHtml(item.description || "")}</p>` +
      (headTags ? `<div class="flex flex-wrap gap-2 mt-4">${headTags}</div>` : "") +
      `<div class="flex items-center gap-6 mt-5 text-[13px]" data-bgm-d-head>` +
      `<span class="flex items-center gap-1.5"><i class="fas fa-star text-amber-400"></i><span class="font-bold">${escapeHtml(ratingLabel)}</span>${ratingCount ? `<span class="text-slate-500">（${formatCount(ratingCount)}）</span>` : ""}</span>` +
      `<span class="flex items-center gap-2 text-slate-600"><i class="fas fa-download text-slate-400"></i>${formatCount(item.download_count)} ダウンロード</span>` +
      `<button type="button" class="flex items-center gap-2 text-blue-600 font-medium" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}"><i class="${favHeart}" data-bgm-d-heart></i>お気に入りに追加</button>` +
      `</div>` +
      `<div class="mt-6 border border-slate-200 rounded-xl p-5" data-bgm-d-player aria-label="音声プレビュー">` +
      `<div class="flex items-center gap-5">` +
      `<button type="button" class="w-14 h-14 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center" data-bgm-d-play aria-label="再生" disabled><i class="fas fa-play text-lg ml-1" data-bgm-d-play-icon></i></button>` +
      `<div class="flex-1 min-w-0">` +
      `<div class="h-14 wave" data-wave="90" data-bgm-d-wave>${mainWave}</div>` +
      `<div class="flex justify-between text-[12px] text-slate-500 mt-2"><span data-bgm-d-current>0:00</span><span data-bgm-d-total>${escapeHtml(durationLabel)}</span></div>` +
      `</div>` +
      `</div>` +
      `<div class="flex flex-wrap items-center gap-2 mt-4">` +
      `<button type="button" class="w-10 h-9 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50" data-bgm-d-restart aria-label="先頭に戻す" disabled><i class="fas fa-redo text-[12px]"></i></button>` +
      mainSegs +
      `<button type="button" class="border border-slate-200 text-slate-600 text-[12px] rounded-md px-4 py-2 hover:bg-slate-50 flex items-center gap-3" data-bgm-d-copy disabled>区間をコピー <i class="far fa-copy text-slate-400"></i></button>` +
      `</div>` +
      `<p class="text-[12px] text-slate-500 mt-2" data-bgm-d-status hidden></p>` +
      `</div>` +
      `<div class="mt-8 border-b border-slate-200 flex items-center gap-8 text-[13px]" data-bgm-d-tabs>` +
      `<button type="button" class="pb-3 font-bold text-blue-600 border-b-2 border-blue-600 is-active" data-bgm-d-tab="desc">説明</button>` +
      `<button type="button" class="pb-3 text-slate-500 hover:text-slate-800" data-bgm-d-tab="usage">利用シーン</button>` +
      `<button type="button" class="pb-3 text-slate-500 hover:text-slate-800" data-bgm-d-tab="related">関連素材</button>` +
      `<button type="button" class="pb-3 text-slate-500 hover:text-slate-800" data-bgm-d-tab="comments">${escapeHtml(commentLabel)}</button>` +
      `</div>` +
      `<div class="mt-6" data-bgm-d-panel="desc">` +
      `<p class="text-[13px] leading-7 text-slate-600" data-bgm-d-desc>${escapeHtml(desc)}</p>` +
      (bulletLis ? `<ul class="mt-5 space-y-3 text-[13px] text-slate-600">${bulletLis}</ul>` : "") +
      `<button type="button" class="mt-6 border border-slate-200 rounded-lg px-4 py-2 text-[12px] text-slate-600 hover:bg-slate-50" data-bgm-d-more>もっと見る <i class="fas fa-chevron-down text-[10px] ml-1"></i></button>` +
      `</div>` +
      `<div class="mt-6" data-bgm-d-panel="usage" hidden>` +
      (bulletLis
        ? `<ul class="space-y-3 text-[13px] text-slate-600">${bulletLis}</ul>`
        : `<p class="text-[13px] text-slate-500">利用シーン情報は準備中です。</p>`) +
      `</div>` +
      `<div class="mt-6" data-bgm-d-panel="related" hidden>` +
      `<p class="text-[13px] text-slate-500">下記の関連素材セクションをご覧ください。</p>` +
      `</div>` +
      `<div class="mt-6" data-bgm-d-panel="comments" hidden>` +
      `<p class="text-[13px] text-slate-500">コメントは準備中です。</p>` +
      `</div>` +
      `</main>` +
      /* ===== Middle ===== */
      `<aside class="pt-2 space-y-4" data-bgm-d-aside>` +
      `<section class="border border-slate-200 rounded-xl p-5">` +
      `<h3 class="flex items-center gap-2 text-[15px] font-bold text-slate-900 mb-4"><i class="fas fa-download text-blue-600"></i> ダウンロード</h3>` +
      `<div class="grid grid-cols-2 gap-4">` +
      `<div><label class="text-[12px] text-slate-600">ファイル形式</label><div class="relative mt-2"><select class="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2.5 text-[12px] text-slate-700 bg-white" data-bgm-d-format aria-label="ファイル形式">${formatOptions || "<option>WAV（高音質）　推奨</option>"}</select><i class="fas fa-chevron-down text-[10px] text-slate-400 absolute right-3 top-3.5 pointer-events-none"></i></div></div>` +
      `<div><label class="text-[12px] text-slate-600">品質</label><div class="relative mt-2"><select class="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2.5 text-[12px] text-slate-700 bg-white" data-bgm-d-quality aria-label="品質">${qualityOptions}</select><i class="fas fa-chevron-down text-[10px] text-slate-400 absolute right-3 top-3.5 pointer-events-none"></i></div></div>` +
      `</div>` +
      `<button type="button" class="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-lg py-3" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}"><span data-mat-download-label>${escapeHtml(dlLabel)}</span></button>` +
      `<p class="text-[11px] text-slate-500 mt-3">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</section>` +
      (infoDl
        ? `<section class="border border-slate-200 rounded-xl p-5" data-bgm-d-info>` +
          `<h3 class="flex items-center gap-2 text-[15px] font-bold text-slate-900 mb-4"><i class="fas fa-wave-square text-blue-600"></i> 素材情報</h3>` +
          `<dl class="text-[12px]">${infoDl}</dl>` +
          `</section>`
        : "") +
      `<section class="border border-slate-200 rounded-xl p-5">` +
      `<h3 class="flex items-center gap-2 text-[15px] font-bold text-slate-900 mb-4"><i class="fas fa-shield-alt text-blue-600"></i> ライセンス</h3>` +
      `<p class="text-[12px] text-slate-600">商用利用OK・クレジット表記不要</p>` +
      `<p class="text-[12px] text-slate-600 mt-2.5">再配布・販売は禁止されています</p>` +
      `<div class="text-right mt-4"><a href="/company/legal/materials.html" class="text-[12px] text-blue-600 font-medium">ライセンス詳細を見る <i class="fas fa-chevron-right text-[9px]"></i></a></div>` +
      `</section>` +
      (sideTags
        ? `<section class="border border-slate-200 rounded-xl p-5" data-bgm-d-side-tags>` +
          `<h3 class="flex items-center gap-2 text-[15px] font-bold text-slate-900 mb-4"><i class="fas fa-tags text-blue-600"></i> タグ</h3>` +
          `<div class="flex flex-wrap gap-2">${sideTags}</div>` +
          `<div class="text-center mt-5"><a href="${listHref()}" class="text-[12px] text-slate-600">すべてのタグを見る（${tags.length}） <i class="fas fa-chevron-right text-[9px] ml-1"></i></a></div>` +
          `</section>`
        : "") +
      `</aside>` +
      /* ===== Right ===== */
      `<aside class="pt-2 space-y-4" data-bgm-d-rail>` +
      `<a href="${listHref()}" class="flex items-center gap-2 text-[12px] text-slate-600 mb-1"><i class="fas fa-chevron-left text-[10px]"></i> BGM一覧に戻る</a>` +
      `<section class="border border-slate-200 rounded-xl p-5" data-bgm-d-rail-mobile-only>` +
      `<div class="flex items-center gap-2 mb-3">` +
      `<span class="bg-indigo-500 text-white text-[10px] font-bold rounded px-2 py-0.5">BGM</span>` +
      (item.is_free !== false ? `<span class="bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded px-2 py-0.5">無料</span>` : "") +
      `</div>` +
      `<h3 class="text-[17px] font-bold text-slate-900">${escapeHtml(item.title)}</h3>` +
      `<p class="text-[11px] text-slate-600 mt-1.5">${escapeHtml(item.description || "")}</p>` +
      `<div class="flex items-center gap-4 mt-3 text-[12px]">` +
      `<span class="flex items-center gap-1"><i class="fas fa-star text-amber-400 text-[11px]"></i><span class="font-bold">${escapeHtml(ratingLabel)}</span>${ratingCount ? `<span class="text-slate-500">(${formatCount(ratingCount)})</span>` : ""}</span>` +
      `<span class="flex items-center gap-1.5 text-slate-600"><i class="fas fa-download text-slate-400 text-[11px]"></i>${formatCount(item.download_count)}</span>` +
      `<button type="button" class="ml-auto text-blue-600" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="お気に入り"><i class="${favHeart}" data-bgm-d-heart></i></button>` +
      `</div>` +
      `<div class="flex items-center gap-3 mt-5">` +
      `<button type="button" class="w-11 h-11 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center" data-bgm-d-play aria-label="再生" disabled><i class="fas fa-play text-sm ml-0.5" data-bgm-d-play-icon></i></button>` +
      `<div class="flex-1 min-w-0">` +
      `<div class="h-9 wave" data-wave="55">${miniWave}</div>` +
      `<div class="flex justify-between text-[11px] text-slate-500 mt-2"><span data-bgm-d-current>0:00</span><span data-bgm-d-total>${escapeHtml(durationLabel)}</span></div>` +
      `</div>` +
      `</div>` +
      `<div class="flex items-center gap-2 mt-4 flex-wrap">` +
      `<button type="button" class="w-9 h-8 border border-slate-200 rounded-md text-slate-500" data-bgm-d-restart aria-label="先頭に戻す" disabled><i class="fas fa-redo text-[11px]"></i></button>` +
      rightSegs +
      `</div>` +
      `</section>` +
      `<section class="border border-slate-200 rounded-xl p-5" data-bgm-d-rail-mobile-only>` +
      `<h3 class="flex items-center gap-2 text-[14px] font-bold text-slate-900 mb-4"><i class="fas fa-download text-blue-600"></i> ダウンロード</h3>` +
      `<label class="text-[11px] text-slate-600">ファイル形式</label>` +
      `<div class="relative mt-1.5 mb-4"><select class="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2.5 text-[12px] text-slate-700 bg-white" data-bgm-d-format aria-label="ファイル形式（レール）">${formatOptions || "<option>WAV（高音質）</option>"}</select><i class="fas fa-chevron-down text-[10px] text-slate-400 absolute right-3 top-3.5 pointer-events-none"></i></div>` +
      `<label class="text-[11px] text-slate-600">品質</label>` +
      `<div class="relative mt-1.5"><select class="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2.5 text-[12px] text-slate-700 bg-white" data-bgm-d-quality aria-label="品質（レール）">${qualityOptions}</select><i class="fas fa-chevron-down text-[10px] text-slate-400 absolute right-3 top-3.5 pointer-events-none"></i></div>` +
      `<button type="button" class="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-lg py-3" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}"><span data-mat-download-label>${escapeHtml(dlLabel)}</span></button>` +
      `<p class="text-[10px] text-slate-500 mt-3">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</section>` +
      `<section class="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">` +
      `<button type="button" class="w-full flex items-center justify-between px-5 py-3.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50" data-bgm-d-rail-jump="info">素材情報 <i class="fas fa-chevron-down text-[10px] text-slate-400"></i></button>` +
      `<button type="button" class="w-full flex items-center justify-between px-5 py-3.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50" data-bgm-d-rail-jump="desc">説明 <i class="fas fa-chevron-down text-[10px] text-slate-400"></i></button>` +
      `<button type="button" class="w-full flex items-center justify-between px-5 py-3.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50" data-bgm-d-rail-jump="usage">利用シーン <i class="fas fa-chevron-down text-[10px] text-slate-400"></i></button>` +
      `<button type="button" class="w-full flex items-center justify-between px-5 py-3.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50" data-bgm-d-rail-jump="related">関連素材 <i class="fas fa-chevron-down text-[10px] text-slate-400"></i></button>` +
      `<button type="button" class="w-full flex items-center justify-between px-5 py-3.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50" data-bgm-d-rail-jump="tags">タグ <i class="fas fa-chevron-down text-[10px] text-slate-400"></i></button>` +
      `<button type="button" class="w-full flex items-center justify-between px-5 py-3.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50" data-bgm-d-rail-jump="comments">${escapeHtml(commentLabel)} <i class="fas fa-chevron-down text-[10px] text-slate-400"></i></button>` +
      `</section>` +
      `<button type="button" class="w-full border border-slate-200 rounded-xl py-4 text-[13px] font-medium text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}"><i class="${favHeart} text-blue-600" data-bgm-d-heart></i> お気に入りに追加</button>` +
      `</aside>` +
      `</div>` +
      `<div class="mt-12" data-bgm-d-related-section>` +
      `<div class="flex items-center justify-between gap-3 flex-wrap">` +
      `<h2 class="flex items-center gap-2 text-[15px] font-bold text-slate-900 min-w-0"><i class="fas fa-wave-square text-blue-600"></i> この素材を使用している人はこんな素材も使っています</h2>` +
      `<a href="${listHref()}" class="text-[12px] text-slate-500 hover:text-blue-600 shrink-0">すべて見る <i class="fas fa-chevron-right text-[9px]"></i></a>` +
      `</div>` +
      (relatedFallback.length
        ? `<div class="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">${relatedFallback.map((r, i) => renderRelatedCard(r, i)).join("")}</div>`
        : `<p class="mt-4 text-[13px] text-slate-500">関連素材はまだありません。</p>`) +
      `</div>` +
      `</div>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
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

  function setPlayingUi(root, playing) {
    root.querySelectorAll("[data-bgm-d-play]").forEach((btn) => {
      btn.setAttribute("aria-label", playing ? "一時停止" : "再生");
      const iconEl = btn.querySelector("[data-bgm-d-play-icon]");
      if (iconEl) {
        iconEl.className = playing
          ? iconEl.className.replace(/fa-play/, "fa-pause").replace(/\s*ml-1\s*/g, " ").replace(/\s*ml-0\.5\s*/g, " ")
          : iconEl.className.includes("text-lg")
            ? "fas fa-play text-lg ml-1"
            : "fas fa-play text-sm ml-0.5";
        if (playing) iconEl.className = iconEl.className.includes("text-lg") ? "fas fa-pause text-lg" : "fas fa-pause text-sm";
      }
    });
  }

  function syncHearts(root) {
    root.querySelectorAll("[data-mat-favorite-btn]").forEach((btn) => {
      const on = btn.getAttribute("aria-pressed") === "true" || btn.classList.contains("is-favorited");
      btn.querySelectorAll("[data-bgm-d-heart]").forEach((ico) => {
        ico.className = on ? "fas fa-heart" : "far fa-heart";
        if (ico.classList.contains("text-blue-600") || btn.className.includes("border")) {
          /* keep */
        }
      });
      const icon = btn.querySelector("i");
      if (icon && icon.hasAttribute("data-bgm-d-heart")) {
        icon.className = (on ? "fas fa-heart" : "far fa-heart") + (btn.className.includes("rounded-xl") ? " text-blue-600" : "");
      }
    });
  }

  function wireAudio(root, item) {
    const src = resolveAudioSrc(item);
    const playBtns = root.querySelectorAll("[data-bgm-d-play]");
    const currentEls = root.querySelectorAll("[data-bgm-d-current]");
    const totalEls = root.querySelectorAll("[data-bgm-d-total]");
    const restartBtns = root.querySelectorAll("[data-bgm-d-restart]");
    const status = root.querySelector("[data-bgm-d-status]");
    const copyBtn = root.querySelector("[data-bgm-d-copy]");
    const fallbackDur = parseDurationLabel(pickStr(item.meta_duration));

    if (!src) {
      if (status) {
        status.hidden = false;
        status.textContent = "プレビュー音声がありません。";
      }
      return;
    }

    const audio = ensureAudio();
    audio.src = src;

    const enableControls = () => {
      playBtns.forEach((b) => b.removeAttribute("disabled"));
      restartBtns.forEach((b) => b.removeAttribute("disabled"));
      copyBtn?.removeAttribute("disabled");
      root.querySelectorAll("[data-bgm-d-seg]").forEach((b) => b.removeAttribute("disabled"));
    };

    audio.addEventListener("loadedmetadata", () => {
      enableControls();
      const dur = audio.duration;
      if (Number.isFinite(dur) && dur > 0) {
        totalEls.forEach((el) => {
          el.textContent = formatTime(dur);
        });
      } else if (fallbackDur) {
        totalEls.forEach((el) => {
          el.textContent = formatTime(fallbackDur);
        });
      }
    });

    audio.addEventListener("timeupdate", () => {
      if (seeking) return;
      const cur = audio.currentTime || 0;
      const dur = audio.duration || fallbackDur || 0;
      currentEls.forEach((el) => {
        el.textContent = formatTime(cur);
      });
      if (Number.isFinite(dur) && dur > 0) {
        totalEls.forEach((el) => {
          el.textContent = formatTime(dur);
        });
      }
      if (activeSegment && cur >= activeSegment.end - 0.05) {
        audio.pause();
        setPlayingUi(root, false);
      }
    });

    audio.addEventListener("ended", () => setPlayingUi(root, false));
    audio.addEventListener("play", () => setPlayingUi(root, true));
    audio.addEventListener("pause", () => setPlayingUi(root, false));

    if (audio.readyState >= 1) enableControls();

    const togglePlay = async () => {
      try {
        if (audio.paused) {
          if (activeSegment && audio.currentTime >= activeSegment.end) {
            audio.currentTime = activeSegment.start;
          }
          await audio.play();
        } else {
          audio.pause();
        }
      } catch (err) {
        console.warn("[Materials BGM detail] play failed", err);
        if (status) {
          status.hidden = false;
          status.textContent = "再生できませんでした。";
        }
      }
    };

    playBtns.forEach((btn) => btn.addEventListener("click", togglePlay));

    restartBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        seeking = true;
        audio.currentTime = activeSegment ? activeSegment.start : 0;
        seeking = false;
        currentEls.forEach((el) => {
          el.textContent = formatTime(audio.currentTime);
        });
      });
    });

    const seekTo = (sec) => {
      const dur = audio.duration || fallbackDur || 0;
      seeking = true;
      audio.currentTime = Math.max(0, Math.min(dur || sec, sec));
      seeking = false;
      currentEls.forEach((el) => {
        el.textContent = formatTime(audio.currentTime);
      });
    };

    root.querySelectorAll("[data-bgm-d-seg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const start = Number(btn.getAttribute("data-seg-start") || 0);
        const end = Number(btn.getAttribute("data-seg-end") || 0);
        activeSegment = { start, end };
        root.querySelectorAll("[data-bgm-d-seg]").forEach((b) => {
          const on = b === btn || (Number(b.getAttribute("data-seg-start")) === start && Number(b.getAttribute("data-seg-end")) === end);
          b.classList.toggle("is-active", on);
          if (on) {
            b.classList.add("bg-blue-600", "text-white", "font-bold");
            b.classList.remove("border", "border-slate-200", "text-slate-600");
          } else {
            b.classList.remove("bg-blue-600", "text-white", "font-bold", "is-active");
            if (!b.className.includes("border")) b.classList.add("border", "border-slate-200", "text-slate-600");
          }
        });
        seekTo(start);
      });
    });

    copyBtn?.addEventListener("click", async () => {
      const dur = audio.duration || fallbackDur || 0;
      const text = activeSegment
        ? `${formatTime(activeSegment.start)} - ${formatTime(activeSegment.end)}`
        : `0:00 - ${formatTime(dur)}`;
      try {
        await global.navigator.clipboard.writeText(text);
        const toast = root.querySelector("[data-mat-toast]");
        if (toast) {
          toast.hidden = false;
          toast.textContent = `区間をコピーしました: ${text}`;
          setTimeout(() => {
            toast.hidden = true;
          }, 1800);
        }
      } catch {
        /* ignore */
      }
    });

    // Wave seek (main)
    root.querySelector("[data-bgm-d-wave]")?.addEventListener("click", (ev) => {
      const el = ev.currentTarget;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const dur = audio.duration || fallbackDur || 0;
      if (dur > 0) seekTo(ratio * dur);
    });
  }

  function wireTabs(root) {
    const tabs = [...root.querySelectorAll("[data-bgm-d-tab]")];
    const panels = [...root.querySelectorAll("[data-bgm-d-panel]")];
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-bgm-d-tab");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.classList.toggle("font-bold", on);
          t.classList.toggle("text-blue-600", on);
          t.classList.toggle("border-b-2", on);
          t.classList.toggle("border-blue-600", on);
          t.classList.toggle("text-slate-500", !on);
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-bgm-d-panel") === id;
          p.hidden = !on;
        });
      });
    });
  }

  function wireMore(root) {
    root.querySelectorAll("[data-bgm-d-more]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const desc = root.querySelector("[data-bgm-d-desc]");
        if (!desc) return;
        desc.classList.toggle("leading-7");
        btn.textContent = desc.dataset.expanded === "1" ? "もっと見る " : "閉じる ";
        desc.dataset.expanded = desc.dataset.expanded === "1" ? "0" : "1";
        btn.innerHTML =
          desc.dataset.expanded === "1"
            ? `閉じる <i class="fas fa-chevron-up text-[10px] ml-1"></i>`
            : `もっと見る <i class="fas fa-chevron-down text-[10px] ml-1"></i>`;
      });
    });
  }

  function wireRail(root) {
    root.querySelectorAll("[data-bgm-d-rail-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-bgm-d-rail-jump");
        const tabMap = { desc: "desc", usage: "usage", related: "related", comments: "comments" };
        if (tabMap[key]) root.querySelector(`[data-bgm-d-tab="${tabMap[key]}"]`)?.click();
        const anchorMap = {
          info: "[data-bgm-d-info]",
          desc: "[data-bgm-d-tabs]",
          usage: "[data-bgm-d-tabs]",
          related: "[data-bgm-d-related-section]",
          tags: "[data-bgm-d-side-tags]",
          comments: "[data-bgm-d-tabs]",
        };
        root.querySelector(anchorMap[key] || "")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    });
  }

  function syncFormatSelects(root) {
    const selects = [...root.querySelectorAll("[data-bgm-d-format]")];
    selects.forEach((sel) => {
      sel.addEventListener("change", () => {
        selects.forEach((other) => {
          if (other !== sel) other.value = sel.value;
        });
      });
    });
    const quals = [...root.querySelectorAll("[data-bgm-d-quality]")];
    quals.forEach((sel) => {
      sel.addEventListener("change", () => {
        quals.forEach((other) => {
          if (other !== sel) other.value = sel.value;
        });
      });
    });
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== "bgm") return false;
    stopAudio();
    activeSegment = null;
    const relatedList = (related || []).slice();
    root.innerHTML = renderShell(item, relatedList);
    document.title = `${item.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    wireTabs(root);
    wireAudio(root, item);
    wireRail(root);
    wireMore(root);
    syncFormatSelects(root);

    const head = root.querySelector("[data-bgm-d-head]");
    const aside = root.querySelector("[data-bgm-d-aside]");
    const rail = root.querySelector("[data-bgm-d-rail]");
    if (head) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(head, item);
    if (aside) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(aside, item);
    if (rail) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(rail, item);

    const byId = new Map(relatedList.map((r) => [r.id, r]));
    root.querySelectorAll("[data-bgm-d-related]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const rel = byId.get(id);
      if (rel) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, rel);
    });

    root.querySelectorAll("[data-mat-favorite-btn]").forEach((btn) => {
      global.TasuMaterialsFavorites?.updateButton?.(btn, item);
      btn.addEventListener("click", () => setTimeout(() => syncHearts(root), 0));
    });
    syncHearts(root);

    return true;
  }

  function destroy() {
    stopAudio();
    if (audioEl) {
      audioEl.removeAttribute("src");
      audioEl.load();
    }
  }

  const QA_AUDIO = "/materials/generated/downloads/sfx/text-pop-sfx-smoke-001.wav";
  const QA_FIXTURES = Object.freeze({
    "bgm-vlog-lofi": {
      id: "qa-fixture-bgm-vlog-lofi",
      slug: "bgm-vlog-lofi",
      title: "Vlog用ローファイBGM",
      category_id: "bgm",
      description: "Vlogや日常動画向けの落ち着いたローファイBGMです。",
      tags: ["Vlog", "ローファイ"],
      file_formats: ["MP3", "WAV"],
      download_count: 12,
      rating: 4.7,
      rating_count: 188,
      updated_at: "2026-06-25T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_AUDIO,
      audio_src: QA_AUDIO,
      downloadable: true,
      download_kind: "file",
      download_filename: "bgm-vlog-lofi-qa.wav",
      meta_duration: "2:30",
      meta_bpm: "90 BPM",
      meta_loop: "ループ可",
      _qa_fixture: true,
    },
    "bgm-tech": {
      id: "qa-fixture-bgm-tech",
      slug: "bgm-tech",
      title: "テック系BGM",
      category_id: "bgm",
      description: "IT解説やプロダクト紹介向けのテック系BGMです。",
      tags: ["テック", "解説"],
      file_formats: ["MP3", "WAV"],
      download_count: 8,
      rating: 4.6,
      rating_count: 142,
      updated_at: "2026-06-24T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_AUDIO,
      audio_src: QA_AUDIO,
      downloadable: true,
      download_kind: "file",
      download_filename: "bgm-tech-qa.wav",
      meta_duration: "2:18",
      meta_bpm: "110 BPM",
      meta_loop: "ループ可",
      _qa_fixture: true,
    },
    "bgm-daily-warm": {
      id: "qa-fixture-bgm-daily-warm",
      slug: "bgm-daily-warm",
      title: "ほのぼの日常系BGM",
      category_id: "bgm",
      description: "日常系コンテンツや紹介動画に使えるほのぼのBGMです。",
      tags: ["日常", "ほのぼの"],
      file_formats: ["MP3", "WAV"],
      download_count: 5,
      rating: 4.5,
      rating_count: 115,
      updated_at: "2026-06-23T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_AUDIO,
      audio_src: QA_AUDIO,
      downloadable: true,
      download_kind: "file",
      download_filename: "bgm-daily-warm-qa.wav",
      meta_duration: "2:45",
      meta_bpm: "85 BPM",
      meta_loop: "ループ可",
      _qa_fixture: true,
    },
  });

  function resolveQaItem(slug) {
    if (!isQaFixtureMode()) return null;
    const raw = QA_FIXTURES[String(slug || "")];
    if (!raw) return null;
    const data = global.TasuMaterialsData;
    const enriched = data?.enrichDetail ? data.enrichDetail({ ...raw }) : { ...raw };
    return {
      ...enriched,
      audio_src: raw.audio_src,
      download_url: raw.download_url,
      downloadable: raw.downloadable !== false,
      download_kind: raw.download_kind || enriched.download_kind || "file",
      download_filename: raw.download_filename || enriched.download_filename,
      meta_duration: raw.meta_duration || enriched.meta_duration,
      meta_bpm: raw.meta_bpm || enriched.meta_bpm,
      meta_loop: raw.meta_loop || enriched.meta_loop,
      _qa_fixture: true,
    };
  }

  function resolveQaRelated(item) {
    if (!isQaFixtureMode()) return [];
    return Object.keys(QA_FIXTURES)
      .filter((slug) => slug !== item.slug)
      .map((slug) => resolveQaItem(slug))
      .filter(Boolean);
  }

  global.TasuMaterialsBgmDetail = {
    mount,
    destroy,
    stopAudio,
    resolveQaItem,
    resolveQaRelated,
    isBgmItem(item) {
      return !!(item && item.category_id === "bgm");
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
