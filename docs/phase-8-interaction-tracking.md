# Phase 8 — Consent-Gated Interaction Tracking

## Objective

Measure participant interaction patterns in the fictional simulation without collecting typed content, credentials, personal text, or detailed browsing history.

## Participant consent

Interaction signals require a separate `INTERACTION_TRACKING` capability consent under policy version `2026-10-31-v4`. Earlier consent versions are not sufficient for this expanded signal set. The participant can withdraw consent at any time; the server rejects further signals immediately after revocation.

## Signals recorded

- `DECISION_CHANGE`: a choice control changed; the selected value is not sent in this signal.
- `DECISION_SUBMIT`: the participant activated the decision-submit control.
- `LINK_CLICK`: reserved for explicitly marked in-lab links; arbitrary page clicks are not collected.
- `SCROLL_25`, `SCROLL_50`, `SCROLL_75`, `SCROLL_100`: one event per scroll-depth milestone.
- `TAB_HIDDEN`, `TAB_VISIBLE`: document visibility changes.
- `IDLE_30S`, `RETURNED`: coarse inactivity and return indicators.
- `elapsedBucket`: coarse time band from page start (`LT_1S`, `1_3S`, `3_10S`, `10_30S`, `30_60S`, `GT_60S`). No exact timestamps from the browser clock are sent.

The tracker does not read input values, labels, text nodes, keystrokes, pointer coordinates, element IDs, URLs, query strings, clipboard contents, or form contents. It attaches only to explicit `data-pt-track` markers for the simulation decision controls. Scroll tracking stores milestone events only, not continuous scroll positions.

## API and storage

`POST /api/simulation/interaction` accepts a strict allow-list payload containing a UUID event ID, one signal enum, and one coarse elapsed-time bucket. The server checks same-origin, the HttpOnly session cookie, active session lifetime, and a current-version active `INTERACTION_TRACKING` consent. Events are written transactionally under the existing per-minute and per-session quotas, with idempotency protection.

Events use `INTERACTION_SIGNAL` and fixed path `/simulation/demo`. Metadata contains only `signal` and `elapsedBucket`. Existing decision submission telemetry (`DEMO_FORM_SUBMITTED`, `REPORT_SUBMITTED`, and `LINK_CLICKED`) is also gated by the current interaction consent. Without that consent, the participant can complete the training flow but the decision remains local and is not stored.

## Migration

Migration `20261031105055_phase8_interaction_signals` adds `INTERACTION_SIGNAL` to the existing event enum. Existing records are preserved.

## Analytics

The authenticated dashboard reports aggregate signal counts for the last 24 hours. It does not expose individual interaction timelines, typed content, or per-participant risk scores.

## Verification

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run interaction:check
npm.cmd run permissions:check
npm.cmd run build
```

`npm.cmd run interaction:check` exercises current-version consent, stale-consent rejection, revoked-consent rejection, same-origin checks, payload allow-listing, idempotency, and metadata minimization against a temporary database session.

No GitHub push or deployment is part of this phase.
