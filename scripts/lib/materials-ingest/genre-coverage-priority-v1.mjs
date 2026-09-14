/**
 * Materials category / genre coverage priority V1.
 * Priority bands: ZERO → BELOW_MIN → LOW → DEEPEN.
 * Force-seed only genuinely empty (ZERO) genres; BELOW_MIN competes via score
 * after remaining ZEROs so a just-filled genre cannot starve other empties.
 * Demand weight is only a weak tie-break inside a scarce band.
 */
export const GENRE_COVERAGE_PRIORITY_VERSION = "materials-genre-coverage-priority-v1";

export const COVERAGE_BAND = Object.freeze({
  ZERO: "ZERO",
  BELOW_MIN: "BELOW_MIN",
  LOW: "LOW",
  DEEPEN: "DEEPEN",
});

export const BAND_BOOST = Object.freeze({
  ZERO: 10000,
  BELOW_MIN: 1000,
  LOW: 10,
  DEEPEN: 1,
});

export function coverageBand(count, minTarget) {
  const n = Math.max(0, Number(count) || 0);
  const min = Math.max(1, Number(minTarget) || 1);
  if (n <= 0) return COVERAGE_BAND.ZERO;
  if (n < min) return COVERAGE_BAND.BELOW_MIN;
  if (n < min * 3) return COVERAGE_BAND.LOW;
  return COVERAGE_BAND.DEEPEN;
}

export function shouldSeedCoverageSlot(count, minTarget) {
  const band = coverageBand(count, minTarget);
  return band === COVERAGE_BAND.ZERO;
}

export function starvedQaCoreIds(qaIds, genres, genreCounts, targetFn) {
  const ids = Array.isArray(qaIds) ? qaIds : [];
  return ids.filter((id) => {
    const g = (genres || []).find((x) => x.id === id);
    const target = typeof targetFn === "function" && g ? targetFn(g) : 3;
    return shouldSeedCoverageSlot(genreCounts?.[id] || 0, target);
  });
}

export function coverageShortage(count, target) {
  const n = Math.max(0, Number(count) || 0);
  const t = Math.max(1, Number(target) || 1);
  if (n >= t) return 0.2;
  return Math.max(0.35, (t - n) / t);
}

/**
 * @param {{
 *   demandWeight: number,
 *   genreCount: number,
 *   subCount: number,
 *   target: number,
 *   diversity?: number,
 *   lastGenreId?: string,
 *   genreId?: string,
 *   planGenreShare?: number,
 *   maxShare?: number,
 *   blocked?: boolean,
 * }} opts
 */
export function scoreDemandCandidate(opts = {}) {
  if (opts.blocked === true) {
    return {
      score: 0,
      band: COVERAGE_BAND.DEEPEN,
      cov: 0,
      genreCount: Number(opts.genreCount) || 0,
      subCount: Number(opts.subCount) || 0,
    };
  }
  const demandWeight = Math.max(0.01, Number(opts.demandWeight) || 1);
  const genreCount = Math.max(0, Number(opts.genreCount) || 0);
  const subCount = Math.max(0, Number(opts.subCount) || 0);
  const target = Math.max(1, Number(opts.target) || 1);
  const diversity = Number.isFinite(Number(opts.diversity)) ? Math.max(0.25, Number(opts.diversity)) : 1;
  const band = coverageBand(genreCount, target);
  const scarce = band === COVERAGE_BAND.ZERO || band === COVERAGE_BAND.BELOW_MIN;
  const weight = scarce ? 1 + demandWeight * 0.01 : demandWeight;
  const cov = coverageShortage(subCount, target);
  let score = BAND_BOOST[band] * weight * cov * diversity;
  if (opts.lastGenreId && opts.genreId && opts.lastGenreId === opts.genreId) score *= 0.12;
  const share = Number(opts.planGenreShare) || 0;
  const maxShare = Number(opts.maxShare);
  if (Number.isFinite(maxShare) && maxShare > 0 && share >= maxShare) score *= 0.05;
  return { score, band, cov, genreCount, subCount };
}
