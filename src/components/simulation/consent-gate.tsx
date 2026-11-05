"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, CheckCircle2, Fingerprint, Monitor, MousePointer2, Bell, Unplug, Activity, Laptop, ShieldCheck } from "lucide-react";
import { POLICY_VERSION } from "@/lib/security/consent";

const capabilities = [
  { id: "NOTIFICATION", title: "Notifications", description: "Test browser notification permission and response.", icon: Bell },
  { id: "SCREEN_SHARING", title: "Screen sharing", description: "Share a screen you select, with a visible preview and stop control.", icon: Monitor },
  { id: "INTERACTION_TRACKING", title: "Interaction signals", description: "Record coarse button choices, scroll milestones and tab visibility. Never typed content.", icon: MousePointer2 },
  { id: "REMOTE_SUPPORT", title: "Remote assist (view-only)", description: "A separate invitation is required for a visible, participant-approved screen-viewing session. No remote control.", icon: Unplug },
  { id: "CAMERA", title: "Camera permission test", description: "Test the browser permission prompt. No image or video is uploaded or stored.", icon: Camera },
] as const;

const dataFields = [
  { id: "USAGE_EVENTS", title: "Basic usage events", description: "Page-view milestones and approved lab navigation events. No URL query strings or form contents.", icon: Activity },
  { id: "INTERACTION_SIGNALS", title: "Coarse interaction signals", description: "Button/choice categories, scroll milestones, tab visibility and coarse elapsed-time bands. No keystrokes or typed text.", icon: MousePointer2 },
  { id: "COARSE_DEVICE_PROFILE", title: "Coarse device profile", description: "Browser family, operating-system family, device class and screen-size class. No unique fingerprint.", icon: Laptop },
  { id: "PERMISSION_OUTCOMES", title: "Permission outcomes", description: "Whether a requested browser permission was allowed, denied or dismissed. No camera/screen content.", icon: ShieldCheck },
] as const;

type CapabilityId = typeof capabilities[number]["id"];
type DataFieldId = typeof dataFields[number]["id"];

export function ConsentGate() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [selected, setSelected] = useState<CapabilityId[]>([]);
  const [approvedDataFields, setApprovedDataFields] = useState<DataFieldId[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleCapability(id: CapabilityId) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function toggleDataField(id: DataFieldId) {
    setApprovedDataFields((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function startExperiment() {
    if (!accepted || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/simulation/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, policyVersion: POLICY_VERSION, capabilities: selected, approvedDataFields }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to start the experiment.");
      router.push(result.next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start the experiment.");
      setBusy(false);
    }
  }

  return <main className="sim-page"><div className="sim-shell">
    <header className="sim-brand"><span className="sim-brand-mark"><Fingerprint size={22}/></span><span>PHANTOM <b>TRACE</b><small>VOLUNTEER SECURITY RESEARCH LAB</small></span><span className="sim-lab-pill"><i/> PARTICIPANT PORTAL</span></header>
    <section className="consent-card experiment-consent-card">
      <div className="sim-eyebrow"><CheckCircle2 size={14}/> VOLUNTARY RESEARCH PARTICIPATION</div>
      <h1>Your device.<br/><span>Your permission.</span></h1>
      <p className="sim-lead">This is a volunteer study on device-security awareness. Opening this page does not authorize data collection. Review each data category and optional activity below. You may decline optional collection and still enter the lab.</p>

      <div className="experiment-notice">
        <article><strong>Always recorded for an active session</strong><p>A random participant/session reference, campaign reference, consent policy version, consent and withdrawal timestamps, session expiry, and security audit events. These operational records are required to manage your session and prove your choices. They do not include your name, passwords or personal content.</p></article>
        <article><strong>Never collected by this study</strong><p>Passwords, OTPs, recovery codes, cookies, access tokens, payment details, keystrokes, clipboard contents, private messages, personal files, browsing history, precise location, raw IP addresses or persistent device fingerprints. We do not silently capture camera or screen content.</p></article>
        <article><strong>How withdrawal works</strong><p>You can withdraw each approved data category or activity from your participant control panel, or end the entire session. Withdrawal stops future collection for that category. Browser permissions and screen sharing have separate visible controls and must be stopped independently.</p></article>
      </div>

      <div className="capability-heading"><div><strong>1. Choose data categories</strong><span>Each category is optional and separately recorded.</span></div><span>{approvedDataFields.length} / {dataFields.length}</span></div>
      <div className="capability-list">{dataFields.map(({ id, title, description, icon: Icon }) => <label className={`capability-option ${approvedDataFields.includes(id) ? "selected" : ""}`} key={id}>
        <input type="checkbox" checked={approvedDataFields.includes(id)} onChange={() => toggleDataField(id)}/>
        <span className="capability-icon"><Icon size={18}/></span>
        <span className="capability-copy"><strong>{title}</strong><small>{description}</small></span>
        <span className="capability-check"><CheckCircle2 size={17}/></span>
      </label>)}</div>

      <div className="capability-heading"><div><strong>2. Choose optional experiment activities</strong><span>These do not automatically authorize the data categories above.</span></div><span>{selected.length} / {capabilities.length}</span></div>
      <div className="capability-list">{capabilities.map(({ id, title, description, icon: Icon }) => <label className={`capability-option ${selected.includes(id) ? "selected" : ""}`} key={id}>
        <input type="checkbox" checked={selected.includes(id)} onChange={() => toggleCapability(id)}/>
        <span className="capability-icon"><Icon size={18}/></span>
        <span className="capability-copy"><strong>{title}</strong><small>{description}</small></span>
        <span className="capability-check"><CheckCircle2 size={17}/></span>
      </label>)}</div>

      <label className="consent-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/><span>I have read the notice, understand the operational session records and voluntarily agree to participate. Only the optional data categories and activities I selected may be collected.</span></label>
      {error && <p className="sim-error" role="alert">{error}</p>}
      <button className="sim-primary" disabled={!accepted || busy} onClick={startExperiment}>{busy ? "Preparing your session…" : "Save choices and enter volunteer lab"} <ArrowRight size={16}/></button>
      <a className="sim-decline" href="/simulation/learn?declined=1">I do not want to participate</a>
      <p className="sim-version">NOTICE VERSION {POLICY_VERSION} · SESSION EXPIRES AFTER 2 HOURS · WITHDRAW ANYTIME</p>
    </section>
    <footer className="sim-footer"><span>PHANTOM TRACE · CONTROLLED VOLUNTEER RESEARCH</span><span>GRANULAR CONSENT · NO SECRET COLLECTION</span></footer>
  </div></main>;
}
