(function (global) {
  "use strict";

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function classifyRoute({ localCandidateType, remoteCandidateType, protocol, relayProtocol, url } = {}) {
    const local = String(localCandidateType || "").toLowerCase();
    const remote = String(remoteCandidateType || "").toLowerCase();
    const transport = String(relayProtocol || protocol || "").toLowerCase();
    const serverUrl = String(url || "").toLowerCase();
    if (local === "relay" || remote === "relay") {
      if (serverUrl.startsWith("turns:")) return "turn_tls";
      if (transport === "tcp" || transport === "tls") {
        return transport === "tls" ? "turn_tls" : "turn_tcp";
      }
      if (transport === "udp") return "turn_udp";
      return "unknown";
    }
    if (local === "srflx" || remote === "srflx") return "p2p_srflx";
    if (local === "host" || remote === "host") return "p2p_host";
    return "unknown";
  }

  function normalizeStats(report, connectedAtMs, nowMs = Date.now()) {
    const rows = [];
    if (report?.forEach) report.forEach((value) => rows.push(value));
    else if (Array.isArray(report)) rows.push(...report);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const pair = rows.find(
      (row) =>
        row.type === "candidate-pair" &&
        (row.selected === true || row.nominated === true) &&
        row.state === "succeeded",
    );
    if (!pair) return { route: "unknown", selectedCandidatePair: false };
    const local = byId.get(pair.localCandidateId) || {};
    const remote = byId.get(pair.remoteCandidateId) || {};
    const outbound = rows.find((row) => row.type === "outbound-rtp" && row.kind === "audio" && !row.isRemote) || {};
    const inbound = rows.find((row) => row.type === "inbound-rtp" && row.kind === "audio" && !row.isRemote) || {};
    const codec = byId.get(outbound.codecId || inbound.codecId) || {};
    const route = classifyRoute({
      localCandidateType: local.candidateType,
      remoteCandidateType: remote.candidateType,
      protocol: local.protocol || remote.protocol,
      relayProtocol: local.relayProtocol || remote.relayProtocol,
      url: local.url || remote.url,
    });
    return {
      route,
      selectedCandidatePair: true,
      localCandidateType: String(local.candidateType || "unknown"),
      remoteCandidateType: String(remote.candidateType || "unknown"),
      protocol: String(local.protocol || remote.protocol || ""),
      relayProtocol: String(local.relayProtocol || remote.relayProtocol || ""),
      networkType: String(local.networkType || ""),
      currentRoundTripTime: number(pair.currentRoundTripTime),
      availableOutgoingBitrate: number(pair.availableOutgoingBitrate),
      packetsLost: number(inbound.packetsLost),
      jitter: number(inbound.jitter),
      bytesSent: number(outbound.bytesSent) ?? 0,
      bytesReceived: number(inbound.bytesReceived) ?? 0,
      codec: String(codec.mimeType || ""),
      connectTimeMs:
        Number.isFinite(Number(connectedAtMs)) && Number(connectedAtMs) > 0
          ? Math.max(0, Math.floor(nowMs - Number(connectedAtMs)))
          : null,
    };
  }

  function aggregateCost(rows, pricing = {}) {
    const sessions = Array.isArray(rows) ? rows : [];
    const totals = sessions.reduce(
      (acc, row) => {
        const seconds = Math.max(0, Number(row.durationSeconds) || 0);
        const route = String(row.route || "unknown");
        const turn = route.startsWith("turn_");
        acc.sessionCount += 1;
        acc.connectedSeconds += seconds;
        acc.p2pSeconds += turn ? 0 : seconds;
        acc.turnSeconds += turn ? seconds : 0;
        acc.turnBytes += turn
          ? Math.max(0, Number(row.bytesSent) || 0) + Math.max(0, Number(row.bytesReceived) || 0)
          : 0;
        if (row.connected) acc.connectedCount += 1;
        return acc;
      },
      {
        sessionCount: 0,
        connectedCount: 0,
        connectedSeconds: 0,
        p2pSeconds: 0,
        turnSeconds: 0,
        turnBytes: 0,
      },
    );
    const gb = totals.turnBytes / 1_000_000_000;
    const variableCost = gb * Math.max(0, Number(pricing.turnEgressCostPerGb) || 0);
    const monthlyFixed =
      Math.max(0, Number(pricing.turnServerMonthlyCost) || 0) +
      Math.max(0, Number(pricing.signalingMonthlyCost) || 0) +
      Math.max(0, Number(pricing.monitoringMonthlyCost) || 0);
    return {
      ...totals,
      turnGb: gb,
      measuredVariableCost: variableCost,
      configuredMonthlyFixedCost: monthlyFixed,
      connectionSuccessRate: totals.sessionCount ? totals.connectedCount / totals.sessionCount : 0,
      turnRate: totals.connectedSeconds ? totals.turnSeconds / totals.connectedSeconds : 0,
    };
  }

  global.TasuTalkVoiceTelemetry = {
    classifyRoute,
    normalizeStats,
    aggregateCost,
  };
})(typeof window !== "undefined" ? window : globalThis);
