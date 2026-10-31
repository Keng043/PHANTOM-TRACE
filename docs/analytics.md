# Phase 4 — Analytics & Live Monitoring

## Scope

The local dashboard at `/` is backed by PostgreSQL data. The analytics endpoint is `GET /api/analytics/dashboard`.

The endpoint intentionally returns 404 outside `NODE_ENV=development`. It is an internal preview, not an authenticated production API. Phase 5 must add Admin/Researcher authentication and authorization before online access is enabled.

## Dashboard data

- Campaign count: all campaign records.
- Unique participants: distinct pseudonymous participant IDs referenced by sessions.
- Sessions: all created sessions.
- Active sessions: sessions not ended or expired, with activity in the last 90 seconds.
- Events and reports: total stored records.
- Session completion: ended sessions divided by all created sessions. This is a session lifecycle metric, not a participant success score.
- Activity: event counts grouped into the previous 24 hourly buckets.
- Behavior signals: aggregate verify/report/continue interaction choices from the previous 24 hours. The sample size is displayed. They are training indicators only, not individual risk scores or staff rankings.
- Event stream: latest 12 events with campaign, event type, safe path and allowed interaction choice. No participant identity or session token is returned.

## Refresh behavior

The browser polls every 8 seconds using `cache: no-store`. This is near-live polling, not WebSocket push. Active-session status uses the existing heartbeat/activity timestamps and a 90-second threshold.

## Privacy and deployment boundary

- No raw IP, raw user-agent, participant pseudonym, session secret, or free-text report content is exposed by this dashboard response.
- Session IDs are shortened for display.
- Dashboard and endpoint must remain local-only until Phase 5 RBAC and Phase 6 security review are complete.
- Do not deploy this preview endpoint to a public environment. Production requests receive 404 while `NODE_ENV` is not development.