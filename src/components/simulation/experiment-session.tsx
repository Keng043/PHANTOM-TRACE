"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleOff, Fingerprint, ShieldCheck } from "lucide-react";
import { DevicePermissionLab } from "@/components/simulation/device-permission-lab";
import { RemoteAssistParticipant } from "@/components/simulation/remote-assist-participant";
import { POLICY_VERSION } from "@/lib/security/consent";

type Capability = { capability: string; granted: boolean; grantedAt: string | null; revokedAt: string | null; policyVersion: string };
const labels: Record<string, string> = {
  NOTIFICATION: "Notifications", SCREEN_SHARING: "Screen sharing", INTERACTION_TRACKING: "Interaction signals",
  REMOTE_SUPPORT: "Remote support study", CAMERA: "Camera access study",
};

export function ExperimentSession() {
  const router = useRouter();
  const [items, setItems] = useState<Capability[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/simulation/consent", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { router.replace("/simulation"); return null; }
      if (!response.ok) throw new Error("Could not load consent records.");
      return response.json();
    }).then((data) => { if (active && data) { setItems(data.capabilities); setExpiresAt(data.expiresAt); } })
      .catch(() => { if (active) setMessage("Could not load your consent records. Refresh the page to try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  async function revoke(capability: string) {
    if (busy) return;
    setBusy(capability); setMessage("");
    try {
      const response = await fetch("/api/simulation/consent/revoke", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ capability }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to revoke consent.");
      setItems((current) => current.map((item) => item.capability === capability
        ? { ...item, granted: false, revokedAt: new Date().toISOString() } : item));
      setMessage(`${labels[capability] ?? capability} consent has been withdrawn.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to revoke consent."); }
    finally { setBusy(""); }
  }

  async function endSession() {
    setBusy("END");
    try {
      await fetch("/api/simulation/end", { method: "POST" });
      router.replace("/simulation/learn");
    } catch { setMessage("Unable to end the session. Please try again."); setBusy(""); }
  }

  return <main className="sim-page"><div className="sim-shell">
    <header className="sim-brand"><span className="sim-brand-mark"><Fingerprint size={22}/></span><span>PHANTOM <b>TRACE</b><small>DEVICE SECURITY EXPERIMENT LAB</small></span><span className="sim-lab-pill"><i/> ACTIVE SESSION</span></header>
    <section className="consent-card experiment-session-card">
      <div className="sim-eyebrow"><ShieldCheck size={14}/> YOUR PARTICIPANT CONTROL PANEL</div>
      <h1>Consent stays<br/><span>in your hands.</span></h1>
      <p className="sim-lead">This page shows the activities you agreed to. You can withdraw an individual choice at any time or end the experiment entirely.</p>
      <div className="experiment-notice"><article><strong>Separate device permissions</strong><p>Your research consent does not itself grant browser or operating-system access. Any future notification, screen, or camera test must show its own permission prompt and respect the result.</p></article><article><strong>Remote assist is view-only</strong><p>If you opted in, a researcher may invite you to share one selected screen. You must accept and use the browser screen picker. They cannot control your mouse, keyboard, files, camera, or operating system.</p></article></div>
      {!loading && <DevicePermissionLab key={items.filter((item) => item.granted && !item.revokedAt && item.policyVersion === POLICY_VERSION).map((item) => item.capability).join("|")} authorized={items.filter((item) => item.granted && !item.revokedAt && item.policyVersion === POLICY_VERSION).map((item) => item.capability)} />}
      {!loading && <RemoteAssistParticipant authorized={items.some((item) => item.capability === "REMOTE_SUPPORT" && item.granted && !item.revokedAt && item.policyVersion === POLICY_VERSION)} />}
      <div className="capability-heading"><div><strong>Your consent records</strong><span>Only selected activities are listed.</span></div><span>{items.filter((item) => item.granted && !item.revokedAt).length} active</span></div>
      {loading ? <p className="sim-lead">Loading your consent records…</p> : items.length ? <div className="capability-list">{items.map((item) => <article className="capability-option" key={item.capability}>
        <span className="capability-icon">{item.granted && !item.revokedAt ? <CheckCircle2 size={18}/> : <CircleOff size={18}/>}</span>
        <span className="capability-copy"><strong>{labels[item.capability] ?? item.capability}</strong><small>{item.granted && !item.revokedAt ? "Consent active" : "Consent withdrawn"}</small></span>
        {item.granted && !item.revokedAt && <button className="sim-revoke" disabled={!!busy} onClick={() => void revoke(item.capability)}>{busy === item.capability ? "Withdrawing…" : "Withdraw"}</button>}
      </article>)}</div> : <div className="experiment-empty">You did not opt in to any optional device activity. Your research session is still valid.</div>}
      {message && <p className="sim-feedback" role="status">{message}</p>}
      <p className="sim-version">SESSION EXPIRES {expiresAt ? new Date(expiresAt).toLocaleString() : "AFTER 2 HOURS"}</p>
      <button className="sim-primary experiment-end" disabled={!!busy} onClick={() => void endSession()}>{busy === "END" ? "Ending session…" : "End experiment and withdraw"} <ArrowRight size={16}/></button>
    </section>
    <footer className="sim-footer"><span>PHANTOM TRACE · PARTICIPANT CONTROL PANEL</span><span>YOU MAY LEAVE AT ANY TIME</span></footer>
  </div></main>;
}
