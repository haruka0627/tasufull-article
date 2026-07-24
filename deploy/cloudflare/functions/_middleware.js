/**
 * Help QA legacy slug redirects.
 * oauth-login-* pages were merged into /help/login/ — flat slugs like
 * /help/oauth-login-q4/ are not matched by _redirects splat /help/oauth-login/*.
 */
const LOGIN_HELP_URL = "/help/login/";

function isLegacyOauthLoginSlug(slug) {
  return slug === "oauth-login" || slug.startsWith("oauth-login-");
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const match = pathname.match(/^\/help\/([^/]+)$/);
  if (match && isLegacyOauthLoginSlug(match[1])) {
    return Response.redirect(new URL(LOGIN_HELP_URL, url.origin).toString(), 301);
  }
  return context.next();
}
