# Phase 12 — Deployment Readiness Gate

## Purpose

Provide a repeatable local preflight command that prevents a production deployment when required security and transport infrastructure is missing. This phase does not deploy the application or make the project public.

## Command

```powershell
npm.cmd run preflight:check
```

In development mode, the command validates local database configuration and authentication secret strength, and reports production-only requirements as warnings.

In production mode, it blocks when any of these are missing:
- `DATABASE_URL`
- `AUTH_SECRET` with at least 32 bytes
- `APP_BASE_URL` using HTTPS
- `TURN_URL` and `TURN_SHARED_SECRET` (coturn REST authentication)
- `RATE_LIMIT_BACKEND=redis`, `RATE_LIMIT_URL`, and `RATE_LIMIT_TOKEN` (Redis REST API)

The preflight does not print secret values.

## Production blockers

Phase 13 implements the shared Redis REST rate limiter for login and public session creation, plus coturn REST credentials with a 20-minute lifetime. Production still requires actual Redis and coturn services, correct proxy address forwarding, HTTPS, and two-network browser verification before deployment.

## Deployment policy

- No deployment from this phase.
- No public campaign or participant invitation.
- Require HTTPS and a reviewed consent notice before enrolling participants.
- Run database migration status, authentication checks, Remote Support API checks, and two-browser WebRTC tests on the target environment.
- Confirm retention, backup, incident response, and participant withdrawal procedures.

## Verification

```powershell
npm.cmd run preflight:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```
