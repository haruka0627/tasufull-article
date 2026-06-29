/**
 * Builder AI — Worker / Partner おすすめ候補ランキング（下書き · 採用確定なし）
 * worker_search_assist / partner_search_assist と条件抽出を共有。
 * 将来 Worker/Partner DB 検索 API 接続用 fetchCandidates フックあり。
 */
(function (global) {
  "use strict";

  const ACTION_ID = "candidate_recommendation";
  const RELATED_SEARCH_ACTIONS = Object.freeze({
    worker: "worker_search_assist",
    partner: "partner_search_assist",
  });

  const SCORE_WEIGHTS = Object.freeze({
    category: 30,
    area: 25,
    license: 20,
    availability: 10,
    budget: 15,
    experience: 8,
    history: 10,
    rating: 15,
    invoice: 10,
    insurance: 10,
    kyc: 10,
    scale: 8,
    ngPenalty: 120,
    troublePenalty: 25,
  });

  /** @type {import('./builder-ai-search-assist.js')} — runtime only */
  const SearchAssist = () => global.TasuBuilderAISearchAssist;

  const SAMPLE_WORKERS = Object.freeze([
    {
      id: "w-demo-001",
      name: "田中 健一",
      category: "内装",
      area: "東京都",
      license: "第二種電工",
      availability: "対応可能",
      rateYen: 20000,
      experienceYears: 12,
      historyCount: 28,
      rating: 4.6,
      kyc: true,
      ng: false,
      ngNote: "",
      trouble: false,
      insurance: false,
      invoiceReg: false,
      scale: "小規模〜中規模",
    },
    {
      id: "w-demo-002",
      name: "鈴木 太郎",
      category: "内装",
      area: "東京都",
      license: "第二種電工",
      availability: "対応可能",
      rateYen: 18000,
      experienceYears: 8,
      historyCount: 15,
      rating: 4.2,
      kyc: true,
      ng: true,
      ngNote: "過去トラブル報告あり（運営確認中）",
      trouble: true,
      insurance: false,
      invoiceReg: false,
      scale: "小規模",
    },
    {
      id: "w-demo-003",
      name: "山田 誠",
      category: "内装",
      area: "大阪府",
      license: "第二種電工",
      availability: "対応可能",
      rateYen: 19000,
      experienceYears: 10,
      historyCount: 20,
      rating: 4.4,
      kyc: true,
      ng: false,
      ngNote: "",
      trouble: false,
      insurance: false,
      invoiceReg: false,
      scale: "中規模",
    },
    {
      id: "w-demo-004",
      name: "佐藤 亮",
      category: "内装",
      area: "東京都",
      license: "なし",
      availability: "対応中",
      rateYen: 25000,
      experienceYears: 5,
      historyCount: 8,
      rating: 3.8,
      kyc: false,
      ng: false,
      ngNote: "",
      trouble: false,
      insurance: false,
      invoiceReg: false,
      scale: "小規模",
    },
  ]);

  const SAMPLE_PARTNERS = Object.freeze([
    {
      id: "p-demo-001",
      companyName: "サンプルリフォーム株式会社",
      tradeName: "サンプル工務",
      category: "総合リフォーム",
      area: "神奈川県",
      license: "建設業許可",
      availability: "対応可能",
      budgetYen: 1200000,
      experienceYears: 15,
      historyCount: 42,
      rating: 4.7,
      kyc: true,
      ng: false,
      ngNote: "",
      trouble: false,
      insurance: true,
      invoiceReg: true,
      scale: "中〜大規模",
    },
    {
      id: "p-demo-002",
      companyName: "注意フラグ工業",
      tradeName: "注意工業",
      category: "総合リフォーム",
      area: "神奈川県",
      license: "建設業許可",
      availability: "対応可能",
      budgetYen: 980000,
      experienceYears: 10,
      historyCount: 18,
      rating: 4.0,
      kyc: true,
      ng: true,
      ngNote: "NGフラグ: 書類不備（運営再確認待ち）",
      trouble: true,
      insurance: true,
      invoiceReg: true,
      scale: "中規模",
    },
    {
      id: "p-demo-003",
      companyName: "関西総合建設",
      tradeName: "関西建設",
      category: "総合リフォーム",
      area: "大阪府",
      license: "建設業許可",
      availability: "対応可能",
      budgetYen: 1100000,
      experienceYears: 20,
      historyCount: 55,
      rating: 4.5,
      kyc: true,
      ng: false,
      ngNote: "",
      trouble: false,
      insurance: true,
      invoiceReg: true,
      scale: "大規模",
    },
    {
      id: "p-demo-004",
      companyName: "未登録協力会社",
      tradeName: "未登録工房",
      category: "内装",
      area: "神奈川県",
      license: "なし",
      availability: "対応可能",
      budgetYen: 800000,
      experienceYears: 3,
      historyCount: 4,
      rating: 3.5,
      kyc: false,
      ng: false,
      ngNote: "",
      trouble: false,
      insurance: false,
      invoiceReg: false,
      scale: "小規模",
    },
  ]);

  function detectKind(userText) {
    const t = String(userText || "");
    if (/Worker|ワーカー|職人|作業員/.test(t) && !/業者|Partner|協力会社/.test(t)) return "worker";
    if (/業者|Partner|協力会社|パートナー/.test(t) && !/Worker|ワーカー|職人/.test(t)) return "partner";
    if (/worker_search|業者検索|partner_search/.test(t)) return "partner";
    return "worker";
  }

  function parseBudgetYen(text) {
    const m = String(text || "").match(/(?:予算|単価|日当)[:：\s]*([\d,]+)/i);
    if (!m) return NaN;
    return Number(String(m[1]).replace(/[,，]/g, ""));
  }

  function includesArea(required, candidateArea) {
    const r = String(required || "").trim();
    const c = String(candidateArea || "").trim();
    if (!r || !c) return null;
    if (c.includes(r) || r.includes(c)) return true;
    const pref = r.replace(/都|府|県.*$/, "");
    if (pref && c.includes(pref)) return true;
    return false;
  }

  function includesCategory(required, candidateCat) {
    const r = String(required || "").trim().toLowerCase();
    const c = String(candidateCat || "").trim().toLowerCase();
    if (!r || !c) return null;
    return c.includes(r) || r.includes(c);
  }

  function licenseMatch(required, candidateLicense) {
    const r = String(required || "").trim();
    const c = String(candidateLicense || "").trim();
    if (!r) return null;
    if (!c || c === "なし") return false;
    return c.includes(r) || r.includes(c);
  }

  function scoreWorker(candidate, req, budgetYen) {
    const reasons = [];
    const warnings = [];
    let score = 0;

    const cat = includesCategory(req.category, candidate.category);
    if (cat === true) {
      score += SCORE_WEIGHTS.category;
      reasons.push("案件カテゴリと一致");
    } else if (cat === false) warnings.push("カテゴリ不一致の可能性");

    const area = includesArea(req.area, candidate.area);
    if (area === true) {
      score += SCORE_WEIGHTS.area;
      reasons.push("対応エリア一致");
    } else if (area === false) warnings.push("対応エリア外の可能性");

    const lic = licenseMatch(req.license, candidate.license);
    if (lic === true) {
      score += SCORE_WEIGHTS.license;
      reasons.push("必要資格を保有");
    } else if (lic === false) warnings.push("必須資格の確認不足");

    if (/対応可能|空き|available/i.test(candidate.availability)) {
      score += SCORE_WEIGHTS.availability;
      reasons.push("稼働状況: 対応可能");
    } else warnings.push(`稼働状況: ${candidate.availability}`);

    if (Number.isFinite(budgetYen) && Number.isFinite(candidate.rateYen)) {
      if (candidate.rateYen <= budgetYen * 1.1) {
        score += SCORE_WEIGHTS.budget;
        reasons.push("希望単価が予算感内");
      } else warnings.push("希望単価が予算感を超過");
    }

    if (candidate.experienceYears >= 5) {
      score += SCORE_WEIGHTS.experience;
      reasons.push(`経験 ${candidate.experienceYears} 年`);
    }
    if (candidate.historyCount >= 10) {
      score += SCORE_WEIGHTS.history;
      reasons.push(`過去案件 ${candidate.historyCount} 件`);
    }
    if (candidate.rating >= 4.0) {
      score += SCORE_WEIGHTS.rating;
      reasons.push(`評価 ${candidate.rating}`);
    }
    if (candidate.kyc) {
      score += SCORE_WEIGHTS.kyc;
      reasons.push("本人確認済み");
    } else warnings.push("本人確認（KYC）未確認");

    if (candidate.ng) {
      score -= SCORE_WEIGHTS.ngPenalty;
      warnings.unshift(`⚠ NGフラグ: ${candidate.ngNote || "運営確認必須"}`);
    }
    if (candidate.trouble) warnings.push("過去トラブル報告あり — 運営確認");

    return { score, reasons, warnings };
  }

  function scorePartner(candidate, req, budgetYen) {
    const reasons = [];
    const warnings = [];
    let score = 0;

    const cat = includesCategory(req.category, candidate.category);
    if (cat === true) {
      score += SCORE_WEIGHTS.category;
      reasons.push("案件カテゴリと一致");
    } else if (cat === false) warnings.push("カテゴリ不一致の可能性");

    const area = includesArea(req.area, candidate.area);
    if (area === true) {
      score += SCORE_WEIGHTS.area;
      reasons.push("対応エリア一致");
    } else if (area === false) warnings.push("対応エリア外の可能性");

    const lic = licenseMatch(req.license, candidate.license);
    if (lic === true) {
      score += SCORE_WEIGHTS.license;
      reasons.push("必要資格を保有");
    } else if (lic === false) warnings.push("必須資格の確認不足");

    if (/対応可能|空き/i.test(candidate.availability)) {
      score += SCORE_WEIGHTS.availability;
      reasons.push("稼働状況: 対応可能");
    }

    if (/インボイス|登録番号/.test(String(req.invoiceReg || "")) || /インボイス/.test(JSON.stringify(req))) {
      if (candidate.invoiceReg) {
        score += SCORE_WEIGHTS.invoice;
        reasons.push("インボイス登録あり");
      } else warnings.push("インボイス登録の確認不足");
    }

    if (/保険/.test(String(req.insurance || "")) || /保険/.test(JSON.stringify(req))) {
      if (candidate.insurance) {
        score += SCORE_WEIGHTS.insurance;
        reasons.push("保険加入確認");
      } else warnings.push("保険加入の確認不足");
    }

    if (Number.isFinite(budgetYen) && Number.isFinite(candidate.budgetYen)) {
      if (candidate.budgetYen <= budgetYen * 1.15) {
        score += SCORE_WEIGHTS.budget;
        reasons.push("予算感と整合");
      } else warnings.push("予算感を超過する可能性");
    }

    if (candidate.experienceYears >= 5) score += SCORE_WEIGHTS.experience;
    if (candidate.historyCount >= 10) {
      score += SCORE_WEIGHTS.history;
      reasons.push(`過去案件 ${candidate.historyCount} 件`);
    }
    if (candidate.rating >= 4.0) {
      score += SCORE_WEIGHTS.rating;
      reasons.push(`評価 ${candidate.rating}`);
    }
    if (candidate.kyc) {
      score += SCORE_WEIGHTS.kyc;
      reasons.push("本人確認済み");
    } else warnings.push("KYC未確認");

    if (candidate.ng) {
      score -= SCORE_WEIGHTS.ngPenalty;
      warnings.unshift(`⚠ NGフラグ: ${candidate.ngNote || "運営確認必須"}`);
    }
    if (candidate.trouble) {
      score -= SCORE_WEIGHTS.troublePenalty;
      warnings.push("過去トラブル報告あり");
    }

    return { score, reasons, warnings };
  }

  /**
   * 将来 API 接続用。未接続時は sample データ。
   * @param {"worker"|"partner"} kind
   * @param {object} requirements
   * @returns {Promise<object[]>}
   */
  async function fetchCandidates(kind, requirements) {
    const repo = global.TasuBuilderSearchRepository;
    if (repo?.fetchCandidates) {
      try {
        const rows = await repo.fetchCandidates(kind, requirements || {});
        if (Array.isArray(rows) && rows.length) return rows;
      } catch {
        /* demo fallback below */
      }
    }
    return kind === "worker" ? [...SAMPLE_WORKERS] : [...SAMPLE_PARTNERS];
  }

  function buildComparisonTable(kind, ranked) {
    if (kind === "worker") {
      const head = "| 順位 | 氏名 | カテゴリ | エリア | 資格 | 単価 | 評価 | NG | スコア |";
      const sep = "| --- | --- | --- | --- | --- | --- | --- | --- | --- |";
      const rows = ranked.map((r, i) => {
        const c = r.candidate;
        return `| ${i + 1} | ${c.name} | ${c.category} | ${c.area} | ${c.license} | ${c.rateYen?.toLocaleString("ja-JP") || "—"}円 | ${c.rating} | ${c.ng ? "⚠" : "—"} | ${r.score} |`;
      });
      return [head, sep, ...rows].join("\n");
    }
    const head = "| 順位 | 会社名 | カテゴリ | エリア | 資格 | インボイス | 保険 | 評価 | NG | スコア |";
    const sep = "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |";
    const rows = ranked.map((r, i) => {
      const c = r.candidate;
      return `| ${i + 1} | ${c.companyName} | ${c.category} | ${c.area} | ${c.license} | ${c.invoiceReg ? "あり" : "未"} | ${c.insurance ? "あり" : "未"} | ${c.rating} | ${c.ng ? "⚠" : "—"} | ${r.score} |`;
    });
    return [head, sep, ...rows].join("\n");
  }

  function collectMissingInfo(kind, req, ranked) {
    const missing = [];
    if (!req.category) missing.push("案件カテゴリ");
    if (!req.area) missing.push("対応エリア");
    if (!req.license && /資格|電工|許可/.test(JSON.stringify(req))) missing.push("必須資格の明示");
    if (kind === "worker" && !req.rate) missing.push("希望単価・予算感");
    if (kind === "partner" && !req.invoiceReg) missing.push("インボイス要否");
    const unverified = ranked.filter((r) => r.warnings.some((w) => /KYC|本人確認|資格|保険|インボイス/.test(w)));
    if (unverified.length) missing.push("候補ごとの資格・保険・KYC の実データ確認（サンプルデータのため）");
    return missing;
  }

  function adminReviewItems(ranked) {
    const items = ["最終選定・採用・契約・手配確定は運営または依頼者が行う"];
    ranked.forEach((r) => {
      if (r.candidate.ng) items.push(`${labelFor(r)} — NGフラグの運営確認`);
      if (r.warnings.some((w) => /資格|KYC|保険|インボイス/.test(w))) {
        items.push(`${labelFor(r)} — 資格・保険・KYC の書類確認`);
      }
    });
    return [...new Set(items)];
  }

  function labelFor(row) {
    const c = row.candidate;
    return c.name || c.companyName || c.id;
  }

  /**
   * @param {string} userText
   * @param {{ contextText?: string, kind?: string, candidates?: object[] }} [opts]
   */
  function run(userText, opts) {
    const kind = opts?.kind || detectKind(userText);
    const Search = SearchAssist();
    const fields = kind === "worker" ? Search?.WORKER_FIELDS : Search?.PARTNER_FIELDS;
    const req = fields ? Search.extractFields(userText, fields) : {};
    const budgetYen = parseBudgetYen(userText + " " + (req.rate || req.budget || ""));
    const ctx = String(opts?.contextText || "").trim();
    const candidates = opts?.candidates || (kind === "worker" ? SAMPLE_WORKERS : SAMPLE_PARTNERS);
    const scoreFn = kind === "worker" ? scoreWorker : scorePartner;

    const ranked = candidates
      .map((candidate) => {
        const { score, reasons, warnings } = scoreFn(candidate, req, budgetYen);
        return { candidate, score, reasons, warnings };
      })
      .sort((a, b) => b.score - a.score);

    const title = kind === "worker" ? "Workerおすすめ候補" : "業者・Partnerおすすめ候補";
    const searchAction = RELATED_SEARCH_ACTIONS[kind];

    const rankingLines = ranked.map((r, i) => {
      const label = labelFor(r);
      const ngMark = r.candidate.ng ? " ⚠NG注意" : "";
      return [
        `### ${i + 1}位: ${label}（参考スコア: ${r.score}）${ngMark}`,
        "**推薦理由:** " + (r.reasons.length ? r.reasons.join(" · ") : "（条件不足のため参考値のみ）"),
        r.warnings.length ? "**注意点:** " + r.warnings.join(" · ") : "",
      ]
        .filter(Boolean)
        .join("\n");
    });

    const missing = collectMissingInfo(kind, req, ranked);
    const adminItems = adminReviewItems(ranked);

    const body = [
      `【${title} — 下書き・確認用】`,
      "",
      "## 案件条件（入力整理）",
      `- 種別: ${kind === "worker" ? "Worker" : "業者/Partner"}`,
      `- カテゴリ: ${req.category || "（未指定）"}`,
      `- エリア: ${req.area || "（未指定）"}`,
      `- 資格: ${req.license || "（未指定）"}`,
      kind === "worker"
        ? `- 希望単価/予算: ${req.rate || (Number.isFinite(budgetYen) ? `${budgetYen.toLocaleString("ja-JP")}円` : "（未指定）")}`
        : `- インボイス: ${req.invoiceReg || "（未指定）"} · 保険: ${req.insurance || "（未指定）"}`,
      ctx ? `\n## 案件コンテキスト（参考）\n${ctx.slice(0, 600)}` : "",
      "",
      "## おすすめ候補ランキング（参考 · 確定選定ではありません）",
      ...rankingLines,
      "",
      "## 候補比較表",
      buildComparisonTable(kind, ranked),
      "",
      "## 不足情報",
      missing.length ? missing.map((m) => `- ${m}`).join("\n") : "- （主要条件は入力済み — 現場詳細は追加確認）",
      "",
      "## 運営確認が必要な項目",
      ...adminItems.map((a) => `- ${a}`),
      "",
      "## 関連アクション",
      `- 条件整理: \`${searchAction}\``,
      "- 本ランキング: `candidate_recommendation`",
      "",
      "## 重要な注意",
      "- **AIは採用確定・契約確定・業者自動決定を行いません。**",
      "- **最終判断は運営または依頼者が行ってください。**",
      "- 候補データはサンプル/モックです。実DB接続後は API 結果に置き換わります。",
      "- NGフラグ候補は参考順位に含めても、**そのまま選定しないでください。**",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      ok: true,
      draftBody: body,
      kind,
      ranked,
      requirements: req,
      apiReady: false,
      relatedSearchAction: searchAction,
    };
  }

  function isRecommendAction(actionId) {
    return actionId === ACTION_ID;
  }

  global.TasuBuilderAICandidateRecommend = {
    ACTION_ID,
    RELATED_SEARCH_ACTIONS,
    SCORE_WEIGHTS,
    SAMPLE_WORKERS,
    SAMPLE_PARTNERS,
    detectKind,
    scoreWorker,
    scorePartner,
    fetchCandidates,
    run,
    isRecommendAction,
  };
})(typeof window !== "undefined" ? window : globalThis);
