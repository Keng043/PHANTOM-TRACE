# Phase 14 — Volunteer Lab Infrastructure & Data Governance

## Decision record

- Study mode: volunteer participants using their own real devices.
- Data mode: approved fields only. A campaign must declare its collection manifest before activation.
- Central system: PHANTOM TRACE application server receives consent-gated telemetry and stores it in PostgreSQL.
- Redis: shared rate-limit counters only; never a participant data store.
- Coturn: WebRTC relay only for a separately approved, visible, view-only support room.
- No public deployment, covert collection, background collection, credential capture, or remote control.

## Target architecture

```text
Volunteer device / browser
  |-- campaign notice + field-level consent
  |-- local browser permission prompts (only on direct user action)
  |-- allow-listed event API (session-bound, consent-gated)
  |-- optional visible screen-share preview
  v
HTTPS reverse proxy (overwrites forwarding headers)
  v
PHANTOM TRACE modular monolith
  |-- Identity / RBAC
  |-- Campaign + consent policy
  |-- Telemetry validation
  |-- Detection / analytics
  |-- Audit + retention
  |       |-- PostgreSQL: approved records and audit evidence
  |       |-- Redis REST: rate-limit counters only
  |       '-- Coturn: encrypted WebRTC relay packets only
  v
Staff dashboard: scoped participant records, aggregate analytics, incident timeline

Red Team simulator -> synthetic/canary payloads and controlled test events
Blue Team detector -> alerts, evidence references, detection timing
```

## Volunteer consent contract

Consent is not implied by opening a URL, accepting cookies, or granting a browser permission.

Before creating a telemetry session, the participant must be shown:
1. Study owner/contact, purpose, campaign identifier, and expected duration.
2. Exact data fields proposed for collection and why each field is needed.
3. Whether data is identifiable, pseudonymous, or aggregate.
4. Retention period, access roles, deletion process, and withdrawal method.
5. Separate opt-ins for optional capabilities (notifications, camera, screen sharing, interaction tracking, remote support).
6. Clear decline and withdrawal controls without deceptive wording.

Record the policy version, selected field manifest, consent timestamp, session reference, and withdrawal timestamp. A withdrawal must stop future collection immediately, stop active media tracks/support rooms, and queue or perform deletion according to the published policy and applicable legal obligations.

## Approved data manifest

Default allowed (only when disclosed and necessary):
- Pseudonymous participant/session ID.
- Campaign ID, consent policy version, consent/withdrawal timestamps.
- Allow-listed event type and timestamp.
- Coarse browser family, OS family, device class, screen class, locale/timezone only if individually disclosed.
- Permission outcome (granted/denied) without capturing media content.
- Red Team simulator technique ID, synthetic/canary object ID, test outcome.
- Network event metadata needed for security analysis (destination category, byte count, timestamp), only when explicitly disclosed and technically available within the controlled lab.

Requires a separate, explicit, purpose-specific opt-in:
- Screen sharing: visible browser picker, local preview, active indicator, immediate stop control; do not record or persist frames by default.
- Camera: native browser permission prompt after a direct action; local preview only; no image capture/upload by default.
- Remote support: separate approval per room; view-only, time-limited, visible; no keyboard/mouse control.

Never collect:
- Passwords, OTPs, recovery codes, payment card data, session cookies, access/refresh tokens, private messages, personal files, browser history, clipboard contents, keystrokes, or unrelated screen/camera content.
- Raw IP addresses or persistent device fingerprints in the application database.
- Any data from a non-consenting person or device outside the approved campaign.

A participant's explicit selection does not make credential secrets or unrelated sensitive content eligible for collection.

## Infrastructure configuration

Required local:
- PostgreSQL via DATABASE_URL.
- AUTH_SECRET with at least 32 random bytes.

Required before a hosted volunteer pilot:
- APP_BASE_URL with HTTPS.
- RATE_LIMIT_BACKEND=redis, RATE_LIMIT_URL (HTTPS REST endpoint), RATE_LIMIT_TOKEN.
- TURN_URL and TURN_SHARED_SECRET (at least 32 bytes), backed by a configured Coturn server.
- Reverse proxy that overwrites X-Forwarded-For and X-Real-IP.
- Database TLS, encrypted backups, restricted admin access, monitoring, and documented restore test.

Redis stores rate-limit counters only. Coturn must use shared-secret REST authentication; generated credentials are short-lived. Do not commit secrets or paste them into issue trackers/chat.

## Phase 14 execution status

Completed in this repository:
- Reviewed existing Phase 13 configuration and deployment preflight.
- Confirmed local DATABASE_URL and AUTH_SECRET are configured (values were not displayed).
- Confirmed APP_BASE_URL, TURN relay, and shared Redis are not configured in the local environment.
- Added this volunteer infrastructure/data-governance decision record and a safe environment template.

Not completed / blocked on external provisioning:
- Managed Redis REST service and token.
- Coturn host, firewall/relay range, DNS, and shared secret.
- HTTPS domain/reverse proxy.
- Hosted database TLS/backups and restore verification.
- Two-device/two-network TURN traversal test.

Therefore Phase 14 is in progress. Local preflight passing in development is not evidence of production readiness.

## Acceptance criteria

- [ ] Volunteer-facing consent notice matches the campaign's approved data manifest.
- [ ] No telemetry is accepted before consent.
- [ ] Each optional capability has independent consent and a visible stop/revoke control.
- [ ] Withdrawal prevents new events and closes active support sessions.
- [ ] Redis-backed rate limiting works across multiple app instances and fails closed in production.
- [ ] Coturn credentials expire and TURN traversal works across two independent networks.
- [ ] HTTPS and trusted proxy configuration are verified.
- [ ] Backup restore and retention/deletion procedures are tested.
- [ ] Security review approves the pilot before any public campaign.

## Next phase boundary

Phase 15 should implement the volunteer campaign data manifest and consent UX/API. Do not add stealth collection, credential capture, endpoint agents, persistence, evasion, or remote-control behavior.
