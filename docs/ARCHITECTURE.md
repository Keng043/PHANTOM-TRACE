# Architecture

## Application shape

Start with a modular monolith. Keep domain boundaries explicit while avoiding distributed infrastructure before usage justifies it.

- **Web** — dashboard and participant-facing simulation routes.
- **Identity & access** — Admin / Researcher roles, secure sessions, authorization.
- **Campaigns** — campaign lifecycle and approved target cohorts.
- **Simulation** — consent notice, original demo interaction, education outcome.
- **Telemetry** — allow-listed events, validation, pseudonymous session references.
- **Analytics** — aggregate metrics and campaign comparisons.
- **Governance** — consent records, retention, audit trail.

## Data flow

1. Participant opens an approved campaign URL.
2. The simulation displays purpose, collected fields, retention, and opt-out.
3. Only after consent is granted does the server issue a pseudonymous session.
4. The client sends allow-listed events to a validated endpoint.
5. Analytics reads aggregated data; access to participant-level records is role-gated.
6. Retention jobs remove expired session/event data and record administrative actions.

## Data model

The initial schema contains User, Campaign, Participant, Session, Event, DeviceProfile, Report, AuditLog, and ConsentRecord.

## Security principles

- Deny telemetry before consent; do not infer consent from page load.
- No credential capture. A demo interaction may accept a non-secret choice or a clearly fake sample value only.
- Do not store raw IP addresses or persistent device fingerprints.
- Validate all input at API boundaries and use parameterized ORM queries.
- Apply rate limits, CSRF protections where applicable, secure cookies, and restrictive security headers.
- Enforce campaign ownership/scope and role checks on every protected API.
- Keep secrets in environment variables; require TLS for hosted database connections.
- Establish a documented retention period and deletion process before real participants are enrolled.

## Deployment target

Online lab, initially single-region. Use managed PostgreSQL with TLS, HTTPS hosting, environment-scoped secrets, database backups, and a restricted admin account. No public campaign should be activated until authentication, consent UX, rate limits, and audit coverage are tested.

## Phase 6 — granular experiment consent

Participant research consent is versioned and separated from each optional experiment capability. `CapabilityConsent` records a participant's opt-in state and withdrawal timestamp per session and capability. A research-consent record never substitutes for a browser or operating-system permission grant. Device APIs must request their native permission at point of use. Remote support requires a separately installed, visible, independently approved support session; selecting the study option does not enable remote access.

See [Phase 6 — Experiment & Consent Engine](./phase-6-experiment-consent.md) for the participant flow, API contracts, migration, and boundaries.

## Phase 7 — native device permission modules

The participant control panel offers Notification, Screen Sharing, and Camera tests only when the matching Phase 6 capability consent is active. Native permission prompts are invoked only from a direct participant action. Screen and camera streams are previewed locally in the browser, never uploaded or persisted, and are stopped when consent is withdrawn or the page is left. Permission outcomes are allow-listed and written as minimal telemetry through a same-origin, session-bound, consent-gated API. No microphone, remote-control, or background-agent capability is included.

See [Phase 7 — Device Permission Modules](./phase-7-device-permissions.md) for API behavior, browser constraints, and verification details.
