# Phase 15 — Volunteer Consent & Approved Data Manifest

## Objective

Replace broad implied telemetry consent with a versioned, per-category data approval manifest for volunteer participants. Activity consent and data collection approval are independent: selecting a browser/device activity does not automatically authorize storing its outcome or telemetry.

## Participant flow

1. Volunteer opens the campaign notice. No participant telemetry is accepted before consent.
2. The notice explains operational session records separately from optional research data categories.
3. Volunteer selects zero or more data categories and zero or more optional activities.
4. The volunteer explicitly accepts the overall study notice.
5. Server validates the current policy version and creates pseudonymous session, capability consent rows, and data-field consent rows atomically.
6. Participant control panel lists both sets of approvals and allows independent withdrawal.
7. Withdrawal blocks future writes for that data category. Ending the session blocks all session-bound collection.

## Data categories

| Field | Collected data | Gate |
|---|---|---|
| USAGE_EVENTS | Allow-listed page/navigation milestones | Data-field consent |
| INTERACTION_SIGNALS | Coarse choice, scroll, visibility and elapsed-time signals | Data-field consent + INTERACTION_TRACKING capability |
| COARSE_DEVICE_PROFILE | Browser/OS family, device type and coarse screen class, locale/timezone as described | Data-field consent |
| PERMISSION_OUTCOMES | Allow/deny/unavailable/error/stop outcome only | Data-field consent + relevant activity capability |

Operational records always retained for an active session: pseudonymous session/participant reference, campaign reference, policy version, consent/withdrawal timestamps, expiry and security/audit records. These are described as required session operations, not optional telemetry.

Never collect passwords, OTPs, recovery codes, cookies, access tokens, payment data, keystrokes, clipboard, private messages, personal files, browsing history, precise location, raw IP, persistent fingerprint, or unrelated screen/camera content.

## API behavior

- POST /api/simulation/session now requires approvedDataFields and records selected fields in DataFieldConsent.
- GET /api/simulation/consent returns capability and data-field consent separately.
- POST /api/simulation/consent/data-revoke withdraws one data category.
- POST /api/simulation/consent/revoke continues to withdraw one activity.
- /api/simulation/event requires USAGE_EVENTS; interaction-related event types additionally require INTERACTION_TRACKING.
- /api/simulation/interaction requires both INTERACTION_SIGNALS and INTERACTION_TRACKING.
- /api/simulation/device-profile requires COARSE_DEVICE_PROFILE.
- /api/simulation/permission-result requires PERMISSION_OUTCOMES and the matching activity capability.

All checks are server-side, session-bound, policy-version-bound, and reject revoked or missing consent. Old sessions without data-field consent rows cannot write the newly gated data categories.

## Database

Migration: 20261105190000_approved_data_manifest

Adds ApprovedDataField enum and DataFieldConsent table with unique (sessionId, dataField), policy version, grant and withdrawal timestamps. Existing records are preserved.

## Verification

- Prisma schema validation and client generation.
- TypeScript typecheck.
- Consent schema tests for empty/partial selection, invalid fields, duplicate fields, and revocation validation.
- API authorization checks reviewed for each gated data route.

No credential collection, covert telemetry, background agent, remote control, or unapproved content capture is included.

## Limitations / next checks

- Browser-level volunteer UX and real database migration must be tested locally before pilot.
- End-to-end tests must verify each data field is rejected when not selected and immediately rejected after withdrawal.
- Retention/deletion policy and volunteer contact/withdrawal process must be finalized before enrollment.
- No public deployment, Git commit, or GitHub push is part of this phase.
