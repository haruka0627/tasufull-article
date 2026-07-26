# TASFUL TALK coturn — Staging example

This directory is a deployment example, not a deployed Production definition.

## Required Staging inputs

- DNS name with A/AAAA records for the TURN node
- Public and relay IP mapping
- `TALK_VOICE_TURN_SHARED_SECRET` (at least 32 random bytes; secret manager only)
- Public CA certificate whose SAN includes the TURN DNS name
- Private key readable only by the coturn process
- Firewall: 3478/UDP, 3478/TCP, 5349/TCP, 443/TCP, and the configured UDP/TCP relay range

The Pages Function and coturn must receive the same rotating shared secret. The
browser receives only session-bound, short-lived TURN REST credentials.

## Staging verification

1. Confirm certificate SAN, chain, expiry, TLS 1.2+, and automatic renewal.
2. Run `turnutils_stunclient` against UDP 3478.
3. Run authenticated `turnutils_uclient` over UDP and TCP.
4. Run a browser with `iceTransportPolicy=relay` separately for TURN UDP,
   TURN TCP, and TURN TLS 443.
5. Inspect `RTCPeerConnection.getStats()` and require a selected relay candidate.
6. Attempt anonymous, expired, modified-username, private-peer, loopback, and
   multicast allocations; every attempt must fail.
7. Confirm metrics and logs contain no credential, SDP, ICE candidate, or IP
   payload beyond short-lived operational data.

Do not mark TURN TLS PASS from config review or a mocked peer connection.

## Rotation and rollback

Rotate with an overlap window: configure old+new secrets on two nodes, make the
credential issuer sign with the new secret, wait longer than credential TTL,
then remove the old secret. If Staging fails, disable
`TALK_VOICE_SELF_HOSTED_TURN_ENABLED`; P2P/STUN remains the default path.

## Production design (not performed)

Use at least Tokyo primary and Osaka secondary nodes, multiple ICE URLs, health
checks, private metrics, alerting, automated certificate renewal, and a safe
shared-secret rotation mechanism. A single Staging node is a known SPOF.
