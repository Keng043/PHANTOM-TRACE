# Phase 11 — Security Review

## Review scope

Reviewed staff authentication and authorization, participant consent lifecycle, API origin checks, tracking validation, Remote Assist signaling, analytics output, database relations, and browser security headers.

## Changes implemented

### 1. Remote Assist signaling abuse controls

- Added a rolling 60-second limit of 30 signaling messages per sender per room.
- The limit is checked and the signal is inserted inside a PostgreSQL Serializable transaction to prevent concurrent requests from bypassing the counter.
- The server re-checks room ownership/session association, active session lifetime, room status, and current Remote Support consent at the point of signal insertion.
- Rate-limited requests return HTTP 429 and Retry-After; serialization conflicts return HTTP 409 for a safe client retry.

### 2. Consent race protection

- Participant approval now re-checks current Remote Support consent, session lifetime, invitation state, and invitation expiry in a Serializable transaction.
- This prevents an approval request that races with consent withdrawal or invitation closure from reactivating an unauthorized room.

### 3. Browser security headers

- Disable the Next.js powered-by header.
- Add nosniff, frame denial, strict-origin referrer policy, and a restrictive Permissions Policy.
- Camera and display capture remain available to the same-origin experiment UI; microphone and geolocation are disabled.
- HSTS is added only in production mode, where HTTPS is expected.

## Findings and residual risks

| Finding | Status | Notes |
|---|---|---|
| Remote Assist signaling had no per-room rate limit | Fixed | 30 messages/minute per sender |
| Signal writes needed a final authorization check | Fixed | Re-check inside serializable DB transaction |
| Participant approval could race with consent withdrawal | Fixed | Transactional consent and invitation re-check |
| Login rate limit uses process-local memory | Open for production | Multi-instance deployments need a shared rate limiter at the edge or in Redis |
| Public STUN only; no TURN relay | Open | Some NAT/firewall combinations will fail; deploy a vetted TURN relay before relying on remote viewing |
| ICE candidates can expose peer network metadata to the other peer | Accepted with disclosure | Peer-to-peer WebRTC; do not promise IP anonymity |
| Session creation endpoint has no distributed abuse limit | Open for production | Apply edge-level rate limits before a public or large-scale study |
| Full CSP not enabled | Deferred | Next.js nonce-based CSP needs a dedicated deployment pass and testing with the app's script/runtime behavior |

## Explicit capability boundaries

- Remote Assist is view-only and requires the participant to click the action and select a screen using the browser-native picker.
- No remote keyboard/mouse control, command execution, file transfer, clipboard, unattended access, or OS control exists.
- No camera/microphone media streaming or server-side media recording is implemented.
- Signal payloads are limited to WebRTC offer, answer, and ICE data; no arbitrary command channel is accepted.
- Participant withdrawal, session end, room close, and expiry invalidate access and remove stored signaling messages.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run auth:check
npm.cmd run remote-support:check
```

Before a real participant study, additionally verify HTTPS, HSTS, browser permission behavior, two-browser WebRTC on the target networks, TURN configuration, backups/retention, and a shared edge rate limiter.

Phase 11 is local-only. No GitHub push or deployment is included.
