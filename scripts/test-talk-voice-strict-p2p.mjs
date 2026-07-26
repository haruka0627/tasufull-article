import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");

async function waitIceComplete(page) {
  await page.waitForFunction(
    () => globalThis.__strictVoicePc?.iceGatheringState === "complete",
    null,
    { timeout: 15_000 },
  );
}

async function setup(page) {
  await page.goto(`${BASE}/talk-home.html?talkDev=1`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    const pc = new RTCPeerConnection({ iceServers: [], iceTransportPolicy: "all" });
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const destination = audio.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();
    destination.stream.getAudioTracks().forEach((track) => pc.addTrack(track, destination.stream));
    const remoteTracks = [];
    pc.ontrack = (event) => remoteTracks.push(event.track);
    globalThis.__strictVoicePc = pc;
    globalThis.__strictVoiceAudio = audio;
    globalThis.__strictVoiceOscillator = oscillator;
    globalThis.__strictVoiceRemoteTracks = remoteTracks;
  });
}

async function selectedPair(page) {
  return page.evaluate(async () => {
    const report = await globalThis.__strictVoicePc.getStats();
    const rows = [];
    report.forEach((row) => rows.push(row));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const pair = rows.find(
      (row) =>
        row.type === "candidate-pair" &&
        row.state === "succeeded" &&
        (row.selected === true || row.nominated === true),
    );
    if (!pair) return null;
    const local = byId.get(pair.localCandidateId) || {};
    const remote = byId.get(pair.remoteCandidateId) || {};
    return {
      localCandidateType: local.candidateType || "unknown",
      remoteCandidateType: remote.candidateType || "unknown",
      protocol: local.protocol || remote.protocol || "",
      currentRoundTripTime: pair.currentRoundTripTime ?? null,
      availableOutgoingBitrate: pair.availableOutgoingBitrate ?? null,
    };
  });
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
});
const contextA = await browser.newContext();
const contextB = await browser.newContext();
const pageA = await contextA.newPage();
const pageB = await contextB.newPage();

try {
  await Promise.all([setup(pageA), setup(pageB)]);
  const offer = await pageA.evaluate(async () => {
    const pc = globalThis.__strictVoicePc;
    await pc.setLocalDescription(await pc.createOffer());
    return pc.localDescription;
  });
  await waitIceComplete(pageA);
  const completeOffer = await pageA.evaluate(() => globalThis.__strictVoicePc.localDescription);
  await pageB.evaluate(async (description) => {
    const pc = globalThis.__strictVoicePc;
    await pc.setRemoteDescription(description);
    await pc.setLocalDescription(await pc.createAnswer());
  }, completeOffer || offer);
  await waitIceComplete(pageB);
  const answer = await pageB.evaluate(() => globalThis.__strictVoicePc.localDescription);
  await pageA.evaluate(
    async (description) => globalThis.__strictVoicePc.setRemoteDescription(description),
    answer,
  );
  await Promise.all([
    pageA.waitForFunction(() => globalThis.__strictVoicePc?.connectionState === "connected", null, {
      timeout: 20_000,
    }),
    pageB.waitForFunction(() => globalThis.__strictVoicePc?.connectionState === "connected", null, {
      timeout: 20_000,
    }),
  ]);
  await pageA.evaluate(async () => {
    const pc = globalThis.__strictVoicePc;
    if (typeof pc.restartIce === "function") pc.restartIce();
    await pc.setLocalDescription(await pc.createOffer({ iceRestart: true }));
  });
  await waitIceComplete(pageA);
  const restartOffer = await pageA.evaluate(() => globalThis.__strictVoicePc.localDescription);
  await pageB.evaluate(async (description) => {
    const pc = globalThis.__strictVoicePc;
    await pc.setRemoteDescription(description);
    await pc.setLocalDescription(await pc.createAnswer());
  }, restartOffer);
  await waitIceComplete(pageB);
  const restartAnswer = await pageB.evaluate(() => globalThis.__strictVoicePc.localDescription);
  await pageA.evaluate(
    async (description) => globalThis.__strictVoicePc.setRemoteDescription(description),
    restartAnswer,
  );
  await Promise.all([
    pageA.waitForFunction(() => globalThis.__strictVoicePc?.connectionState === "connected", null, {
      timeout: 20_000,
    }),
    pageB.waitForFunction(() => globalThis.__strictVoicePc?.connectionState === "connected", null, {
      timeout: 20_000,
    }),
  ]);
  const [a, b, pairA, pairB] = await Promise.all([
    pageA.evaluate(() => ({
      state: globalThis.__strictVoicePc.connectionState,
      remoteAudioTracks: globalThis.__strictVoiceRemoteTracks.filter((track) => track.kind === "audio").length,
    })),
    pageB.evaluate(() => ({
      state: globalThis.__strictVoicePc.connectionState,
      remoteAudioTracks: globalThis.__strictVoiceRemoteTracks.filter((track) => track.kind === "audio").length,
    })),
    selectedPair(pageA),
    selectedPair(pageB),
  ]);
  if (a.state !== "connected" || b.state !== "connected") throw new Error("both peers not connected");
  if (a.remoteAudioTracks < 1 || b.remoteAudioTracks < 1) {
    throw new Error(`bidirectional audio tracks missing A=${a.remoteAudioTracks} B=${b.remoteAudioTracks}`);
  }
  if (!pairA || !pairB) throw new Error("selected candidate pair unavailable");
  if (pairA.localCandidateType === "relay" || pairB.localCandidateType === "relay") {
    throw new Error("P2P fixture unexpectedly selected relay");
  }
  console.log(
    `TALK Voice strict P2P: PASS contexts=2 audio=A${a.remoteAudioTracks}/B${b.remoteAudioTracks} ` +
      `route=${pairA.localCandidateType}/${pairA.remoteCandidateType} protocol=${pairA.protocol} iceRestart=PASS`,
  );
} finally {
  await Promise.all([
    pageA.evaluate(() => globalThis.__strictVoicePc?.close()).catch(() => {}),
    pageB.evaluate(() => globalThis.__strictVoicePc?.close()).catch(() => {}),
  ]);
  await contextA.close();
  await contextB.close();
  await browser.close();
}
