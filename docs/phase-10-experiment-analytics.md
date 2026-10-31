# Phase 10 — Experiment Analytics

## Scope

Add aggregate analytics for the five optional experiment capabilities without collecting screen, camera, audio, file, or typed-content data.

## Data window

- Capability consent summaries use sessions created in the last 24 hours and the current consent policy version.
- Permission outcomes use `DEVICE_PERMISSION_RESULT` events in the last 24 hours.
- Remote Assist lifecycle counts use invitations created in the last 24 hours. Pending/active rooms past their expiry timestamp are reported as expired even if lazy cleanup has not yet updated the database row.
- Existing interaction signal counts remain limited to the last 24 hours and participants with active interaction-tracking consent at event ingestion.

## Metrics

For each capability (Notifications, Screen Sharing, Interaction Tracking, Remote Support, Camera):
- Number of participants who selected the capability in the current policy version.
- Active and withdrawn consent counts.
- Browser permission outcomes: granted, denied, unavailable, error, and stopped.

Remote Assist:
- Invitations, approved, pending, active, closed, and expired rooms.

## Privacy

- Aggregates only; no individual participant risk score or ranking.
- No raw screen/camera media, audio, personal files, passwords, OTPs, typed text, full IP, GPS, or invasive fingerprint data.
- Consent is separate from browser/OS permission outcomes.
- API remains behind staff authentication and returns no-store responses.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run auth:check
npm.cmd run remote-support:check
```

Phase 10 is local-only. Do not push or deploy unless explicitly requested.
