"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Fingerprint, LockKeyhole, MailWarning, ShieldCheck } from "lucide-react";
import { InteractionTracker } from "@/components/simulation/interaction-tracker";
import { POLICY_VERSION } from "@/lib/security/consent";

async function recordEvent(type: string, path: string, interactionType?: string) {
  const response = await fetch("/api/simulation/event", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientEventId: crypto.randomUUID(), type, path,
      ...(interactionType ? { metadata: { interactionType } } : {}),
    }),
  });
  if (!response.ok) throw new Error(response.status === 429
    ? "Too many actions in a short time. Please wait and try again."
    : response.status === 403
      ? "Interaction tracking consent is no longer active. Your choice was not stored."
      : "Your session has expired. Return to the consent page to begin again.");
}

function collectCoarseDeviceProfile() {
  const ua = navigator.userAgent;
  const browserFamily = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  const osFamily = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux" : "Other";
  const width = window.innerWidth;
  const deviceType = /iPad|Tablet/.test(ua) ? "Tablet"
    : /Mobile|Android|iPhone/.test(ua) ? "Mobile" : "Desktop";
  const screenClass = width < 640 ? "Small" : width < 1024 ? "Medium" : "Large";
  let locale = "en";
  let timezone = "UTC";
  try { locale = navigator.language || "en"; } catch {}
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch {}
  return { browserFamily, osFamily, deviceType, screenClass, locale, timezone };
}

export function SimulationClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [decision, setDecision] = useState("verify");

  useEffect(() => {
    let active = true;
    const send = async (url: string, body: unknown) => {
      try {
        const response = await fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body), keepalive: true,
        });
        if (response.status === 401 && active) router.replace("/simulation");
      } catch { /* Transient telemetry failures must not block the training content. */ }
    };
    void send("/api/simulation/event", {
      clientEventId: crypto.randomUUID(), type: "PAGE_VIEW", path: "/simulation/demo",
    });
    void send("/api/simulation/device-profile", collectCoarseDeviceProfile());

    const heartbeat = () => {
      if (document.visibilityState !== "visible") return;
      void send("/api/simulation/heartbeat", { visible: true });
    };
    const interval = window.setInterval(heartbeat, 30_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [router]);

  async function submitDecision() {
    if (busy || completed) return;
    setBusy(true); setMessage("");
    try {
      const consentResponse = await fetch("/api/simulation/consent", { cache: "no-store" });
      if (!consentResponse.ok) throw new Error(consentResponse.status === 401
        ? "Your session has expired. Return to the consent page to begin again."
        : "Unable to verify your interaction consent. Please try again.");
      const consent = await consentResponse.json();
      const interactionAllowed = consent?.capabilities?.some((item: { capability: string; granted: boolean; revokedAt: string | null; policyVersion: string }) =>
        item.capability === "INTERACTION_TRACKING" && item.granted && !item.revokedAt && item.policyVersion === POLICY_VERSION);
      if (interactionAllowed) {
        await recordEvent(decision === "report" ? "REPORT_SUBMITTED" : "DEMO_FORM_SUBMITTED", "/simulation/demo", decision);
      }
      setCompleted(true);
      setMessage(interactionAllowed
        ? decision === "report"
          ? "Report action recorded. Good instinct — verify the sender before interacting."
          : "Your choice has been recorded. Continue to the learning review."
        : "Your choice stays in this page and was not stored because Interaction signals was not selected.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to record this action."); }
    finally { setBusy(false); }
  }

  async function finish() {
    setBusy(true);
    try {
      await recordEvent("EDUCATION_VIEWED", "/simulation/learn");
      const response = await fetch("/api/simulation/end", { method: "POST" });
      const result = await response.json();
      router.push(result.next ?? "/simulation/learn");
    } catch { setMessage("Could not close the session. Please try again."); setBusy(false); }
  }

  return <main className="sim-page"><InteractionTracker/><div className="sim-shell sim-wide">
    <header className="sim-brand"><span className="sim-brand-mark"><Fingerprint size={22}/></span><span>PHANTOM <b>TRACE</b><small>SECURITY AWARENESS LAB</small></span><span className="sim-lab-pill"><i/> CONSENTED SESSION</span></header>
    <div className="sim-progress"><span>SIMULATION</span><i/><span>01 / 02</span></div>
    <section className="simulation-layout">
      <div className="simulation-copy">
        <div className="sim-eyebrow"><MailWarning size={14}/> TRAINING SCENARIO · INTERNAL NOTICE</div>
        <h1>A message deserves<br/><span>a second look.</span></h1>
        <p className="sim-lead">Review the sample notice on the right. Decide what you would do in a real situation. This is a fictional lab scenario, not a real service.</p>
        <div className="scenario-hint"><ShieldCheck size={18}/><p><strong>Stay curious, not rushed.</strong><br/>Urgency, unexpected requests, and unfamiliar destinations are worth checking.</p></div>
        <fieldset className="decision-fieldset" data-pt-track="decision-choice" disabled={busy || completed}>
          <legend>What would you do next?</legend>
          <label><input type="radio" name="decision" value="verify" checked={decision === "verify"} onChange={() => setDecision("verify")}/><span>Verify the request through a trusted channel</span></label>
          <label><input type="radio" name="decision" value="continue" checked={decision === "continue"} onChange={() => setDecision("continue")}/><span>Continue without checking the sender</span></label>
          <label><input type="radio" name="decision" value="report" checked={decision === "report"} onChange={() => setDecision("report")}/><span>Report the message as suspicious</span></label>
        </fieldset>
        <div className="sim-action-stack">
          <button className="sim-primary" data-pt-track="decision-submit" disabled={busy || completed} onClick={submitDecision}>{completed ? "Choice recorded" : busy ? "Recording…" : "Submit my choice"} <ArrowRight size={16}/></button>
        </div>
        {message && <p className="sim-feedback" role="status">{message}</p>}
        {completed && <button className="sim-primary sim-finish" onClick={finish}>Finish and review lessons <ArrowRight size={16}/></button>}
        <p className="sim-safe-note"><LockKeyhole size={13}/> No credential fields. No personal input is transmitted.</p>
      </div>
      <article className="sample-message">
        <div className="sample-top"><span><MailWarning size={15}/> SAMPLE INBOX</span><span>TRAINING ONLY</span></div>
        <div className="sample-sender"><div className="sender-avatar">N</div><div><strong>Notice Center</strong><span>notice@account-check.example.test</span></div><span className="sample-time">Just now</span></div>
        <div className="sample-body">
          <div className="sample-tag">ACTION REQUESTED</div><h2>Review your workspace access</h2>
          <p>Hello participant,</p><p>We noticed an unusual sign-in attempt. To keep your workspace available, please review the sample account notice.</p>
          <div className="sample-warning"><AlertTriangle size={17}/><span>Review requested within 30 minutes</span></div>
          <div className="sample-fake-button">Review access (sample link)</div>
          <p className="sample-small">This is a fictional message created for awareness training. The sample link is not connected to an external destination.</p>
        </div>
        <div className="sample-bottom"><span><LockKeyhole size={13}/> ISOLATED TRAINING CONTENT</span><span>DEMO 001</span></div>
      </article>
    </section>
    <footer className="sim-footer"><span>PHANTOM TRACE · CONTROLLED TRAINING ENVIRONMENT</span><span>SESSION EVENTS ARE PSEUDONYMOUS</span></footer>
  </div></main>;
}
