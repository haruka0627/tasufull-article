/**
 * ANPI Talk Adapter — shared template / action catalogs (local).
 * No HTML, URLs, secrets, or PII bodies.
 */

export const ANPI_TALK_TEMPLATES = Object.freeze({
  "anpi.initial": { kind: "initial", descriptionSafe: "Daily initial check-in notification" },
  "anpi.reminder": { kind: "reminder", descriptionSafe: "Reminder before overdue" },
  "anpi.contact_unconfirmed": {
    kind: "contact_unconfirmed",
    descriptionSafe: "Emergency contact unconfirmed notice",
  },
  "anpi.late_confirmation": {
    kind: "late_confirmation",
    descriptionSafe: "Late confirmation notice",
  },
  "anpi.system_notice": { kind: "system_notice", descriptionSafe: "System notice" },
  "anpi.delivery_failed": {
    kind: "delivery_failed",
    descriptionSafe: "Delivery failure audit template",
  },
});

export const ANPI_TALK_ACTIONS = Object.freeze({
  open_check: "Open today check",
  confirm: "Confirm check-in",
  view_history: "View check history",
  dashboard: "Open ANPI dashboard",
  history: "Alias for view_history",
});

export function templateForKind(kind) {
  const map = {
    initial: "anpi.initial",
    reminder: "anpi.reminder",
    contact_unconfirmed: "anpi.contact_unconfirmed",
    late_confirmation: "anpi.late_confirmation",
    system_notice: "anpi.system_notice",
  };
  return map[kind] || null;
}

export function defaultActionsForKind(kind) {
  if (kind === "contact_unconfirmed") return ["open_check", "view_history", "dashboard"];
  if (kind === "delivery_failed") return ["dashboard", "view_history"];
  return ["open_check", "confirm", "view_history", "dashboard"];
}

/**
 * Build notification contract from job-shaped input (ids only).
 * Does not accept HTML, URLs, phones, emails, or secrets.
 */
export function buildNotificationContract(job) {
  const templateKey = templateForKind(job.kind);
  if (!templateKey || !ANPI_TALK_TEMPLATES[templateKey]) {
    throw new Error("anpi_unknown_template");
  }
  const actions = defaultActionsForKind(job.kind);
  for (const actionId of actions) {
    if (!ANPI_TALK_ACTIONS[actionId]) throw new Error("anpi_unknown_action");
  }
  const attempt = Math.max(Number(job.attempt_count) || 1, 1);
  const idempotencyKey = job.idempotency_key || `anpi:${job.id}:${attempt}`;
  return Object.freeze({
    schema: "anpi.talk.contract.v1",
    template_key: templateKey,
    parameters: Object.freeze({
      check_id: job.check_id,
      owner_id: job.subject_user_id || job.owner_id,
      kind: job.kind,
    }),
    actions: Object.freeze([...actions]),
    idempotency_key: idempotencyKey,
    channel: "talk",
    scheduler_job_id: job.id,
    attempt_number: attempt,
  });
}

const FORBIDDEN_RE = /(<script|<html|https?:\/\/|mailto:|tel:|service_role|sb_secret|eyJ)/i;

export function validateContract(contract) {
  if (!contract || typeof contract !== "object") return "anpi_invalid_contract";
  const dump = JSON.stringify(contract);
  if (FORBIDDEN_RE.test(dump)) return "anpi_contract_forbidden_content";
  for (const bad of ["html", "body", "url", "phone", "email", "secret"]) {
    if (Object.prototype.hasOwnProperty.call(contract, bad)) {
      return "anpi_contract_forbidden_field";
    }
  }
  if (!ANPI_TALK_TEMPLATES[contract.template_key]) return "anpi_unknown_template";
  const key = contract.idempotency_key;
  if (!key || key.length < 8 || key.length > 200) return "anpi_invalid_idempotency_key";
  const params = contract.parameters;
  if (!params || typeof params !== "object") return "anpi_invalid_parameters";
  if (!params.check_id || !params.kind) return "anpi_parameters_incomplete";
  if (params.phone || params.email || params.destination) return "anpi_parameters_forbidden";
  if (!Array.isArray(contract.actions) || contract.actions.length < 1) {
    return "anpi_invalid_actions";
  }
  for (const actionId of contract.actions) {
    if (!ANPI_TALK_ACTIONS[actionId]) return "anpi_unknown_action";
  }
  return null;
}
