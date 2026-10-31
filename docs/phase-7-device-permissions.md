# Phase 7 — Device Permission Modules

## Objective

Add explicit, participant-initiated browser permission tests for notifications, screen sharing, and camera access. Phase 6 research consent remains the prerequisite; browser/OS permission is requested separately at point of use.

## Participant experience

The `/simulation/experiment` control panel now shows three permission modules. A module is enabled only when the participant has an active Phase 6 consent record for that capability.

- **Notifications:** On an explicit click, request the browser's native Notification permission when still undecided. If granted, display one clearly labelled test notification and close it after five seconds.
- **Screen sharing:** On an explicit click, invoke `navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })`. The browser's native screen/window picker is authoritative. The selected stream is previewed locally in the participant's tab. A visible Stop button and the browser's own stop control end the stream.
- **Camera:** On an explicit click, invoke `navigator.mediaDevices.getUserMedia({ video: true, audio: false })`. Only video is requested. The preview remains local to the participant's tab and has a visible Stop button.

All active media tracks are stopped when the participant stops the test, withdraws the corresponding research consent, or leaves the page.

## Permission telemetry

`POST /api/simulation/permission-result` accepts only:
- `capability`: `NOTIFICATION`, `SCREEN_SHARING`, or `CAMERA`.
- `outcome`: `GRANTED`, `DENIED`, `UNAVAILABLE`, `ERROR`, or `STOPPED`.

The server verifies same-origin, the existing HttpOnly session cookie, active session lifetime, and an active Phase 6 consent for the exact capability. The event is written transactionally under the existing per-minute and per-session event limits. It stores only capability and outcome; no stream, frame, audio, file, or notification content is sent to the server.

## Browser constraints

- Device APIs require a secure context (HTTPS or localhost) and browser support.
- Screen and camera permission prompts must originate from a direct participant click; they cannot be silently triggered on page load.
- The participant's browser/OS can deny, dismiss, or revoke access at any time.
- Withdrawing research consent stops this application from using the capability and stops any active media stream. Persistent browser-level permission grants may remain until the participant revokes them in browser site settings.
- Notification support and behavior vary by browser and platform.

## Explicit boundaries

- This phase does not record, upload, or persist screen or camera content.
- Microphone/audio capture is never requested.
- There is no remote desktop, remote shell, input injection, background agent, or unattended access.
- Remote Support Study remains a consent/interest record only and is not activated by these modules.
- Interaction tracking beyond the permission outcome is deferred to Phase 8.

## Migration

Migration `20261031103022_phase7_device_permission_events` adds `DEVICE_PERMISSION_RESULT` to the existing `EventType` enum. Existing records are preserved.

## Verification

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Run `npm.cmd run permissions:check` to verify the permission-result API against a temporary database session, including consent enforcement, revocation, same-origin protection, and metadata minimization. Browser permission behavior should additionally be manually tested on HTTPS or localhost in the target browser. Automated build tests cannot grant real device permissions.

No GitHub push or deployment is part of this phase.
