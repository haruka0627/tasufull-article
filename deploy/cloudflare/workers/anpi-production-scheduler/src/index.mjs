/**
 * ANPI Production scheduler — DRAFT stub (Phase 65)
 *
 * DO NOT DEPLOY until:
 * 1) Production adapter accepts ANPI_ENVIRONMENT=production + Production ref
 * 2) Human cutover approval (Phase 64/65)
 * 3) Runtime pause runbook followed
 *
 * This file intentionally fails closed so an accidental deploy cannot claim.
 */

export default {
  async scheduled() {
    console.log(
      JSON.stringify({
        service: "anpi-scheduler",
        environment: "production",
        status: "FAIL",
        error_code: "anpi_prod_worker_draft_not_wired",
      })
    );
  },
  async fetch() {
    return new Response(
      JSON.stringify({
        service: "anpi-production-scheduler",
        ok: false,
        error_code: "anpi_prod_worker_draft_not_wired",
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  },
};
