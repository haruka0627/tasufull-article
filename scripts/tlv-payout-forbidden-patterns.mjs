/** @type {RegExp[]} */
export const FORBIDDEN_PAYOUT_RECALC_PATTERNS = [
  /\bgross_revenue\s*\*/,
  /\*\s*applied_rate\b/,
  /\bapplied_rate\s*\*/,
  /Math\.round\s*\(/,
  /\*\s*100\s*\)/,
  /\/\s*100\b/,
];

/** @type {RegExp[]} */
export const FORBIDDEN_STRIPE_API_PATTERNS = [
  /stripe\.com/i,
  /\bStripe\s*\(/,
  /fetch\s*\(\s*['"]https:\/\/api\.stripe/i,
];
