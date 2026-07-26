import assert from "node:assert/strict";
import fs from "node:fs";

const conf = fs.readFileSync(
  new URL("../config/coturn/tasful-talk-turnserver.example.conf", import.meta.url),
  "utf8",
);

for (const directive of [
  "listening-port=3478",
  "tls-listening-port=5349",
  "alt-tls-listening-port=443",
  "fingerprint",
  "lt-cred-mech",
  "use-auth-secret",
  "stale-nonce=",
  "no-loopback-peers",
  "no-multicast-peers",
  "response-origin-only-with-rfc5780",
  "min-port=",
  "max-port=",
  "cert=",
  "pkey=",
  "no-tlsv1",
  "no-tlsv1_1",
  "user-quota=",
  "total-quota=",
]) {
  assert.ok(conf.includes(directive), `missing coturn directive: ${directive}`);
}

assert.ok(
  conf.match(/denied-peer-ip=10\.0\.0\.0-10\.255\.255\.255/),
  "RFC1918 10/8 must be denied",
);
assert.ok(
  conf.match(/denied-peer-ip=192\.168\.0\.0-192\.168\.255\.255/),
  "RFC1918 192.168/16 must be denied",
);
assert.ok(
  conf.includes("denied-peer-ip=::ffff:10.0.0.0-::ffff:10.255.255.255"),
  "IPv4-mapped IPv6 private ranges must be denied",
);
assert.ok(
  conf.includes("denied-peer-ip=::ffff:169.254.0.0-::ffff:169.254.255.255"),
  "IPv4-mapped link-local must be denied",
);
assert.ok(!/^prometheus$/m.test(conf), "prometheus must stay commented/opt-in");
assert.ok(!/static-auth-secret=(?!INJECT_AT_RUNTIME_DO_NOT_COMMIT)\S+/.test(conf));
assert.ok(!/BEGIN (RSA |EC )?PRIVATE KEY/.test(conf));
assert.ok(!/\.pem[\s\S]*BEGIN CERTIFICATE/.test(conf));

console.log(
  "TALK Voice coturn config tests: PASS (protocols, auth, private peer deny, IPv6-mapped deny, quotas, no secrets)",
);
