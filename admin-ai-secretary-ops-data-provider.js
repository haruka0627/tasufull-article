/**
 * AI 秘書 Phase 6 — Operations Data Provider（Mock · DeepSeek 抽象 · Gateway 非経由）
 * 将来 API / DeepSeek 要約も同一 OpsSnapshot 構造で返す。
 */
(function (global) {
  "use strict";

  const SCHEMA = "ops_snapshot_v1";
  const DOMAINS = Object.freeze(["builder", "platform", "tlv", "materials"]);

  const DOMAIN_LABELS = Object.freeze({
    builder: "Builder",
    platform: "Platform",
    tlv: "TLV",
    materials: "Materials",
  });

  /**
   * @typedef {object} OpsMetricV1
   * @property {string} id
   * @property {string} label
   * @property {number} value
   * @property {number} [baseline]
   * @property {string} [unit]
   * @property {'up'|'down'|'flat'} [trend]
   */

  /**
   * @typedef {object} OpsDomainSnapshotV1
   * @property {string} schema
   * @property {string} domain
   * @property {string} label
   * @property {string} fetchedAt
   * @property {OpsMetricV1[]} metrics
   * @property {object} [meta]
   */

  function pctDelta(current, baseline) {
    const c = Number(current);
    const b = Number(baseline);
    if (!Number.isFinite(c) || !Number.isFinite(b) || b === 0) return 0;
    return Math.round(((c - b) / b) * 1000) / 10;
  }

  function metric(id, label, value, baseline, unit) {
    const delta = pctDelta(value, baseline);
    let trend = "flat";
    if (delta > 2) trend = "up";
    else if (delta < -2) trend = "down";
    return { id, label, value, baseline, unit: unit || "", trend, deltaPct: delta };
  }

  function snapshot(domain, metrics, meta) {
    return {
      schema: SCHEMA,
      domain,
      label: DOMAIN_LABELS[domain] || domain,
      fetchedAt: new Date().toISOString(),
      metrics,
      meta: meta || {},
    };
  }

  /** Programmatic mock — 将来は API / DB 集計に差し替え */
  function buildMockSnapshots() {
    return [
      snapshot("builder", [
        metric("inquiry_count", "問い合わせ件数", 42, 30, "件/7日"),
        metric("conversion_rate", "成約率", 18, 24, "%"),
        metric("reply_delay_hours", "平均返信遅延", 6.2, 3.8, "時間"),
      ]),
      snapshot("platform", [
        metric("post_count", "投稿数", 128, 156, "件/7日"),
        metric("talk_usage_rate", "Talk利用率", 22, 31, "%"),
        metric("ng_post_count", "NG投稿", 9, 4, "件/7日"),
      ]),
      snapshot("tlv", [
        metric("registration_rate", "登録率", 2.1, 3.4, "%"),
        metric("watch_time_minutes", "平均視聴時間", 4.2, 6.8, "分"),
      ]),
      snapshot("materials", [
        metric("download_count", "ダウンロード数", 890, 520, "件/7日"),
        metric("top_category_shift", "人気カテゴリ変化指数", 1.35, 1.0, "指数"),
      ]),
    ];
  }

  /** 既存 OPS モジュールから読取のみ（変更なし） */
  function tryAugmentFromGlobals(snapshots) {
    const out = snapshots.map((s) => ({ ...s, metrics: [...s.metrics] }));
    const kpi = global.TasuAdminAiKpiCenter?.collectKpiMetrics?.();
    const watch = global.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();

    if (kpi && typeof kpi === "object") {
      const builder = out.find((s) => s.domain === "builder");
      if (builder && Number.isFinite(kpi.builderInquiries)) {
        builder.metrics.push(
          metric("kpi_builder_inquiries", "KPI 問い合わせ（参照）", kpi.builderInquiries, kpi.builderInquiries, "件")
        );
        builder.meta.kpiAugmented = true;
      }
    }

    if (watch?.anomalies?.length) {
      const platform = out.find((s) => s.domain === "platform");
      if (platform) {
        platform.meta.opsWatchAnomalies = watch.anomalies.length;
        platform.meta.opsWatchAt = watch.generatedAt || null;
      }
    }

    return out;
  }

  function createMockDataProvider(options) {
    options = options || {};
    return {
      id: "mock",
      label: "Mock Ops Data",
      async fetchSnapshots(ctx) {
        let snapshots = buildMockSnapshots();
        if (options.augmentFromGlobals !== false && typeof global !== "undefined") {
          snapshots = tryAugmentFromGlobals(snapshots);
        }
        return {
          ok: true,
          providerId: "mock",
          schema: SCHEMA,
          fetchedAt: new Date().toISOString(),
          snapshots,
          ctx: ctx || {},
        };
      },
    };
  }

  /**
   * DeepSeek 経路の抽象（Phase 6: 構造のみ · LLM 呼び出しなし）
   * 将来: metrics 要約を Adapter へ渡し OpsSnapshot.meta.enrichment に格納
   */
  function createDeepSeekDataProvider(options) {
    options = options || {};
    const mockInner = createMockDataProvider({ augmentFromGlobals: options.augmentFromGlobals });
    return {
      id: "deepseek",
      label: "DeepSeek Ops Enrichment (stub)",
      async fetchSnapshots(ctx) {
        const base = await mockInner.fetchSnapshots(ctx);
        return {
          ...base,
          providerId: "deepseek",
          enrichment: {
            mode: "stub",
            note: "DeepSeek enrichment slot — no LLM call in Phase 6",
            readyForAdapter: Boolean(global.TasuSecretaryDeepSeekAdapter?.sendMessage),
          },
        };
      },
    };
  }

  function createCompositeDataProvider(primary, fallback) {
    return {
      id: "composite",
      label: "Composite Ops Data",
      async fetchSnapshots(ctx) {
        const providers = [primary, fallback].filter(Boolean);
        for (const p of providers) {
          try {
            const result = await p.fetchSnapshots(ctx);
            if (result?.ok && Array.isArray(result.snapshots)) return result;
          } catch {
            /* try next */
          }
        }
        return { ok: false, providerId: "none", snapshots: [], error: "all_providers_failed" };
      },
    };
  }

  function resolveProvider(options) {
    options = options || {};
    if (options.provider) return options.provider;
    if (options.useDeepSeek === true) return createDeepSeekDataProvider(options);
    return createMockDataProvider(options);
  }

  global.TasuSecretaryOpsDataProvider = {
    SCHEMA,
    DOMAINS,
    DOMAIN_LABELS,
    pctDelta,
    metric,
    snapshot,
    buildMockSnapshots,
    createMockDataProvider,
    createDeepSeekDataProvider,
    createCompositeDataProvider,
    resolveProvider,
  };
})(typeof window !== "undefined" ? window : globalThis);
