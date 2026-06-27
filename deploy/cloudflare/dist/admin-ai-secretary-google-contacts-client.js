/**
 * AI秘書 Phase 6-G — Google Contacts client (read-only · Edge proxy only)
 */
(function (global) {
  "use strict";

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function postContactsRead(payload) {
    const OAuth = global.TasuSecretaryGoogleOAuthClient;
    if (!OAuth?.postAction) {
      return Promise.resolve({ ok: false, error: "oauth_client_missing" });
    }
    return OAuth.postAction(OAuth.TOOLS_FN, { action: "contacts_read", ...payload });
  }

  async function listConnections(options) {
    options = options || {};
    const result = await postContactsRead({
      method: "people.connections.list",
      maxResults: options.maxResults || 25,
      pageToken: options.pageToken,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function searchContacts(query, options) {
    options = options || {};
    const result = await postContactsRead({
      method: "people.searchContacts",
      query: trim(query, 200),
      maxResults: options.maxResults || 25,
      pageToken: options.pageToken,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function getContact(resourceName) {
    const result = await postContactsRead({
      method: "people.get",
      resourceName: trim(resourceName, 300),
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function tryWriteBlocked(method) {
    return postContactsRead({ method: trim(method, 80) || "people.createContact" });
  }

  function primaryEmail(contact) {
    contact = contact || {};
    const emails = Array.isArray(contact.emails) ? contact.emails : [];
    return trim(emails[0], 200);
  }

  function applyToGmailReply(contact) {
    const email = primaryEmail(contact);
    if (!email) return { ok: false, error: "email_missing" };
    const workspace = document.querySelector("[data-ops-secretary-google-workspace]");
    workspace?.querySelector('[data-ops-google-tab="mail"]')?.click();
    const input = document.querySelector("[data-ops-secretary-gmail-search-input]");
    if (input) {
      input.value = `to:${email}`;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return { ok: true, email, query: `to:${email}` };
  }

  function applyToCalendarAttendee(contact) {
    const email = primaryEmail(contact);
    if (!email) return { ok: false, error: "email_missing" };
    const workspace = document.querySelector("[data-ops-secretary-google-workspace]");
    workspace?.querySelector('[data-ops-google-tab="calendar"]')?.click();
    const input = document.querySelector("[data-ops-secretary-calendar-create-input]");
    if (input) {
      const name = trim(contact.name, 120);
      input.value = `${name} ${email} を参加者に追加`;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
    return { ok: true, email, hint: `${trim(contact.name, 120)} ${email}` };
  }

  global.TasuSecretaryGoogleContactsClient = {
    listConnections,
    searchContacts,
    getContact,
    tryWriteBlocked,
    primaryEmail,
    applyToGmailReply,
    applyToCalendarAttendee,
  };
})(typeof window !== "undefined" ? window : globalThis);
