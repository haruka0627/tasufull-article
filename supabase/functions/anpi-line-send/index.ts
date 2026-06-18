import { handleOptions, jsonResponse } from "../_shared/cors.ts";

type RequestBody = {
  line_user_id?: string;
  message?: string;
  notification_type?: string;
  contract_holder_id?: string;
  log_id?: string;
  force_fail?: boolean;
  line_status?: string;
  line_sent_at?: string | null;
};

const DELIVERABLE_TYPES = new Set([
  "urgent_keyword_detected",
  "emergency",
  "anpi_alert",
  "manual_alert",
]);

const ERROR_CODES = {
  TOKEN_MISSING: "TOKEN_MISSING",
  LINE_API_ERROR: "LINE_API_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  INVALID_USER: "INVALID_USER",
  INVALID_REQUEST: "INVALID_REQUEST",
  ALREADY_SENT: "ALREADY_SENT",
  SEND_IN_PROGRESS: "SEND_IN_PROGRESS",
  NOT_DELIVERABLE: "NOT_DELIVERABLE",
  UNKNOWN: "UNKNOWN",
} as const;

function trim(value: unknown, maxLen = 2000): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

function isMockMode(): boolean {
  const flag = Deno.env.get("ANPI_LINE_MOCK")?.trim();
  if (flag === "1" || flag === "true") return true;
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")?.trim();
  return !token;
}

function mapLineApiError(status: number, errText: string): string {
  const t = errText.toLowerCase();
  if (status === 400 && (t.includes("user") || t.includes("to"))) {
    return ERROR_CODES.INVALID_USER;
  }
  return ERROR_CODES.LINE_API_ERROR;
}

function failurePayload(
  partial: Record<string, unknown> & {
    error_message: string;
    error_code: string;
  }
) {
  return jsonResponse({
    ok: true,
    success: false,
    line_sent_at: null,
    line_status: "failed",
    error_message: partial.error_message,
    error_code: partial.error_code,
    ...partial,
  });
}

async function sendLinePushMessage(
  lineUserId: string,
  message: string
): Promise<{ ok: boolean; error_message?: string; error_code?: string }> {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")?.trim();
  if (!token) {
    return {
      ok: false,
      error_message: "LINE_CHANNEL_ACCESS_TOKEN is not configured",
      error_code: ERROR_CODES.TOKEN_MISSING,
    };
  }

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: message }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        error_message: `LINE API error (${res.status})${errText ? `: ${errText.slice(0, 200)}` : ""}`,
        error_code: mapLineApiError(res.status, errText),
      };
    }

    return { ok: true };
  } catch (err) {
    const error_message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error_message,
      error_code: ERROR_CODES.NETWORK_ERROR,
    };
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        success: false,
        message: "Method not allowed",
        error_code: ERROR_CODES.INVALID_REQUEST,
      },
      405
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse(
      {
        ok: false,
        success: false,
        message: "Invalid JSON body",
        error_code: ERROR_CODES.INVALID_REQUEST,
      },
      400
    );
  }

  const line_user_id = trim(body.line_user_id, 120);
  const message = trim(body.message, 5000);
  const notification_type = trim(body.notification_type, 80);
  const contract_holder_id = trim(body.contract_holder_id, 120);
  const log_id = trim(body.log_id, 120);

  if (!line_user_id) {
    return jsonResponse(
      {
        ok: false,
        success: false,
        message: "line_user_id is required",
        error_code: ERROR_CODES.INVALID_USER,
      },
      400
    );
  }
  if (!message) {
    return jsonResponse(
      {
        ok: false,
        success: false,
        message: "message is required",
        error_code: ERROR_CODES.INVALID_REQUEST,
      },
      400
    );
  }

  if (body.line_status === "sent" || body.line_sent_at) {
    return jsonResponse({
      ok: true,
      success: true,
      skipped: true,
      reason: "already_sent",
      line_sent_at: body.line_sent_at || null,
      line_status: "sent",
      error_message: null,
      error_code: null,
      line_user_id,
      notification_type,
      contract_holder_id,
      log_id,
      mock: isMockMode(),
    });
  }

  if (notification_type && !DELIVERABLE_TYPES.has(notification_type)) {
    return failurePayload({
      error_message: `Notification type not deliverable: ${notification_type}`,
      error_code: ERROR_CODES.NOT_DELIVERABLE,
      line_user_id,
      notification_type,
      contract_holder_id,
      log_id,
      mock: isMockMode(),
    });
  }

  if (body.force_fail === true) {
    return failurePayload({
      error_message: "Mock failure (force_fail)",
      error_code: ERROR_CODES.UNKNOWN,
      line_user_id,
      notification_type,
      contract_holder_id,
      log_id,
      mock: true,
    });
  }

  const sentAt = new Date().toISOString();

  if (isMockMode()) {
    return jsonResponse({
      ok: true,
      success: true,
      line_sent_at: sentAt,
      line_status: "sent",
      error_message: null,
      error_code: null,
      line_user_id,
      notification_type,
      contract_holder_id,
      log_id,
      mock: true,
    });
  }

  const result = await sendLinePushMessage(line_user_id, message);
  if (!result.ok) {
    return failurePayload({
      error_message: result.error_message || "LINE send failed",
      error_code: result.error_code || ERROR_CODES.UNKNOWN,
      line_user_id,
      notification_type,
      contract_holder_id,
      log_id,
      mock: false,
    });
  }

  return jsonResponse({
    ok: true,
    success: true,
    line_sent_at: sentAt,
    line_status: "sent",
    error_message: null,
    error_code: null,
    line_user_id,
    notification_type,
    contract_holder_id,
    log_id,
    mock: false,
  });
});
