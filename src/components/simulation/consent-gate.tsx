"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, CheckCircle2, Fingerprint, Monitor, MousePointer2, Bell, Unplug } from "lucide-react";
import { POLICY_VERSION } from "@/lib/security/consent";

const capabilities = [
  { id: "NOTIFICATION", title: "Notifications", description: "Test whether browser notifications can be displayed and how participants respond.", icon: Bell },
  { id: "SCREEN_SHARING", title: "Screen sharing", description: "Voluntarily share a selected screen or window during a supervised test.", icon: Monitor },
  { id: "INTERACTION_TRACKING", title: "Interaction signals", description: "Record experiment button choices and response timing, not typed content.", icon: MousePointer2 },
  { id: "REMOTE_SUPPORT", title: "Remote support study", description: "Register interest in a separately installed, visible support session. This consent does not enable remote control.", icon: Unplug },
  { id: "CAMERA", title: "Camera access study", description: "Test a camera permission request. No photo or video is recorded in this phase.", icon: Camera },
] as const;

type CapabilityId = typeof capabilities[number]["id"];

export function ConsentGate() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [selected, setSelected] = useState<CapabilityId[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: CapabilityId) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function startExperiment() {
    if (!accepted || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/simulation/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, policyVersion: POLICY_VERSION, capabilities: selected }),
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
    <header className="sim-brand"><span className="sim-brand-mark"><Fingerprint size={22}/></span><span>PHANTOM <b>TRACE</b><small>DEVICE SECURITY EXPERIMENT LAB</small></span><span className="sim-lab-pill"><i/> PARTICIPANT PORTAL</span></header>
    <section className="consent-card experiment-consent-card">
      <div className="sim-eyebrow"><CheckCircle2 size={14}/> VOLUNTARY RESEARCH PARTICIPATION</div>
      <h1>Your device.<br/><span>Your permission.</span></h1>
      <p className="sim-lead">PHANTOM TRACE studies how people respond to device permission requests and interactive security prompts. You choose which activities to join. You may decline any capability and still enter the lab.</p>

      <div className="experiment-notice">
        <article><strong>What the lab records</strong><p>A random participant code, session timestamps, selected consent choices, permission outcomes, and limited interaction events such as a button choice and response time.</p></article>
        <article><strong>What the lab does not collect</strong><p>Passwords, OTPs, typed text, personal files, full IP addresses, precise location, or hidden device fingerprints. Camera and screen content are not recorded by this consent workflow.</p></article>
        <article><strong>Important distinction</strong><p>Choosing an activity below records your research consent only. Browser or operating-system permissions are requested separately at the time of use. Remote support is not enabled by this page and requires a separate, visible, user-approved session.</p></article>
      </div>

      <div className="capability-heading"><div><strong>Choose experiment activities</strong><span>Every item is optional. You can change your mind.</span></div><span>{selected.length} / {capabilities.length}</span></div>
      <div className="capability-list">{capabilities.map(({ id, title, description, icon: Icon }) => <label className={`capability-option ${selected.includes(id) ? "selected" : ""}`} key={id}>
        <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)}/>
        <span className="capability-icon"><Icon size={18}/></span>
        <span className="capability-copy"><strong>{title}</strong><small>{description}</small></span>
        <span className="capability-check"><CheckCircle2 size={17}/></span>
      </label>)}</div>

      <label className="consent-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/><span>I have read the experiment notice and voluntarily agree to create a pseudonymous research session. I understand that each device permission will be requested separately.</span></label>
      {error && <p className="sim-error" role="alert">{error}</p>}
      <button className="sim-primary" disabled={!accepted || busy} onClick={startExperiment}>{busy ? "Preparing your session…" : "Agree and enter experiment lab"} <ArrowRight size={16}/></button>
      <a className="sim-decline" href="/simulation/learn?declined=1">I do not want to participate</a>
      <p className="sim-version">NOTICE VERSION {POLICY_VERSION} · SESSION EXPIRES AFTER 2 HOURS · WITHDRAW ANYTIME</p>
    </section>
    <footer className="sim-footer"><span>PHANTOM TRACE · CONTROLLED DEVICE SECURITY RESEARCH</span><span>CONSENT IS GRANULAR AND REVOCABLE</span></footer>
  </div></main>;
}
