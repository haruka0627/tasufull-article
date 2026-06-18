/**
 * TASFUL TALK — Service Worker（通話 Push 着信 / scope: /）
 *
 * Builder PWA（/builder/）とは別 SW。最長一致により /builder/* は builder SW が制御。
 */
/* eslint-disable no-restricted-globals */
(function () {
  "use strict";

  const PUSH_TYPE = "talk_call_incoming";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function sanitizeTitle(name) {
    return String(name || "相手")
      .replace(/[<>"']/g, "")
      .slice(0, 80);
  }

  function parsePushData(event) {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  }

  function buildNotificationFromPush(data) {
    const type = pickStr(data.type) || PUSH_TYPE;
    const callId = pickStr(data.call_id, data.callId);
    const roomId = pickStr(data.room_id, data.roomId, data.thread);
    const callerName = sanitizeTitle(data.caller_display_name || data.callerDisplayName);
    const targetUrl = pickStr(data.target_url, data.targetUrl, data.url);

    let href = targetUrl;
    if (!href && roomId && callId) {
      href = `/chat-detail.html?thread=${encodeURIComponent(roomId)}&callId=${encodeURIComponent(callId)}&from=notify`;
    }

    return {
      title: "音声通話の着信",
      body: `${callerName} さんから通話があります`,
      tag: callId ? `talk-call-${callId}` : "talk-call-incoming",
      data: {
        type,
        call_id: callId,
        room_id: roomId,
        target_url: href,
      },
    };
  }

  self.addEventListener("push", (event) => {
    const data = parsePushData(event);
    const note = buildNotificationFromPush(data);
    if (!note.data.call_id && !note.data.target_url) return;

    event.waitUntil(
      self.registration.showNotification(note.title, {
        body: note.body,
        tag: note.tag,
        renotify: true,
        data: note.data,
        silent: false,
      })
    );
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = pickStr(event.notification?.data?.target_url);
    if (!targetUrl) return;

    event.waitUntil(
      (async () => {
        const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of allClients) {
          if (client.url.includes(targetUrl) || client.url.includes(String(event.notification?.data?.call_id || ""))) {
            await client.focus();
            return;
          }
        }
        await self.clients.openWindow(targetUrl);
      })()
    );
  });

  self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
  });
})();
