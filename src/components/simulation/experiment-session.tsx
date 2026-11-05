"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleOff, Fingerprint, ShieldCheck } from "lucide-react";
import { DevicePermissionLab } from "@/components/simulation/device-permission-lab";
import { RemoteAssistParticipant } from "@/components/simulation/remote-assist-participant";
import { POLICY_VERSION } from "@/lib/security/consent";

type Capability = { capability: string; granted: boolean; grantedAt: string | null; revokedAt: string | null; policyVersion: string };
type DataField = { dataField: string; granted: boolean; grantedAt: string | null; revokedAt: string | null; policyVersion: string };
const labels: Record<string, string> = {
  NOTIFICATION: "Notifications", SCREEN_SHARING: "Screen sharing", INTERACTION_TRACKING: "Interaction signals",
  REMOTE_SUPPORT: "Remote support study", CAMERA: "Camera permission test",
};
const dataLabels: Record<string, string> = {
  USAGE_EVENTS: "Basic usage events",
  INTERACTION_SIGNALS: "Coarse interaction signals",
  COARSE_DEVICE_PROFILE: "Coarse device profile",
  PERMISSION_OUTCOMES: "Permission outcomes",
};

export function ExperimentSession() {
  const router = useRouter();
  const [items, setItems] = useState<Capability[]>([]);
  const [dataFields, setDataFields] = useState<DataField[]>([]);
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
    }).then((data) => {
      if (active && data) {
        setItems(data.capabilities);
        setDataFields(data.dataFields ?? []);
        setExpiresAt(data.expiresAt);
      }
    }).catch(() => { if (active) setMessage("Could not load your consent records. Refresh the page to try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  async function revokeCapability(capability: string) {
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
      setMessage(`${labels[capability] ?? capability} activity consent has been withdrawn.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to revoke consent."); }
    finally { setBusy(""); }
  }

  async function revokeDataField(dataField: string) {
    if (busy) return;
    setBusy(dataField); setMessage("");
    try {
      const response = await fetch("/api/simulation/consent/data-revoke", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataField }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to withdraw data consent.");
      setDataFields((current) => current.map((item) => item.dataField === dataField
        ? { ...item, granted: false, revokedAt: new Date().toISOString() } : item));
      setMessage(`${dataLabels[dataField] ?? dataField} collection has been withdrawn. Future collection for this category is blocked.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to withdraw data consent."); }
    finally { setBusy(""); }
  }

  async function endSession() {
    setBusy("END");
    try {
      const response = await fetch("/api/simulation/end", { method: "POST" });
      if (!response.ok) throw new Error("Unable to end the session.");
      router.replace("/simulation/learn");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to end the session."); setBusy(""); }
  }

  const activeCapabilities = items.filter((item) => item.granted && !item.revokedAt && item.policyVersion === POLICY_VERSION);
  const activeDataFields = dataFields.filter((item) => item.granted && !item.revokedAt && item.policyVersion === POLICY_VERSION);

  return <main className="sim-page"><div className="sim-shell">
    <header className="sim-brand"><span className="sim-brand-mark"><Fingerprint size={22}/></span><span>PHANTOM <b>TRACE</b><small>VOLUNTEER SECURITY RESEARCH LAB</small></span><span className="sim-lab-pill"><i/> ACTIVE SESSION</span></header>
    <section className="consent-card experiment-session-card">
      <div className="sim-eyebrow"><ShieldCheck size={14}/> YOUR PARTICIPANT CONTROL PANEL</div>
      <h1>Consent stays<br/><span>in your hands.</span></h1>
      <p className="sim-lead">Review the exact data categories and activities you approved. Withdraw any optional category at any time or end the entire experiment.</p>
      <div className="experiment-notice">
        <article><strong>Operational session records</strong><p>A pseudonymous session reference, consent version, consent/withdrawal timestamps and session-security records are retained to operate and audit the session. These are not optional telemetry categories.</p></article>
        <article><strong>Separate device permissions</strong><p>Research consent does not grant browser or operating-system permission. Native permission prompts are shown only after your direct action.</p></article>
        <article><strong>Remote assist is view-only</strong><p>A researcher invitation requires separate approval and the browser screen picker. There is no mouse, keyboard, file, camera or operating-system control.</p></article>
      </div>
      {!loading && <DevicePermissionLab key={activeCapabilities.map((item) => item.capability).join("|") + ":" + activeDataFields.map((item) => item.dataField).join("|")} authorized={activeCapabilities.map((item) => item.capability)} recordOutcomes={activeDataFields.some((item) => item.dataField === "PERMISSION_OUTCOMES")} />}
      {!loading && <RemoteAssistParticipant authorized={activeCapabilities.some((item) => item.capability === "REMOTE_SUPPORT")} />}

      <div className="capability-heading"><div><strong>Your approved data categories</strong><span>Withdraw any category to block future collection.</span></div><span>{activeDataFields.length} active</span></div>
      {loading ? <p className="sim-lead">Loading your consent records…</p> : dataFields.length ? <div className="capability-list">{dataFields.map((item) => <article className="capability-option" key={item.dataField}>
        <span className="capability-icon">{item.granted && !item.revokedAt ? <CheckCircle2 size={18}/> : <CircleOff size={18}/>}</span>
        <span className="capability-copy"><strong>{dataLabels[item.dataField] ?? item.dataField}</strong><small>{item.granted && !item.revokedAt ? "Collection approved" : "Collection withdrawn"}</small></span>
        {item.granted && !item.revokedAt && <button className="sim-revoke" disabled={!!busy} onClick={() => void revokeDataField(item.dataField)}>{busy === item.dataField ? "Withdrawing…" : "Withdraw"}</button>}
      </article>)}</div> : <div className="experiment-empty">You did not approve optional data collection. Only operational session records are retained.</div>}

      <div className="capability-heading"><div><strong>Your experiment activities</strong><span>Activities have separate consent from data categories.</span></div><span>{activeCapabilities.length} active</span></div>
      {items.length ? <div className="capability-list">{items.map((item) => <article className="capability-option" key={item.capability}>
        <span className="capability-icon">{item.granted && !item.revokedAt ? <CheckCircle2 size={18}/> : <CircleOff size={18}/>}</span>
        <span className="capability-copy"><strong>{labels[item.capability] ?? item.capability}</strong><small>{item.granted && !item.revokedAt ? "Activity consent active" : "Activity consent withdrawn"}</small></span>
        {item.granted && !item.revokedAt && <button className="sim-revoke" disabled={!!busy} onClick={() => void revokeCapability(item.capability)}>{busy === item.capability ? "Withdrawing…" : "Withdraw"}</button>}
      </article>)}</div> : <div className="experiment-empty">No optional experiment activities were selected.</div>}

      {message && <p className="sim-feedback" role="status">{message}</p>}
      <p className="sim-version">SESSION EXPIRES {expiresAt ? new Date(expiresAt).toLocaleString() : "AFTER 2 HOURS"}</p>
      <button className="sim-primary experiment-end" disabled={!!busy} onClick={() => void endSession()}>{busy === "END" ? "Ending session…" : "End experiment and withdraw"} <ArrowRight size={16}/></button>
    </section>
    <footer className="sim-footer"><span>PHANTOM TRACE · PARTICIPANT CONTROL PANEL</span><span>YOU MAY LEAVE AT ANY TIME</span></footer>
  </div></main>;
}
