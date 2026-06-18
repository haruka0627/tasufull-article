/**
 * 期間末まで有料維持の判定ロジック（Node で再実装して検証）
 */
function isGenAiPeriodEndActive(periodEnd) {
  if (!periodEnd) return false;
  const t = new Date(periodEnd).getTime();
  return Number.isFinite(t) && t > Date.now();
}

function hasPaidGenAiAccessFromRow(row) {
  if (!row) return false;
  const subscriptionStatus = String(row.subscription_status ?? row.status ?? "").trim();
  if (["unpaid", "incomplete_expired"].includes(subscriptionStatus)) return false;

  const periodEnd = row.current_period_end;
  const periodActive = isGenAiPeriodEndActive(periodEnd);
  const cancelAtPeriodEnd = Boolean(row.cancel_at_period_end);

  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    if (!periodEnd) return true;
    return periodActive;
  }

  if (periodActive) {
    if (cancelAtPeriodEnd) return true;
    if (subscriptionStatus === "canceled") return true;
    const planCode = String(row.plan_code || "");
    if (planCode === "basic_300" || planCode === "pro_980") return true;
  }

  return false;
}

const future = new Date(Date.now() + 7 * 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

const cases = [
  ["active paid", { subscription_status: "active", plan_code: "basic_300", current_period_end: future }, true],
  ["cancel at period end", { subscription_status: "active", cancel_at_period_end: true, plan_code: "basic_300", current_period_end: future }, true],
  ["canceled but period left", { subscription_status: "canceled", plan_code: "basic_300", current_period_end: future }, true],
  ["canceled period ended", { subscription_status: "canceled", plan_code: "basic_300", current_period_end: past }, false],
  ["unpaid immediate free", { subscription_status: "unpaid", plan_code: "basic_300", current_period_end: future }, false],
  ["free row", { subscription_status: "free", plan_code: "free" }, false],
];

let failed = 0;
for (const [name, row, expected] of cases) {
  const got = hasPaidGenAiAccessFromRow(row);
  const ok = got === expected;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name} (expected ${expected}, got ${got})`);
  if (!ok) failed++;
}

process.exit(failed ? 1 : 0);
