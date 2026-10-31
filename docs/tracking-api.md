# Tracking API — Phase 3

All write endpoints require:
- HTTPS in hosted environments.
- Same-origin `Origin` header matching the request host.
- A valid HttpOnly `phantom_trace_session` cookie.
- A session with accepted consent, no end timestamp, and an unexpired `expiresAt`.

Responses containing session state use `Cache-Control: no-store`.

## POST /api/simulation/session

Starts a pseudonymous session only after the current consent policy is accepted.

Request:

```json
{ "accepted": true, "policyVersion": "2026-10-31-v2" }
```

Creates participant, session, consent record, and consent event in a transaction. The raw random session secret is returned only as an HttpOnly cookie; only its SHA-256 hash is stored.

Absolute session lifetime: 2 hours.

## POST /api/simulation/event

Allow-listed event types:
- `PAGE_VIEW`
- `DEMO_FORM_SUBMITTED`
- `LINK_CLICKED`
- `REPORT_SUBMITTED`
- `EDUCATION_VIEWED`

Request fields:
- `clientEventId`: optional UUID idempotency key.
- `type`: allow-listed event.
- `path`: local path only; no query string or fragment.
- `metadata`: optional `interactionType` only.

Limits:
- 60 accepted events per session per fixed 60-second session window.
- 1,000 accepted events per session lifetime.
- Duplicate UUIDs are idempotent and do not increment counters.
- `REPORT_SUBMITTED` creates a report and event in the same transaction.

Status codes:
- 200 accepted or duplicate.
- 400 invalid payload.
- 401 missing, ended, or expired session.
- 403 invalid/missing origin.
- 429 event quota exceeded; retry after 60 seconds.

## POST /api/simulation/device-profile

Accepts a single coarse profile per session:
- Browser family, OS family, device category.
- Screen-size class (not exact dimensions).
- Browser language and timezone.

Raw user-agent, IP address, precise location, canvas/audio fingerprint, and hardware identifiers are not accepted. A profile is immutable after first creation.

## POST /api/simulation/heartbeat

Updates session activity at most once every 25 seconds. Client sends every 30 seconds while the page is visible. The request contains only a visibility boolean.

A heartbeat does not extend the absolute two-hour expiry.

## POST /api/simulation/end

Writes a session-ended event, stamps `endedAt`, and clears the session cookie. Subsequent event/profile/heartbeat requests are rejected.

## Maintenance

Run `npm.cmd run db:maintenance` on a daily schedule in a trusted worker:
- Mark absolute-expiry sessions as ended and revoke remaining active capability consents.
- Close sessions idle for more than 90 seconds and revoke remaining active capability consents.
- Delete session/event/report telemetry after 90 days.
- Delete audit logs after 365 days.
- Remove participants with no remaining sessions.

The script is safe to run repeatedly. It is not automatically scheduled by the local development server.

