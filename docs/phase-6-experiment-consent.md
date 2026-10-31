# Phase 6 — Experiment & Consent Engine

## Objective

Replace the single broad participant checkbox with a versioned, granular consent workflow for the device-security experiment. Existing Admin/Researcher authentication, campaign records, pseudonymous participant sessions, and telemetry remain in place.

## Participant flow

1. The participant reviews the experiment purpose, collected data, exclusions, and withdrawal options.
2. The participant may opt into any subset of five optional capabilities: Notification, Screen Sharing, Interaction Tracking, Remote Support Study, and Camera Access Study.
3. The participant separately accepts the overall research session notice. No optional capability is required to enter the lab.
4. The server validates the current policy version, creates the existing pseudonymous session, and stores one `CapabilityConsent` record for each selected capability.
5. The participant is redirected to `/simulation/experiment`, where they can review and withdraw individual capability consent or end the session. Ending a session, automatic expiry, or idle-session closure also revokes all remaining active capability consents.

## Data model

`CapabilityConsent` is related to `Session` and records:
- `capability`: enum allow-list.
- `granted`: current research-consent state.
- `policyVersion`: notice version shown to the participant.
- `grantedAt` and `revokedAt`: consent lifecycle timestamps.
- Unique `(sessionId, capability)` constraint.

The existing `ConsentRecord` remains the overall session-consent record. The new model does not replace or rewrite historical consent rows.

## API

- `POST /api/simulation/session`: requires `{ accepted: true, policyVersion, capabilities: [...] }`; rejects stale policy versions, unknown fields, unknown capabilities, and duplicate selections.
- `GET /api/simulation/consent`: returns the active session's capability-consent records and expiry, with `Cache-Control: no-store`.
- `POST /api/simulation/consent/revoke`: revokes one selected capability for the active session. It requires same-origin and the existing HttpOnly session cookie.

All endpoints use the existing pseudonymous session token hash. The raw session secret remains in an HttpOnly, SameSite=Strict cookie.

## Explicit boundaries

- A research-consent record is not an operating-system or browser permission grant.
- Notification, screen capture, and camera APIs are not invoked in Phase 6. Their native permission prompts are separate future work in Phase 7.
- Remote Support selection records interest/consent to participate in a future separately scoped study only. It does not install an agent, create a remote connection, or enable control.
- Interaction consent does not authorize collecting typed text, passwords, OTPs, or personal content. Phase 8 signals are limited to explicitly described choice actions, scroll milestones, tab visibility, coarse idle/return events, and coarse elapsed-time buckets; older policy versions do not authorize the expanded signal set.
- No camera, microphone, screen, or remote-control content is captured by this phase.
- A participant may withdraw a selected capability or end the whole session.

## Migration

Migration `20261031101259_phase6_capability_consent` adds the `ExperimentCapability` enum and `CapabilityConsent` table. Existing data is preserved.

## Verification

Run:

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

No Git commit, push, or deployment is part of Phase 6 execution.
