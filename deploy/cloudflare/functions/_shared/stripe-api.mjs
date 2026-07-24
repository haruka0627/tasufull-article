/**
 * Minimal Stripe REST helpers for Cloudflare Pages Functions (fetch only).
 */

function pickStr() {
  for (var i = 0; i < arguments.length; i += 1) {
    var s = String(arguments[i] ?? "").trim();
    if (s) return s;
  }
  return "";
}

function flattenParams(prefix, value, out) {
  if (value === null || value === undefined) return;
  if (typeof value === "object" && !Array.isArray(value)) {
    for (var key of Object.keys(value)) {
      flattenParams(prefix ? prefix + "[" + key + "]" : key, value[key], out);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(function (item, idx) {
      flattenParams(prefix + "[" + idx + "]", item, out);
    });
    return;
  }
  out.append(prefix, String(value));
}

function toFormBody(params) {
  var body = new URLSearchParams();
  flattenParams("", params, body);
  return body.toString();
}

async function stripeRequest(secretKey, method, path, params) {
  var url = "https://api.stripe.com/v1" + path;
  var init = {
    method: method,
    headers: {
      Authorization: "Bearer " + secretKey,
    },
  };
  if (params && method !== "GET") {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = toFormBody(params);
  }
  var res = await fetch(url, init);
  var data = await res.json().catch(function () {
    return { error: { message: "invalid_json" } };
  });
  if (!res.ok) {
    return {
      ok: false,
      error: pickStr(data?.error?.message, data?.error, res.status),
      data: data,
    };
  }
  return { ok: true, data: data };
}

export async function createCheckoutSession(secretKey, opts) {
  var metadata = opts.metadata || {};
  var params = {
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    locale: "ja",
    metadata: metadata,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: opts.amountJpy,
          product_data: {
            name: opts.productName,
            description: pickStr(opts.productDescription),
          },
        },
      },
    ],
  };
  return stripeRequest(secretKey, "POST", "/checkout/sessions", params);
}

export async function retrieveCheckoutSession(secretKey, sessionId) {
  return stripeRequest(secretKey, "GET", "/checkout/sessions/" + encodeURIComponent(sessionId), null);
}

export function isSimulateSessionId(sessionId) {
  return /^prq_sim_/i.test(pickStr(sessionId));
}
