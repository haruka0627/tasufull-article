/**
 * Live Platform Chat Gateway — message/reaction/system event（UI 非実装 · TLV 非接続）
 * Phase D · platform-live/chat · surface 必須
 */
(function (global) {
  "use strict";

  const MS = global.PLATFORM_LIVE_CHAT_MESSAGE_STATES || global.TasuLivePlatformChatMessageStates;
  const CE = global.PLATFORM_LIVE_CHAT_EVENTS || global.TasuLivePlatformChatEvents;
  const SET = global.PLATFORM_LIVE_CHAT_SYSTEM_EVENT_TYPES || global.TasuLivePlatformChatSystemEventTypes;
  const BS = global.PLATFORM_LIVE_BROADCAST_STATES || global.TasuLivePlatformBroadcastStates;
  const VS = global.PLATFORM_LIVE_VIEWER_STATES || global.TasuLivePlatformViewerStates;
  const EventBus = global.TasuLivePlatformSessionEventBus;
  const V = () => global.TasuLivePlatformChatValidation;
  const EC = () => global.PLATFORM_LIVE_CHAT_ERROR_CODES || global.TasuLivePlatformChatErrorCodes;
  const ModHook = global.TasuLivePlatformChatModerationHook;
  const RateHook = global.TasuLivePlatformChatRateLimitHook;

  if (!MS || !CE || !EventBus) {
    throw new Error("TasuLivePlatformChatGateway: load chat states/events and core event-bus first");
  }

  class TasuLivePlatformChatGateway {
    /**
     * @param {{
     *   broadcastService?: object,
     *   viewerService?: object,
     *   sessionManager?: object,
     *   provider?: object,
     *   moderationHook?: Function,
     *   rateLimitHook?: Function,
     * }} [options]
     */
    constructor(options = {}) {
      /** @private */
      this._bus = new EventBus();
      /** @private @type {Map<string, object>} */
      this._messages = new Map();
      /** @private @type {Map<string, Map<string, Set<string>>>} messageId -> reaction -> userIds */
      this._reactions = new Map();
      /** @private @type {object[]} */
      this._systemEvents = [];
      /** @private */
      this._msgSeq = 0;
      /** @private */
      this._surface = null;
      /** @private */
      this._disposed = false;
      this._broadcastService = options.broadcastService || null;
      this._viewerService = options.viewerService || null;
      this._sessionManager = options.sessionManager || null;
      this._provider = options.provider || null;
      this._moderationHook = ModHook?.createModerationHook?.(options.moderationHook) || ModHook?.defaultModerationHook;
      this._rateLimitHook = RateHook?.createRateLimitHook?.(options.rateLimitHook) || RateHook?.defaultRateLimitHook;
    }

    /** @param {string} event @param {Function} handler */
    on(event, handler) {
      if (typeof handler !== "function") return this;
      const val = V()?.validateEventName(event);
      if (val && !val.ok) return this;
      this._bus.on(val?.value || String(event || "").trim(), handler);
      return this;
    }

    /** @private @param {Record<string, unknown>} options */
    _requireSurface(options) {
      const sv = V()?.validateSurface(options?.surface);
      if (!sv?.ok) return this._validationFail(sv);
      if (this._surface && this._surface !== sv.value) {
        return this._validationFail({
          ok: false,
          code: EC()?.SURFACE_ERROR || "SURFACE_ERROR",
          message: `surface 不一致（gateway: ${this._surface}, request: ${sv.value}）`,
          field: "surface",
        });
      }
      this._surface = this._surface || sv.value;
      return { ok: true, surface: sv.value };
    }

    /** @private */
    _validateChatContext(options, broadcastId) {
      const bcState = this._broadcastService?.state;
      if (bcState !== BS?.LIVE) {
        return {
          ok: false,
          code: EC()?.BROADCAST_NOT_LIVE || "BROADCAST_NOT_LIVE",
          error: "broadcast が live ではありません",
        };
      }
      const bid = broadcastId || this._broadcastService?.broadcast?.id;
      if (bid && this._broadcastService?.broadcast?.id && bid !== this._broadcastService.broadcast.id) {
        return {
          ok: false,
          code: EC()?.CHAT_VALIDATION_ERROR || "CHAT_VALIDATION_ERROR",
          error: "broadcastId 不一致",
        };
      }

      if (options.userId && this._viewerService) {
        const ws = this._viewerService.getWatchState({
          surface: options.surface,
          userId: options.userId,
        });
        if (!ws.ok || ws.watchState?.viewerState !== VS?.WATCHING) {
          return {
            ok: false,
            code: EC()?.VIEWER_NOT_WATCHING || "VIEWER_NOT_WATCHING",
            error: "viewer が watching ではありません",
          };
        }
      }

      return { ok: true };
    }

    /** @private */
    _nextMessageId() {
      this._msgSeq += 1;
      return `msg-${Date.now()}-${this._msgSeq}`;
    }

    /** @private @param {string} roomKey */
    _roomKey(surface, broadcastId) {
      return `${surface}:${broadcastId}`;
    }

    /**
     * @param {{ surface: string, broadcastId: string, userId: string, text: string }} options
     */
    async sendMessage(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._disposed) return { ok: false, error: "dispose 済みです", code: EC()?.CHAT_STATE_ERROR };

      const uv = V()?.validateUserId(options.userId);
      if (uv && !uv.ok) return this._validationFail(uv);
      const br = V()?.validateBroadcastId(options.broadcastId);
      if (br && !br.ok) return this._validationFail(br);
      const tv = V()?.validateMessageText(options.text);
      if (tv && !tv.ok) return this._validationFail(tv);

      const userId = uv?.value || String(options.userId).trim();
      const broadcastId = br?.value || String(options.broadcastId).trim();
      const text = tv?.value || String(options.text).trim();
      const surface = surfaceCheck.surface;

      const ctxCheck = this._validateChatContext({ surface, userId }, broadcastId);
      if (!ctxCheck.ok) return ctxCheck;

      const rate = this._rateLimitHook({ surface, broadcastId, userId, action: "send_message" });
      this._bus.emit(CE.RATE_LIMIT_ACTION, { surface, broadcastId, userId, ...rate });
      if (rate.action === RateHook?.ACTIONS?.DENY) {
        return {
          ok: false,
          code: EC()?.RATE_LIMIT_DENIED || "RATE_LIMIT_DENIED",
          error: rate.reason || "rate limit denied",
        };
      }
      if (rate.action === RateHook?.ACTIONS?.THROTTLE) {
        return {
          ok: false,
          code: EC()?.RATE_LIMIT_THROTTLED || "RATE_LIMIT_THROTTLED",
          error: rate.reason || "rate limit throttled",
          retryAfterMs: rate.retryAfterMs,
        };
      }

      const messageId = this._nextMessageId();
      const now = new Date().toISOString();
      const message = {
        id: messageId,
        surface,
        broadcastId,
        userId,
        text,
        state: MS.PENDING,
        createdAt: now,
        updatedAt: now,
      };

      this._messages.set(messageId, message);
      this._bus.emit(CE.MESSAGE_PENDING, { ...message });

      const mod = this._moderationHook({ surface, broadcastId, userId, text, messageId });
      this._bus.emit(CE.MODERATION_ACTION, { surface, broadcastId, userId, messageId, ...mod });

      if (mod.action === ModHook?.ACTIONS?.BLOCK) {
        message.state = MS.BLOCKED;
        message.updatedAt = new Date().toISOString();
        message.blockReason = mod.reason || "moderation block";
        this._bus.emit(CE.MESSAGE_BLOCKED, { ...message });
        return {
          ok: false,
          state: message.state,
          message: { ...message },
          code: EC()?.MODERATION_BLOCKED || "MODERATION_BLOCKED",
          error: message.blockReason,
        };
      }

      if (this._provider?.sendChatMessage) {
        const pr = await this._provider.sendChatMessage({
          surface,
          broadcastId,
          userId,
          messageId,
          text,
        });
        if (pr?.ok === false) {
          message.state = MS.FAILED;
          message.updatedAt = new Date().toISOString();
          this._bus.emit(CE.MESSAGE_FAILED, { ...message, error: pr.error });
          return { ok: false, state: message.state, message: { ...message }, error: pr.error, code: EC()?.PROVIDER_ERROR };
        }
      }

      message.state = MS.SENT;
      message.flagged = mod.action === ModHook?.ACTIONS?.FLAG;
      message.updatedAt = new Date().toISOString();
      this._bus.emit(CE.MESSAGE_SENT, { ...message });

      return { ok: true, state: message.state, message: { ...message } };
    }

    /**
     * @param {{ surface: string, broadcastId: string, userId: string, messageId: string, reaction: string }} options
     */
    async addReaction(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const uv = V()?.validateUserId(options.userId);
      if (uv && !uv.ok) return this._validationFail(uv);
      const br = V()?.validateBroadcastId(options.broadcastId);
      if (br && !br.ok) return this._validationFail(br);
      const mid = V()?.validateMessageId(options.messageId);
      if (mid && !mid.ok) return this._validationFail(mid);
      const rr = V()?.validateReaction(options.reaction);
      if (rr && !rr.ok) return this._validationFail(rr);

      const userId = uv?.value || String(options.userId).trim();
      const broadcastId = br?.value || String(options.broadcastId).trim();
      const messageId = mid?.value || String(options.messageId).trim();
      const reaction = rr?.value || String(options.reaction).trim();
      const surface = surfaceCheck.surface;

      const ctxCheck = this._validateChatContext({ surface, userId }, broadcastId);
      if (!ctxCheck.ok) return ctxCheck;

      const msg = this._messages.get(messageId);
      if (!msg || msg.state !== MS.SENT) {
        return { ok: false, error: "message が sent ではありません", code: EC()?.CHAT_STATE_ERROR };
      }

      if (!this._reactions.has(messageId)) this._reactions.set(messageId, new Map());
      const bucket = this._reactions.get(messageId);
      if (!bucket.has(reaction)) bucket.set(reaction, new Set());
      bucket.get(reaction).add(userId);

      if (this._provider?.addChatReaction) {
        await this._provider.addChatReaction({ surface, broadcastId, userId, messageId, reaction });
      }

      const counts = this.getReactionCounts({ surface, messageId });
      this._bus.emit(CE.REACTION_ADDED, {
        surface,
        broadcastId,
        userId,
        messageId,
        reaction,
        counts: counts.counts,
      });

      return { ok: true, messageId, reaction, counts: counts.counts };
    }

    /**
     * @param {{ surface: string, broadcastId: string, userId: string, messageId: string, reaction: string }} options
     */
    async removeReaction(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const uv = V()?.validateUserId(options.userId);
      if (uv && !uv.ok) return this._validationFail(uv);
      const mid = V()?.validateMessageId(options.messageId);
      if (mid && !mid.ok) return this._validationFail(mid);
      const rr = V()?.validateReaction(options.reaction);
      if (rr && !rr.ok) return this._validationFail(rr);

      const userId = uv?.value || String(options.userId).trim();
      const messageId = mid?.value || String(options.messageId).trim();
      const reaction = rr?.value || String(options.reaction).trim();
      const surface = surfaceCheck.surface;

      const bucket = this._reactions.get(messageId);
      if (bucket?.has(reaction)) {
        bucket.get(reaction).delete(userId);
        if (bucket.get(reaction).size === 0) bucket.delete(reaction);
      }

      if (this._provider?.removeChatReaction) {
        await this._provider.removeChatReaction({
          surface,
          broadcastId: options.broadcastId,
          userId,
          messageId,
          reaction,
        });
      }

      const counts = this.getReactionCounts({ surface, messageId });
      this._bus.emit(CE.REACTION_REMOVED, {
        surface,
        broadcastId: options.broadcastId,
        userId,
        messageId,
        reaction,
        counts: counts.counts,
      });

      return { ok: true, messageId, reaction, counts: counts.counts };
    }

    /**
     * @param {{ surface: string, messageId: string }} options
     */
    getReactionCounts(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const mid = V()?.validateMessageId(options.messageId);
      if (mid && !mid.ok) return this._validationFail(mid);
      const messageId = mid?.value || String(options.messageId).trim();

      const bucket = this._reactions.get(messageId);
      const counts = {};
      if (bucket) {
        for (const [reaction, users] of bucket.entries()) {
          counts[reaction] = users.size;
        }
      }
      return { ok: true, messageId, counts };
    }

    /**
     * @param {{ surface: string, broadcastId: string, type: string, payload?: object, userId?: string }} options
     */
    async emitSystemEvent(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const br = V()?.validateBroadcastId(options.broadcastId);
      if (br && !br.ok) return this._validationFail(br);
      const tv = V()?.validateSystemEventType(options.type, SET);
      if (tv && !tv.ok) return this._validationFail(tv);

      const broadcastId = br?.value || String(options.broadcastId).trim();
      const type = tv?.value || String(options.type).trim().toLowerCase();
      const surface = surfaceCheck.surface;
      const now = new Date().toISOString();

      const event = {
        id: `sys-${Date.now()}-${this._systemEvents.length + 1}`,
        surface,
        broadcastId,
        type,
        payload: options.payload && typeof options.payload === "object" ? { ...options.payload } : {},
        userId: options.userId ? String(options.userId).trim() : null,
        createdAt: now,
      };

      this._systemEvents.push(event);

      if (this._provider?.emitChatSystemEvent) {
        await this._provider.emitChatSystemEvent({ surface, broadcastId, type, payload: event.payload });
      }

      this._bus.emit(CE.SYSTEM_EVENT, { ...event });
      return { ok: true, event: { ...event } };
    }

    /**
     * @param {{ surface: string, messageId: string, userId: string }} options
     */
    async deleteMessage(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const mid = V()?.validateMessageId(options.messageId);
      if (mid && !mid.ok) return this._validationFail(mid);
      const messageId = mid?.value || String(options.messageId).trim();
      const msg = this._messages.get(messageId);
      if (!msg) return { ok: false, error: "message がありません", code: EC()?.CHAT_STATE_ERROR };

      msg.state = MS.DELETED;
      msg.updatedAt = new Date().toISOString();
      this._bus.emit(CE.MESSAGE_DELETED, { ...msg });
      return { ok: true, message: { ...msg } };
    }

    /**
     * @param {{ surface: string, broadcastId: string, limit?: number }} options
     */
    getMessages(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const br = V()?.validateBroadcastId(options.broadcastId);
      if (br && !br.ok) return this._validationFail(br);
      const broadcastId = br?.value || String(options.broadcastId).trim();
      const limit = Math.min(200, Math.max(1, Math.floor(Number(options.limit) || 50)));

      const list = [];
      for (const msg of this._messages.values()) {
        if (msg.surface === surfaceCheck.surface && msg.broadcastId === broadcastId && msg.state !== MS.DELETED) {
          list.push({ ...msg });
        }
      }
      list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      return { ok: true, messages: list.slice(-limit) };
    }

    /** @param {{ surface: string, broadcastId: string, limit?: number }} options */
    getSystemEvents(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      const broadcastId = String(options.broadcastId || "").trim();
      const limit = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 50)));

      const list = this._systemEvents.filter(
        (e) => e.surface === surfaceCheck.surface && (!broadcastId || e.broadcastId === broadcastId)
      );
      return { ok: true, events: list.slice(-limit) };
    }

    async dispose() {
      this._disposed = true;
      this._messages.clear();
      this._reactions.clear();
      this._systemEvents.length = 0;
      this._bus.clear();
      this._surface = null;
      return { ok: true };
    }

    /** @private */
    _validationFail(vr) {
      const code = vr.code || EC()?.CHAT_VALIDATION_ERROR || "CHAT_VALIDATION_ERROR";
      const message = String(vr.message || "validation failed");
      this._bus.emit(CE.ERROR, { code, message, field: vr.field });
      return { ok: false, error: message, code };
    }
  }

  global.TasuLivePlatformChatGateway = TasuLivePlatformChatGateway;
})(typeof window !== "undefined" ? window : globalThis);
