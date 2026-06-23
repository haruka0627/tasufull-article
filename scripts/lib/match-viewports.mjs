/**
 * TASFUL MATCH — UI verification viewports (single source of truth)
 *
 * - 390×844 … baseline (design priority · screenshot audit)
 * - 390×667 … minimum (horizontal overflow / layout break only)
 * - 393×852 … latest iPhone sanity check
 */

/** @typedef {{ id: string, width: number, height: number, role: "baseline"|"min"|"iphone", label: string }} MatchViewport */

/** @type {MatchViewport} */
export const MATCH_VIEWPORT_BASELINE = Object.freeze({
  id: "390x844",
  width: 390,
  height: 844,
  role: "baseline",
  label: "390×844",
});

/** @type {MatchViewport} */
export const MATCH_VIEWPORT_MIN = Object.freeze({
  id: "390x667",
  width: 390,
  height: 667,
  role: "min",
  label: "390×667",
});

/** @type {MatchViewport} */
export const MATCH_VIEWPORT_IPHONE = Object.freeze({
  id: "393x852",
  width: 393,
  height: 852,
  role: "iphone",
  label: "393×852",
});

/** @type {readonly MatchViewport[]} */
export const MATCH_UI_VIEWPORTS = Object.freeze([
  MATCH_VIEWPORT_BASELINE,
  MATCH_VIEWPORT_MIN,
  MATCH_VIEWPORT_IPHONE,
]);

/** Screenshot audit baseline */
export const MATCH_SCREENSHOT_VIEWPORT = MATCH_VIEWPORT_BASELINE;

/** @param {MatchViewport} vp */
export function matchViewportSize(vp) {
  return { width: vp.width, height: vp.height };
}

/** @param {MatchViewport} vp */
export function isMatchMinViewport(vp) {
  return vp.role === "min";
}

/** @param {import("playwright").Page} page */
export async function assertMatchNoHorizontalOverflow(page, pageKey, viewport) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 2) {
    throw new Error(`${pageKey} horizontal overflow ${overflow}px @${viewport.label}`);
  }
}
