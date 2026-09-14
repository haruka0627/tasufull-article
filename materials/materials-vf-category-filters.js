/**
 * TASFUL Materials — VF category list filters (existing index metadata only).
 */
(function (global) {
  "use strict";

  function genreFilter() {
    return global.TasuMaterialsGenreFilter;
  }

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

  function orientationFromItem(item) {
    const res = pickStr(item.meta_resolution);
    const m = res.match(/(\d+)\s*[×xX]\s*(\d+)/);
    if (m) {
      const w = Number(m[1]);
      const h = Number(m[2]);
      if (w > h) return "landscape";
      if (h > w) return "portrait";
      return "square";
    }
    const size = pickStr(item.meta_size, item.meta_ratio);
    if (/^16\s*:\s*9$/i.test(size) || /^4\s*:\s*3$/i.test(size)) return "landscape";
    if (/^9\s*:\s*16$/i.test(size) || /^3\s*:\s*4$/i.test(size)) return "portrait";
    if (/^1\s*:\s*1$/i.test(size)) return "square";
    return "";
  }

  function orientationLabel(key) {
    if (key === "landscape") return "横長";
    if (key === "portrait") return "縦長";
    if (key === "square") return "正方形";
    return key;
  }

  function baseRead(params) {
    return {
      q: params.get("q") || "",
      sort: params.get("sort") === "newest" ? "newest" : "popular",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function readState(profile, categoryId) {
    const params = new URLSearchParams(global.location.search);
    const base = baseRead(params);
    const GF = genreFilter();
    if (profile === "image") {
      return {
        ...base,
        genre: params.get("genre") || "",
        usage: params.get("usage") || "",
        orientation: params.get("orientation") || "",
        color: params.get("color") || "",
        people: params.get("people") || "",
        style: params.get("style") || "",
        format: params.get("format") || "",
      };
    }
    if (profile === "illustration") {
      return {
        ...base,
        genre: params.get("genre") || "",
        usage: params.get("usage") || "",
        style: params.get("style") || "",
        people: params.get("people") || "",
        background: params.get("background") || "",
        format: params.get("format") || "",
        color: params.get("color") || "",
        orientation: params.get("orientation") || "",
      };
    }
    if (profile === "background") {
      return {
        ...base,
        usage: params.get("usage") || "",
        style: params.get("style") || "",
        color: params.get("color") || "",
        brightness: params.get("brightness") || "",
        orientation: params.get("orientation") || "",
        format: params.get("format") || "",
        genre: params.get("genre") || params.get("sub") || "",
      };
    }
    if (profile === "icon") {
      return {
        ...base,
        usage: params.get("usage") || "",
        style: params.get("style") || "",
        stroke: params.get("stroke") || "",
        color: params.get("color") || "",
        format: params.get("format") || "",
        genre: params.get("genre") || params.get("sub") || "",
        fill: params.get("fill") || "",
      };
    }
    if (profile === "audio_bgm") {
      return {
        ...base,
        genre: params.get("genre") || "",
        usage: params.get("usage") || "",
        length: params.get("length") || "",
        mood: params.get("mood") || "",
        tempo: params.get("tempo") || "",
        format: params.get("format") || "",
      };
    }
    if (profile === "audio_sfx") {
      return {
        ...base,
        genre: params.get("genre") || "",
        usage: params.get("usage") || "",
        length: params.get("length") || "",
        style: params.get("style") || "",
        format: params.get("format") || "",
      };
    }
    return { ...base, format: params.get("format") || "" };
  }

  function writeState(profile, categoryId, next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", categoryId);
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("page", next.page > 1 ? String(next.page) : "");

    const keysToClear = [
      "genre",
      "usage",
      "orientation",
      "color",
      "people",
      "style",
      "format",
      "background",
      "brightness",
      "stroke",
      "fill",
      "length",
      "mood",
      "tempo",
      "sub",
      "tag",
      "size",
      "pattern",
      "cat",
      "layout",
    ];
    keysToClear.forEach((k) => url.searchParams.delete(k));

    if (profile === "image") {
      setOrDel("genre", next.genre);
      setOrDel("usage", next.usage);
      setOrDel("orientation", next.orientation);
      setOrDel("color", next.color);
      setOrDel("people", next.people);
      setOrDel("style", next.style);
      setOrDel("format", next.format);
    } else if (profile === "illustration") {
      setOrDel("genre", next.genre);
      setOrDel("usage", next.usage);
      setOrDel("style", next.style);
      setOrDel("people", next.people);
      setOrDel("background", next.background);
      setOrDel("format", next.format);
      setOrDel("color", next.color);
      setOrDel("orientation", next.orientation);
    } else if (profile === "background") {
      setOrDel("usage", next.usage);
      setOrDel("style", next.style);
      setOrDel("color", next.color);
      setOrDel("brightness", next.brightness);
      setOrDel("orientation", next.orientation);
      setOrDel("format", next.format);
      setOrDel("genre", next.genre);
      setOrDel("sub", next.genre);
    } else if (profile === "icon") {
      setOrDel("usage", next.usage);
      setOrDel("style", next.style);
      setOrDel("stroke", next.stroke);
      setOrDel("color", next.color);
      setOrDel("format", next.format);
      setOrDel("genre", next.genre);
      setOrDel("sub", next.genre);
      setOrDel("fill", next.fill);
    } else if (profile === "audio_bgm") {
      setOrDel("genre", next.genre);
      setOrDel("usage", next.usage);
      setOrDel("length", next.length);
      setOrDel("mood", next.mood);
      setOrDel("tempo", next.tempo);
      setOrDel("format", next.format);
    } else if (profile === "audio_sfx") {
      setOrDel("genre", next.genre);
      setOrDel("usage", next.usage);
      setOrDel("length", next.length);
      setOrDel("style", next.style);
      setOrDel("format", next.format);
    } else {
      setOrDel("format", next.format);
    }

    if (replace) global.history.replaceState({ materialsVfList: categoryId }, "", url);
    else global.history.pushState({ materialsVfList: categoryId }, "", url);
  }

  function collectFormats(items) {
    const formats = new Map();
    items.forEach((item) => {
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        if (key) formats.set(key, (formats.get(key) || 0) + 1);
      });
    });
    return formats;
  }

  function collectTags(items, genericSet) {
    const tags = new Map();
    items.forEach((item) => {
      (item.tags || []).forEach((t) => {
        const key = String(t);
        if (genericSet && genericSet.has(key.toLowerCase())) return;
        if (key) tags.set(key, (tags.get(key) || 0) + 1);
      });
    });
    return tags;
  }

  function collectOptions(profile, categoryId, items) {
    const GF = genreFilter();
    const formats = collectFormats(items);
    const orientations = new Map();
    items.forEach((item) => {
      const ori = orientationFromItem(item);
      if (ori) orientations.set(ori, (orientations.get(ori) || 0) + 1);
    });

    if (profile === "image" && GF) {
      return {
        genreCounts: GF.collectDemandCounts(items, "image"),
        usageCounts: GF.collectFieldCounts(items, "use_case", GF.PAYLOAD.imageUseCases),
        peopleCounts: GF.collectFieldCounts(items, "people_presence", GF.PAYLOAD.imagePeople),
        colorCounts: GF.collectFieldCounts(items, "color_family", GF.PAYLOAD.imageColors),
        styleCounts: GF.collectFieldCounts(items, "style", GF.PAYLOAD.imageStyles || []),
        orientations,
        formats,
        tags: collectTags(items, new Set(["image", "png", "jpg", "jpeg", "webp", "画像", "画像素材"])),
      };
    }
    if (profile === "illustration" && GF) {
      return {
        genreCounts: GF.collectDemandCounts(items, "illustration"),
        usageCounts: GF.collectFieldCounts(items, "use_case", GF.PAYLOAD.illustrationUseCases || []),
        peopleCounts: GF.collectFieldCounts(items, "people_presence", GF.PAYLOAD.imagePeople),
        colorCounts: GF.collectFieldCounts(items, "color_family", GF.PAYLOAD.imageColors),
        styleCounts: GF.collectFieldCounts(items, "style", GF.PAYLOAD.illustrationStyles || []),
        orientations,
        formats,
        tags: collectTags(items, null),
      };
    }
    if (profile === "background" && GF) {
      return {
        genreCounts: GF.collectDemandCounts(items, "background"),
        usageCounts: GF.collectFieldCounts(items, "use_case", GF.PAYLOAD.backgroundUseCases || []),
        colorCounts: GF.collectFieldCounts(items, "color_family", GF.PAYLOAD.imageColors),
        styleCounts: GF.collectFieldCounts(items, "style", GF.PAYLOAD.backgroundStyles || []),
        brightnessCounts: GF.collectFieldCounts(items, "brightness", GF.PAYLOAD.backgroundBrightness || []),
        orientations,
        formats,
        tags: collectTags(items, null),
      };
    }
    if (profile === "icon" && GF) {
      return {
        genreCounts: GF.collectDemandCounts(items, "icon"),
        usageCounts: GF.collectFieldCounts(items, "use_case", GF.PAYLOAD.iconUseCases || []),
        styleCounts: GF.collectFieldCounts(items, "style", GF.PAYLOAD.iconStyles || []),
        strokeCounts: GF.collectFieldCounts(items, "stroke_width", GF.PAYLOAD.iconStrokes || []),
        colorCounts: GF.collectFieldCounts(items, "color_family", GF.PAYLOAD.imageColors),
        formats,
        tags: collectTags(items, null),
      };
    }
    if (profile === "audio_bgm" && GF) {
      return {
        genreCounts: GF.collectDemandCounts(items, "bgm"),
        usageCounts: GF.collectFieldCounts(items, "use_case", GF.PAYLOAD.bgmUseCases || []),
        formats,
        tags: collectTags(items, new Set(["bgm", "wav", "mp3", "audio", "音楽"])),
      };
    }
    if (profile === "audio_sfx" && GF) {
      return {
        genreCounts: GF.collectDemandCounts(items, "sfx"),
        usageCounts: GF.collectFieldCounts(items, "use_case", GF.PAYLOAD.sfxUseCases || []),
        styleCounts: GF.collectFieldCounts(items, "style", GF.PAYLOAD.sfxStyles || []),
        formats,
        tags: collectTags(items, new Set(["sfx", "se", "効果音"])),
      };
    }
    return { formats, tags: collectTags(items, null), orientations };
  }

  function applyFilters(profile, categoryId, items, state) {
    const GF = genreFilter();
    return items.filter((item) => {
      if (item.category_id !== categoryId) return false;
      if (profile === "image") {
        if (state.genre && !(GF && GF.matchGenre(item, "image", state.genre))) return false;
        if (state.usage && !(GF && GF.fieldExact(item, "use_case", state.usage))) return false;
        if (state.people && !(GF && GF.fieldExact(item, "people_presence", state.people))) return false;
        if (state.color && !(GF && GF.fieldExact(item, "color_family", state.color))) return false;
        if (state.style && !(GF && GF.fieldExact(item, "style", state.style))) return false;
        if (state.orientation && orientationFromItem(item) !== state.orientation) return false;
        if (state.format) {
          const fmts = (item.file_formats || []).map((f) => String(f).toUpperCase());
          if (!fmts.includes(String(state.format).toUpperCase())) return false;
        }
        return true;
      }
      if (profile === "illustration") {
        if (state.genre && !(GF && GF.matchGenre(item, "illustration", state.genre))) return false;
        if (state.usage && !(GF && GF.fieldExact(item, "use_case", state.usage))) return false;
        if (state.people && !(GF && GF.fieldExact(item, "people_presence", state.people))) return false;
        if (state.color && !(GF && GF.fieldExact(item, "color_family", state.color))) return false;
        if (state.style && !(GF && GF.fieldExact(item, "style", state.style))) return false;
        if (state.background && pickStr(item.background_type, item.meta_background) !== state.background) return false;
        if (state.orientation && orientationFromItem(item) !== state.orientation) return false;
        if (state.format) {
          const fmts = (item.file_formats || []).map((f) => String(f).toUpperCase());
          if (!fmts.includes(String(state.format).toUpperCase())) return false;
        }
        return true;
      }
      if (profile === "background") {
        if (state.genre && !(GF && GF.matchGenre(item, "background", state.genre))) return false;
        if (state.usage && !(GF && GF.fieldExact(item, "use_case", state.usage))) return false;
        if (state.color && !(GF && GF.fieldExact(item, "color_family", state.color))) return false;
        if (state.style && !(GF && GF.fieldExact(item, "style", state.style))) return false;
        if (state.brightness && pickStr(item.brightness) !== state.brightness) return false;
        if (state.orientation && orientationFromItem(item) !== state.orientation) return false;
        if (state.format) {
          const fmts = (item.file_formats || []).map((f) => String(f).toUpperCase());
          if (!fmts.includes(String(state.format).toUpperCase())) return false;
        }
        return true;
      }
      if (profile === "icon") {
        if (state.genre && !(GF && GF.matchGenre(item, "icon", state.genre))) return false;
        if (state.usage && !(GF && GF.fieldExact(item, "use_case", state.usage))) return false;
        if (state.style && !(GF && GF.fieldExact(item, "style", state.style))) return false;
        if (state.stroke && pickStr(item.stroke_width, item.meta_stroke) !== state.stroke) return false;
        if (state.color && !(GF && GF.fieldExact(item, "color_family", state.color))) return false;
        if (state.fill && pickStr(item.fill_style, item.meta_fill) !== state.fill) return false;
        if (state.format) {
          const fmts = (item.file_formats || []).map((f) => String(f).toUpperCase());
          if (!fmts.includes(String(state.format).toUpperCase())) return false;
        }
        return true;
      }
      if (state.format) {
        const fmts = (item.file_formats || []).map((f) => String(f).toUpperCase());
        if (!fmts.includes(String(state.format).toUpperCase())) return false;
      }
      return true;
    });
  }

  function renderSelect(name, label, optionsMap, selected, nameTransform) {
    const entries = [...(optionsMap || new Map()).entries()];
    if (!entries.length) {
      return (
        `<select class="mat-img-filter" data-vf-filter="${escapeHtml(name)}" disabled aria-label="${escapeHtml(label)}">` +
        `<option value="">${escapeHtml(label)}</option></select>`
      );
    }
    return (
      `<select class="mat-img-filter" data-vf-filter="${escapeHtml(name)}" aria-label="${escapeHtml(label)}">` +
      `<option value="">${escapeHtml(label)}</option>` +
      entries
        .map(([value, count]) => {
          const text = nameTransform ? nameTransform(value) : value;
          const sel = selected === value ? " selected" : "";
          return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(text)} (${count})</option>`;
        })
        .join("") +
      `</select>`
    );
  }

  function renderFilterBar(profile, categoryId, options, state) {
    const GF = genreFilter();
    const parts = [];
    if (profile === "image" && GF) {
      parts.push(
        GF.renderGenreSelect?.({
          categoryId: "image",
          selected: state.genre,
          counts: options.genreCounts,
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          filterName: "genre",
        }) || ""
      );
      parts.push(
        GF.renderSelect?.({
          name: "usage",
          label: "用途",
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          selected: state.usage,
          catalog: GF.PAYLOAD.imageUseCases,
          counts: options.usageCounts,
        }) || ""
      );
      parts.push(
        GF.renderSelect?.({
          name: "people",
          label: "人物",
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          selected: state.people,
          catalog: GF.PAYLOAD.imagePeople,
          counts: options.peopleCounts,
        }) || ""
      );
      parts.push(renderSelect("orientation", "向き", options.orientations, state.orientation, orientationLabel));
      parts.push(
        GF.renderSelect?.({
          name: "color",
          label: "色",
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          selected: state.color,
          catalog: GF.PAYLOAD.imageColors,
          counts: options.colorCounts,
        }) || ""
      );
      parts.push(
        GF.renderSelect?.({
          name: "style",
          label: "スタイル",
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          selected: state.style,
          catalog: GF.PAYLOAD.imageStyles || [],
          counts: options.styleCounts,
        }) || ""
      );
      parts.push(renderSelect("format", "形式", options.formats, state.format));
    } else if (profile === "illustration" && GF) {
      parts.push(
        GF.renderGenreSelect?.({
          categoryId: "illustration",
          selected: state.genre,
          counts: options.genreCounts,
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          filterName: "genre",
        }) || ""
      );
      parts.push(
        GF.renderSelect?.({
          name: "usage",
          label: "用途",
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          selected: state.usage,
          catalog: GF.PAYLOAD.illustrationUseCases || [],
          counts: options.usageCounts,
        }) || ""
      );
      parts.push(
        GF.renderSelect?.({
          name: "style",
          label: "スタイル",
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          selected: state.style,
          catalog: GF.PAYLOAD.illustrationStyles || [],
          counts: options.styleCounts,
        }) || ""
      );
      parts.push(renderSelect("orientation", "向き", options.orientations, state.orientation, orientationLabel));
      parts.push(renderSelect("format", "形式", options.formats, state.format));
    } else if (profile === "background" && GF) {
      parts.push(
        GF.renderGenreSelect?.({
          categoryId: "background",
          selected: state.genre,
          counts: options.genreCounts,
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          filterName: "genre",
        }) || ""
      );
      parts.push(
        GF.renderSelect?.({
          name: "usage",
          label: "用途",
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          selected: state.usage,
          catalog: GF.PAYLOAD.backgroundUseCases || [],
          counts: options.usageCounts,
        }) || ""
      );
      parts.push(renderSelect("orientation", "向き", options.orientations, state.orientation, orientationLabel));
      parts.push(renderSelect("format", "形式", options.formats, state.format));
    } else if (profile === "icon" && GF) {
      parts.push(
        GF.renderGenreSelect?.({
          categoryId: "icon",
          selected: state.genre,
          counts: options.genreCounts,
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          filterName: "genre",
        }) || ""
      );
      parts.push(
        GF.renderSelect?.({
          name: "usage",
          label: "用途",
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          selected: state.usage,
          catalog: GF.PAYLOAD.iconUseCases || [],
          counts: options.usageCounts,
        }) || ""
      );
      parts.push(renderSelect("format", "形式", options.formats, state.format));
    } else if (profile === "audio_bgm" && GF) {
      parts.push(
        GF.renderGenreSelect?.({
          categoryId: "bgm",
          selected: state.genre,
          counts: options.genreCounts,
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          filterName: "genre",
        }) || ""
      );
      parts.push(
        GF.renderSelect?.({
          name: "usage",
          label: "用途",
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          selected: state.usage,
          catalog: GF.PAYLOAD.bgmUseCases || [],
          counts: options.usageCounts,
        }) || ""
      );
      parts.push(renderSelect("format", "形式", options.formats, state.format));
    } else if (profile === "audio_sfx" && GF) {
      parts.push(
        GF.renderGenreSelect?.({
          categoryId: "sfx",
          selected: state.genre,
          counts: options.genreCounts,
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          filterName: "genre",
        }) || ""
      );
      parts.push(
        GF.renderSelect?.({
          name: "usage",
          label: "用途",
          className: "mat-img-filter",
          dataAttr: "data-vf-filter",
          selected: state.usage,
          catalog: GF.PAYLOAD.sfxUseCases || [],
          counts: options.usageCounts,
        }) || ""
      );
      parts.push(renderSelect("format", "形式", options.formats, state.format));
    } else if (profile === "motion") {
      parts.push(renderSelect("format", "形式", options.formats, state.format));
    }
    return parts.filter(Boolean).join("");
  }

  function hasActiveFilters(profile, state) {
    if (state.q) return true;
    const skip = new Set(["q", "sort", "page"]);
    return Object.keys(state).some((k) => !skip.has(k) && String(state[k] || "").trim());
  }

  global.TasuMaterialsVfCategoryFilters = {
    readState,
    writeState,
    collectOptions,
    applyFilters,
    renderFilterBar,
    hasActiveFilters,
    orientationLabel,
  };
})(typeof window !== "undefined" ? window : globalThis);
