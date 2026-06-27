/**
 * Voice Core — fallback router skeleton (no actual provider switch / connect)
 * Chain: openai_realtime → gemini_live → mock
 */
(function (global) {
  "use strict";

  const DEFAULT_LIVE_CHAIN = Object.freeze([
    { provider: "openai_realtime", kind: "live", label: "OpenAI Live" },
    { provider: "gemini_live", kind: "live", label: "Gemini Live" },
    { provider: "mock", kind: "mock", label: "Mock" },
  ]);

  /**
   * @param {object} [options]
   */
  function createFallbackRouter(options = {}) {
    const chain = Array.isArray(options.chain) && options.chain.length ? options.chain.slice() : DEFAULT_LIVE_CHAIN.slice();
    const mockOnly = options.mockOnly !== false;

    function getPrimary() {
      return chain[0] || null;
    }

    function getFallbackPlan() {
      return chain.slice();
    }

    /**
     * Skeleton: returns planned selection without connecting or failing over.
     * @param {{ provider?: string, kind?: string }} query
     */
    function selectProvider(query = {}) {
      const requested = String(query.provider || getPrimary()?.provider || "mock");
      const hit = chain.find((item) => item.provider === requested);
      return {
        selected: hit || getPrimary(),
        fallbacks: chain.slice(1),
        mockOnly,
        skeleton: true,
      };
    }

    /**
     * Skeleton: returns next provider in chain (no actual switch).
     * @param {string} failedProvider
     */
    function routeOnFailure(failedProvider) {
      const provider = String(failedProvider || "");
      const idx = chain.findIndex((item) => item.provider === provider);
      const next = idx >= 0 ? chain[idx + 1] : chain[chain.length - 1];
      if (!next) {
        return {
          type: "fallback_exhausted_mock",
          failedProvider: provider,
          mockOnly,
          skeleton: true,
          ts: Date.now(),
        };
      }
      return {
        type: "fallback_next_mock",
        failedProvider: provider,
        nextProvider: next.provider,
        nextKind: next.kind,
        nextLabel: next.label,
        mockOnly,
        skeleton: true,
        ts: Date.now(),
      };
    }

    /**
     * Skeleton: simulate full chain walk without API calls.
     */
    function simulateFallbackWalk(startProvider) {
      const steps = [];
      let current = chain.find((item) => item.provider === startProvider) || getPrimary();
      steps.push({ step: "primary", provider: current?.provider, kind: current?.kind });

      const failResult = routeOnFailure(current?.provider || "openai_realtime");
      steps.push({ step: "failure_route", result: failResult });

      if (failResult.nextProvider) {
        const secondFail = routeOnFailure(failResult.nextProvider);
        steps.push({ step: "failure_route_2", result: secondFail });
      }

      return { steps, mockOnly, skeleton: true };
    }

    return {
      getPrimary,
      getFallbackPlan,
      selectProvider,
      routeOnFailure,
      simulateFallbackWalk,
      chain,
      mockOnly,
    };
  }

  global.TasuVoiceCoreFallbackRouter = {
    DEFAULT_LIVE_CHAIN,
    createFallbackRouter,
  };
})(typeof window !== "undefined" ? window : globalThis);
