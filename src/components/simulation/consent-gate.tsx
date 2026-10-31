"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import { POLICY_VERSION } from "@/lib/security/consent";

export function ConsentGate() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startSimulation() {
    if (!accepted || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/simulation/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, policyVersion: POLICY_VERSION }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to start the simulation.");
      router.push(result.next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start the simulation.");
      setBusy(false);
    }
  }

  return <main className="sim-page"><div className="sim-shell">
    <header className="sim-brand"><span className="sim-brand-mark"><Fingerprint size={22}/></span><span>PHANTOM <b>TRACE</b><small>SECURITY AWARENESS LAB</small></span><span className="sim-lab-pill"><i/> ONLINE LAB</span></header>
    <section className="consent-card">
      <div className="sim-eyebrow"><ShieldCheck size={14}/> BEFORE YOU BEGIN</div>
      <h1>Your awareness.<br/><span>Your choice.</span></h1>
      <p className="sim-lead">This is a controlled phishing-awareness exercise. Review what the lab records before deciding whether to participate.</p>
      <div className="consent-points">
        <article><span><CheckCircle2 size={17}/></span><div><strong>What we collect</strong><p>A random participant code, session timestamps, your chosen simulation actions, and coarse device/browser family, screen-size class, language and timezone. A short heartbeat keeps session activity status current.</p></div></article>
        <article><span><LockKeyhole size={17}/></span><div><strong>What we never collect</strong><p>Real passwords, OTPs, payment details, personal messages, full IP addresses, precise location, camera, microphone, or cross-site browsing history.</p></div></article>
        <article><span><ShieldCheck size={17}/></span><div><strong>How it is used</strong><p>To understand awareness patterns in this lab and provide immediate educational feedback. Event collection is limited and automatically rate-limited.</p></div></article>
      </div>
      <label className="consent-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/><span>I have read this notice and voluntarily agree to participate in this simulation.</span></label>
      {error && <p className="sim-error" role="alert">{error}</p>}
      <button className="sim-primary" disabled={!accepted || busy} onClick={startSimulation}>{busy ? "Preparing your session…" : "I agree — start simulation"} <ArrowRight size={16}/></button>
      <a className="sim-decline" href="/simulation/learn?declined=1">I do not want to participate</a>
      <p className="sim-version">NOTICE VERSION {POLICY_VERSION} · SESSION EXPIRES AFTER 2 HOURS · YOU CAN LEAVE AT ANY TIME</p>
    </section>
    <footer className="sim-footer"><span>PHANTOM TRACE · CONTROLLED TRAINING ENVIRONMENT</span><span>PRIVACY BY DESIGN</span></footer>
  </div></main>;
}
