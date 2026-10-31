# Phase 9 — Consent-Gated Remote Assist (View Only)

## Purpose

Allow a researcher to invite an active participant to a short, supervised screen-viewing session. This is not remote desktop control.

## Participant flow

1. Participant separately opts into `REMOTE_SUPPORT` in the current consent policy.
2. Researcher selects an active session that has current Remote Support consent and creates a 15-minute invitation.
3. Participant sees the invitation in the participant control panel and must accept it.
4. The browser opens its native screen picker directly from the participant's click. The participant chooses exactly which screen/window to share.
5. After the participant has selected a screen, the app confirms approval and establishes a WebRTC peer connection to the researcher viewer.
6. Ending the experiment, stopping the browser's screen share, closing the viewer, or withdrawing Remote Support consent closes the room and deletes stored signaling messages.

## Researcher capabilities

- Create an invitation only for a live session with active `REMOTE_SUPPORT` consent under the current policy version.
- View the selected screen after participant approval.
- Close the viewing session.

Researchers cannot send keyboard or mouse input, run commands, access files, control OS settings, enable camera/microphone, or start sharing without the participant's browser-level screen selection.

## Transport and data

WebRTC carries screen video peer-to-peer where network conditions permit. HTTPS API polling is used for short-lived signaling messages (offer, answer, ICE candidates). Signaling is strictly schema-validated and scoped to the participant session and the staff member who created the room. ICE candidate metadata may contain network-address information and is held only while the room is active; messages are deleted when a room is closed, consent is withdrawn, or the experiment ends. Rooms expire after 15 minutes. No screen recording or server-side video storage is implemented.

The implementation currently uses a public STUN server and does not configure a TURN relay. Some restrictive NAT/firewall networks may therefore fail to establish a peer connection. A production deployment would require a vetted TURN service, operational monitoring, stronger rate limiting, and a security/privacy review.

## Security controls

- Current-version, separately granted `REMOTE_SUPPORT` consent is checked on every participant and researcher API request.
- Researcher access is bound to the authenticated creator of the room.
- Participant approval is required before signaling is accepted.
- Browser native `getDisplayMedia()` prompt is required; no hidden capture path exists.
- Signaling payloads are allow-listed (SDP offer/answer and ICE candidate fields only).
- Session end or consent revocation closes active rooms and deletes signaling data.
- Room lifetime is limited to 15 minutes.

## Limitations

This phase provides screen viewing only. It intentionally does not provide remote input/control, unattended access, camera/microphone streaming, file transfer, clipboard access, recording, or persistence. Peer-to-peer connection success depends on network topology; TURN is not configured yet.

## Verification

Run the static and local checks:

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run simulation:check
npm.cmd run permissions:check
npm.cmd run interaction:check
npm.cmd run auth:check
npm.cmd run build
```

For the Remote Support API integration check, start the local app in a separate terminal:

```powershell
npm.cmd run dev -- --port 3001
```

Then run:

```powershell
$env:REMOTE_SUPPORT_CHECK_BASE_URL='http://localhost:3001'
npm.cmd run remote-support:check
```

The integration check exercises invitation creation, origin validation, participant approval, signaling authorization, offer/answer exchange, closure, and signaling cleanup against a running local app. It does not replace a two-browser WebRTC media test; STUN/TURN and real display capture must still be checked on the target network.

No GitHub push or deployment is part of this phase.
