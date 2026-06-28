import { corsHeadersFor } from "./cors.ts";

export class TlvPaymentError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "TlvPaymentError";
    this.code = code;
    this.status = status;
  }
}

export function handleTlvPaymentError(err: unknown, req: Request): Response {
  if (err instanceof TlvPaymentError) {
    return new Response(JSON.stringify({ ok: false, error: err.code, message: err.message }), {
      status: err.status,
      headers: { "Content-Type": "application/json", ...corsHeadersFor(req) },
    });
  }
  console.error("[tlv-payment]", err);
  return new Response(JSON.stringify({ ok: false, error: "internal_error", message: "Internal server error" }), {
    status: 500,
    headers: { "Content-Type": "application/json", ...corsHeadersFor(req) },
  });
}
