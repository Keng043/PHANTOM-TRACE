# PHANTOM TRACE

**Consent-based Device Security Experiment Platform**

A consent-first research lab for studying participant responses to device permissions and security interactions. The platform uses pseudonymous sessions, granular and revocable capability consent, and explicit native permission prompts. It must never collect credentials or enable covert device access.

## Foundation stack

- Next.js App Router, TypeScript, Tailwind CSS
- PostgreSQL 18.6 + Prisma ORM 7
- PostgreSQL driver adapter, Zod validation, Vitest tests
- Role model: Admin and Researcher
- Modular monolith architecture

## Local development

Project: `D:\Projects\cs-project\phantom-trace`

Requirements: Node.js 20.9+ and npm. PostgreSQL binaries and database data are stored on D: outside the source tree.

```powershell
cd D:\Projects\cs-project\phantom-trace
npm.cmd run db:start
npm.cmd run dev
```

Open http://localhost:3000.

Stop the local database when finished:

```powershell
npm.cmd run db:stop
```

The local PostgreSQL server binds to `127.0.0.1:54329` only. Database credentials are generated locally and stored in the ignored `.env` file.

## Phase 2 — Simulation Website

- `/simulation`: explicit consent notice with clear accept and decline choices.
- `/simulation/demo`: fictional sample inbox and safe decision form. No credential fields or external links.
- `/simulation/learn`: educational review; declining participation creates no session.
- Consent creates a pseudonymous participant, hashed session token, consent record, and consent event in one database transaction.
- Session cookie is HttpOnly, SameSite=Strict, and expires after two hours.
- Suspicious-message reports are stored without free-text personal data.

## Phase 3 — Tracking Engine

- Event allow-list with strict path and metadata validation; query strings, fragments, arbitrary fields and credential-like values are rejected.
- Every browser event has a UUID idempotency key to prevent duplicate writes on retries.
- Atomic PostgreSQL session counters enforce a maximum of 60 events per minute and 1,000 events per session.
- Absolute session lifetime is two hours; expired and idle sessions are closed by the maintenance task.
- Heartbeat endpoint is throttled to one update every 25 seconds. The client sends it every 30 seconds only while the page is visible.
- Device profile stores coarse browser/OS family, device category, screen class, locale and timezone only. It does not store the raw user-agent, IP address, exact screen dimensions or fingerprint.
- Same-origin checks, HttpOnly + SameSite=Strict cookies and server-side consent/session checks protect write endpoints.
- Retention defaults: 90 days for session telemetry and reports; 365 days for audit logs. Consent records remain with their session for the same 90-day lifecycle.
- Maintenance is manual locally: `npm.cmd run db:maintenance`. Schedule this command in the hosting environment for an online lab.

## Phase 4 — Analytics & Live Monitoring

- Dashboard: `/` with live PostgreSQL metrics for campaigns, pseudonymous participants, sessions, events and reports.
- Active session monitor: sessions with recent activity within 90 seconds.
- Activity chart: hourly event volume across the previous 24 hours.
- Event stream: latest 12 records with safe metadata only.
- Behavior analytics: aggregate verify/report/continue choices and separately consented interaction signals; no individual scoring or ranking.
- Browser refreshes every 8 seconds (near-live polling, not WebSocket).
- Analytics endpoint `/api/analytics/dashboard` requires an authenticated active Admin or Researcher account.
- Phase 5 provides staff authentication, Admin/Researcher RBAC and account provisioning. Phase 11 security review is mandatory before online deployment.
- Details: `docs/analytics.md`.

## Database workflow

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npx.cmd prisma migrate deploy
npm.cmd run db:seed
npm.cmd run admin:create
npm.cmd run db:check
npm.cmd run simulation:check
npm.cmd run db:maintenance
```

The local seed administrator has a random non-login password. Create a usable Admin account with `npm.cmd run admin:create`.

For an online lab, provision a managed PostgreSQL database with TLS and set `DATABASE_URL` plus a unique `AUTH_SECRET` (at least 32 random bytes) in the hosting environment. Never commit database credentials or signing secrets.

## Quality checks

```powershell
npm.cmd test
npm.cmd run auth:check
npm.cmd run permissions:check
npm.cmd run interaction:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

## Phase 6 — Experiment & Consent Engine

- `/simulation`: versioned research notice with optional consent for Notification, Screen Sharing, Interaction Tracking, Remote Support Study, and Camera Study.
- `/simulation/experiment`: participant control panel to review and withdraw each selected capability or end the session.
- `CapabilityConsent` stores per-session capability consent, policy version, grant time, and revocation time.
- `GET /api/simulation/consent` and `POST /api/simulation/consent/revoke` expose only the active participant session's consent state.
- Overall research consent and each optional capability are separate. No optional capability is required to enter the lab.
- Research consent does not grant browser/OS permission. Phase 7 requests native Notification, Screen Sharing, and Camera permission only after a participant click.
- Screen and camera streams are previewed locally only; no media, audio, file, or personal content is uploaded or persisted. Media tracks stop when the participant stops, withdraws consent, or leaves the page.
- Remote Support consent is separate from screen sharing. Phase 9 adds a 15-minute, participant-approved, view-only WebRTC session; no remote input/control is available.
- Details: `docs/phase-6-experiment-consent.md`.

## Safety boundaries

- Consent must be presented before any telemetry is collected.
- Demo forms must not request or persist real passwords, OTPs, or payment details.
- Use pseudonymous participant IDs; keep identity mapping separate and access-controlled.
- Collect only coarse browser/device metadata needed for the training objective.
- No camera or microphone media upload/storage, GPS collection, canvas fingerprinting, full IP logging, or covert tracking. Phase 7 camera/screen previews remain local; Phase 9 screen video is shared peer-to-peer only after participant approval and browser screen selection.
- Restrict campaigns to authorized participants and approved lab domains.
- Enforce role-based access, audit sensitive actions, and define retention/deletion windows.

## Project status

- Phase 1 — Foundation: completed and verified.
- Phase 2 — Simulation Website: implemented and locally end-to-end tested.
- Phase 3 — Tracking Engine: implemented and locally verified. Lint, typecheck, 12 tests, migration status, integration checks and production build passed.
- Phase 4 — Analytics & Live Monitoring: implemented and locally verified. Database-backed dashboard, 24-hour activity, active sessions, recent event stream and aggregate behavior indicators.
- Phase 5 — Authentication & RBAC: implemented locally. Login, signed session cookie, protected dashboard/API, Admin-only account management and CLI administrator bootstrap. See `docs/phase-5-auth-rbac.md`.
- Phase 6 — Experiment & Consent Engine: implemented locally; granular opt-in, per-capability withdrawal, session control panel, and Prisma migration applied.
- Phase 7 — Device Permission Modules: implemented locally; native Notification, Screen Sharing, and Camera prompts, local-only media previews, visible stop controls, and consent-gated permission telemetry. See `docs/phase-7-device-permissions.md`.
- Phase 8 — Interaction Tracking: implemented locally; current-version consent-gated signals, coarse response-time bands, idle/return and scroll milestones, strict API allow-listing, and aggregate dashboard analytics. See `docs/phase-8-interaction-tracking.md`.
- Phase 9 — Remote Support Lab: implemented locally; researcher invitation, current-version consent check, participant approval, native screen picker, WebRTC view-only stream, 15-minute expiry, stop/withdraw handling, and short-lived signaling cleanup. No remote keyboard/mouse control. See docs/phase-9-remote-assist.md.
- Phase 10 — Experiment Analytics: implemented locally; aggregate per-capability consent and permission outcomes, Remote Assist lifecycle counts, and a new analytics panel with a 24-hour reporting window. No media or personal content is collected. See `docs/phase-10-experiment-analytics.md`.
- Phase 11 — Security Review & Deployment Readiness: implemented locally; transactional Remote Assist authorization, per-sender signaling rate limits, browser security headers, and documented residual production risks. See `docs/phase-11-security-review.md`.
- Phase 12 — Deployment Readiness Gate: implemented locally; `npm.cmd run preflight:check` validates baseline configuration and blocks production mode when HTTPS, TURN, or shared rate-limiter infrastructure is missing. No deployment performed. See `docs/phase-12-deployment-readiness.md`.
- Phase 13 — Shared Rate Limiting & TURN Relay: implemented locally; Redis REST atomic rate limits for staff login and experiment session creation, hashed identifiers, fail-closed production behavior, and short-lived coturn REST credentials returned only for active consented rooms. External Redis/TURN service verification remains pending. See `docs/phase-13-infrastructure.md`.
