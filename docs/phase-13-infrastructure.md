# Phase 13 — Shared Rate Limiting & TURN Relay

## Shared Redis rate limiter

- Uses a Redis-compatible HTTPS REST endpoint (for example, Upstash Redis).
- All instances share the same counters through an atomic Lua fixed-window increment.
- Keys are SHA-256 hashes; raw participant IP/email identifiers are not written into Redis keys.
- Staff login: 8 attempts per normalized email per 10 minutes and 30 attempts per source address per 10 minutes.
- Public experiment session creation: 10 attempts per source address per 10 minutes.
- Redis failures fail closed with HTTP 503 in production; development may use an in-memory fallback only.
- Successful login resets the email-specific counter. The source-address counter remains active.

Required environment:
- `RATE_LIMIT_BACKEND=redis`
- `RATE_LIMIT_URL=https://<redis-rest-endpoint>`
- `RATE_LIMIT_TOKEN=<redis-rest-token>`

The deployment proxy must overwrite `X-Forwarded-For` / `X-Real-IP`; do not expose the app directly while trusting client-supplied forwarding headers. The app hashes the address and does not persist the raw address.

## TURN relay credentials

- Generates short-lived coturn REST credentials using HMAC-SHA1 and `TURN_SHARED_SECRET`.
- Credentials expire after 20 minutes and are returned only to the participant/staff endpoints for an active, consented room.
- Supports comma-separated `TURN_URL` values, including `turn:` and `turns:` transports.
- STUN remains available as a fallback. TURN is used when configured.
- No static TURN username/password is embedded in client code.

Required environment:
- `TURN_URL=turn:turn.example.org:3478?transport=udp,turns:turn.example.org:5349?transport=tcp`
- `TURN_SHARED_SECRET=<coturn-static-auth-secret-at-least-32-bytes>`

Configure coturn with the same static-auth-secret and `use-auth-secret`; set an appropriate realm and firewall/relay port range. Use TLS for `turns:` where supported. Do not commit credentials.

## Verification

```powershell
npm.cmd run preflight:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run auth:check
npm.cmd run remote-support:check
```

The unit tests verify opaque rate-limit keys, fixed-window enforcement, forwarded-address extraction, and expiring TURN credentials. Full Redis behavior and TURN traversal require configured services and a two-network browser test; they cannot be truthfully marked passed without those services.

No deployment or GitHub push is performed by this phase.
