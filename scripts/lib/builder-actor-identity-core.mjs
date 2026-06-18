/**
 * Builder actor identity コア（Node テスト用）
 */
export function normalizeMvpRole(raw) {
  const r = String(raw || "").trim().toLowerCase();
  if (r === "partner") return "partner";
  if (r === "vendor") return "vendor";
  if (r === "user" || r === "builder") return "user";
  if (r === "owner" || r === "ops") return "owner";
  return "";
}

export function shouldBlockBuilderRoleFallback(env) {
  const cfg = env.config || {};
  if (cfg.talkProductionMode === true) return true;
  const host = String(env.hostname || "").toLowerCase();
  return host === "tasful.jp" || host === "www.tasful.jp";
}

export function matchRoleForUserId(userId, participants) {
  const uid = String(userId || "").trim();
  if (!uid) return { role: "", slot: "none" };
  const p = participants || {};
  if (uid === String(p.ownerId || "").trim()) return { role: "owner", slot: "owner" };
  if (p.posterId && uid === String(p.posterId).trim()) {
    return { role: normalizeMvpRole(p.posterRole) || "owner", slot: "poster" };
  }
  if (p.applicantId && uid === String(p.applicantId).trim()) {
    return { role: normalizeMvpRole(p.applicantRole) || "partner", slot: "applicant" };
  }
  if ((p.partnerIds || []).includes(uid)) return { role: "partner", slot: "partner" };
  return { role: "", slot: "unknown" };
}

export function isGeneralFlowPoster(actor, spec) {
  if (!spec?.poster) return false;
  return String(actor?.id || "").trim() === String(spec.poster.id || "").trim();
}

export function isGeneralFlowApplicant(actor, spec) {
  if (!spec?.applicant) return false;
  return String(actor?.id || "").trim() === String(spec.applicant.id || "").trim();
}
