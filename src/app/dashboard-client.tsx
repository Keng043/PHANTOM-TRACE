"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, Bell, ChevronDown, CircleHelp, ClipboardList, Fingerprint,
  Globe2, LayoutDashboard, MousePointer2, Plus, Radio, Search, ShieldAlert,
  ShieldCheck, SlidersHorizontal, Users, Wifi, Zap,
} from "lucide-react";

type Data = {
  generatedAt: string;
  metrics: { campaigns: number; participants: number; sessions: number; activeSessions: number; events: number; reports: number; endedSessions: number; completionRate: number };
  activity: { hour: string; count: number }[];
  behavior: { verify: number; report: number; continue: number };
  behaviorSampleSize: number;
  activeSessions: { id: string; campaign: string; startedAt: string; lastSeenAt: string; eventCount: number }[];
  recentEvents: { id: string; type: string; path: string | null; choice: string | null; campaign: string; createdAt: string }[];
};

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
const stamp = (s: string) => new Date(s).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const clock = (s: string) => new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Metric({ label, value, note, icon: Icon, tone }: { label: string; value: string; note: string; icon: typeof Activity; tone: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17}/></span></div><div className="metric-value">{value}</div><div className="metric-foot"><span>{note}</span></div></article>;
}

export default function DashboardClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/analytics/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const result = await response.json() as Data;
      setData(result); setUpdated(result.generatedAt); setError("");
    } catch {
      setError("Cannot load analytics. Check the local database and development server.");
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh]);

  const maxActivity = useMemo(() => Math.max(1, ...(data?.activity.map((v) => v.count) ?? [])), [data]);
  const behavior = data ? [
    { id: "verify", label: "Verify first", count: data.behavior.verify, color: "var(--cyan)" },
    { id: "report", label: "Report suspicious", count: data.behavior.report, color: "#d6ad75" },
    { id: "continue", label: "Continue anyway", count: data.behavior.continue, color: "#e28b8b" },
  ] : [];

  return <main className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark"><Fingerprint size={21}/></span><span>PHANTOM<span className="brand-light">TRACE</span><small>SIMULATION INTELLIGENCE</small></span></Link>
      <div className="workspace-switch"><div className="workspace-avatar">T</div><div><strong>Team workspace</strong><small>Local preview</small></div><ChevronDown size={15}/></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="nav-list">
        <Link href="/" className="nav-link active"><LayoutDashboard size={17}/><span>Overview</span></Link>
        <a href="/simulation" className="nav-link"><Radio size={17}/><span>Simulation lab</span></a>
        <a href="#sessions" className="nav-link"><Activity size={17}/><span>Live sessions</span></a>
        <a href="#events" className="nav-link"><ClipboardList size={17}/><span>Event timeline</span></a>
      </nav>
      <div className="nav-caption nav-caption-lower">INSIGHTS</div>
      <nav className="nav-list"><a href="#behavior" className="nav-link"><Globe2 size={17}/><span>Behavior analytics</span></a><a href="#privacy" className="nav-link"><ShieldCheck size={17}/><span>Privacy controls</span></a></nav>
      <div className="sidebar-bottom">
        <div className="privacy-card"><div><ShieldCheck size={16}/> <strong>Privacy guard active</strong></div><p>Consent-first collection. No real passwords stored.</p><span><i/> LOCAL PREVIEW ONLY</span></div>
        <a href="#privacy" className="nav-link"><SlidersHorizontal size={17}/><span>Data notes</span></a>
        <div className="profile-row"><div className="profile-avatar">L</div><div><strong>Local lab</strong><small>Unauthenticated preview</small></div></div>
      </div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>Overview</strong></div><div className="top-actions"><span className="environment"><i/> LOCAL DEVELOPMENT ONLY</span><button className="icon-button" aria-label="Search"><Search size={17}/></button><button className="icon-button" aria-label="Notifications"><Bell size={17}/></button><div className="top-avatar">L</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow"><span/> THREAT AWARENESS / CONTROL CENTER</div><h1>Lab overview<span>.</span></h1><p className="subtitle">Live view of consented simulation activity, refreshed every 8 seconds.</p></div><a className="primary-button" href="/simulation"><Plus size={16}/> Open simulation lab</a></div>
        <div className="notice" id="privacy"><div className="notice-icon"><ShieldCheck size={18}/></div><div><strong>Privacy-first simulation is enabled</strong><p>Local-only analytics preview. Admin authentication and role-based access are required before online deployment.</p></div><span className="notice-status">LOCAL ONLY</span></div>
        {error && <div className="notice" role="alert"><div className="notice-icon"><ShieldAlert size={18}/></div><div><strong>Analytics unavailable</strong><p>{error}</p></div></div>}
        <section className="metrics-grid">
          <Metric label="Campaigns" value={data ? fmt(data.metrics.campaigns) : "—"} note="All campaign records" icon={Radio} tone="blue"/>
          <Metric label="Unique participants" value={data ? fmt(data.metrics.participants) : "—"} note="Distinct pseudonymous IDs" icon={Users} tone="green"/>
          <Metric label="Active sessions" value={data ? fmt(data.metrics.activeSessions) : "—"} note="Heartbeat within 90 seconds" icon={Wifi} tone="violet"/>
          <Metric label="Events captured" value={data ? fmt(data.metrics.events) : "—"} note="Stored consented events" icon={Zap} tone="amber"/>
        </section>
        <div className="dashboard-grid">
          <section className="panel activity-panel"><div className="panel-heading"><div><h2>Activity · Last 24 hours</h2><p>Hourly event volume · database-backed</p></div><span className="live-label"><i/> AUTO REFRESH</span></div>
            <div className="chart-empty real-chart" role="img" aria-label="Hourly event counts for the last 24 hours"><div className="chart-grid-lines"><i/><i/><i/><i/></div><div className="chart-bars">{data?.activity.map((v) => <span key={v.hour} title={`${clock(v.hour)} · ${v.count} events`} style={{ height: `${Math.max(2, v.count / maxActivity * 100)}%`, opacity: v.count ? 1 : .18 }}/>)}</div>{!data && <div className="chart-overlay"><div className="empty-icon"><Activity size={20}/></div><strong>Loading activity data</strong></div>}</div>
            <div className="chart-axis"><span>24h ago</span><span>18h</span><span>12h</span><span>6h</span><span>NOW</span></div>
          </section>
          <section className="panel live-panel" id="sessions"><div className="panel-heading"><div><h2>Live sessions</h2><p>Recently active, consented sessions</p></div><span className="live-label"><i/> LIVE</span></div>
            {data?.activeSessions.length ? <div className="session-list">{data.activeSessions.map((s) => <div className="session-row" key={s.id}><div className="session-indicator"/><div className="session-info"><strong>SESSION · {s.id}</strong><span>{s.campaign}</span><small>Started {stamp(s.startedAt)}</small></div><div className="session-count">{s.eventCount}<small>events</small></div></div>)}</div> : <div className="empty-state"><div className="empty-ring"><Radio size={21}/></div><strong>{data ? "No active sessions" : "Loading sessions"}</strong><span>Sessions appear while a participant is active in a simulation.</span></div>}
            <div className="panel-bottom"><span>ACTIVE = HEARTBEAT ≤ 90 SEC</span><span>8 SEC POLLING <i/></span></div>
          </section>
        </div>
        <div className="lower-grid">
          <section className="panel events-panel" id="events"><div className="panel-heading"><div><h2>Recent event stream</h2><p>Most recent recorded activity</p></div><span className="text-button">12 latest records</span></div>
            {data?.recentEvents.length ? <div className="event-list">{data.recentEvents.map((e) => <div className="event-row" key={e.id}><div className="event-dot"/><div className="event-info"><strong>{e.type.replaceAll("_", " ")}</strong><span>{e.campaign}{e.choice ? ` · ${e.choice}` : ""}{e.path ? ` · ${e.path}` : ""}</span></div><time>{stamp(e.createdAt)}</time></div>)}</div> : <div className="event-empty"><div className="empty-icon"><MousePointer2 size={18}/></div><div><strong>{data ? "No events recorded yet" : "Loading event stream"}</strong><span>Only events from consented simulation sessions are shown.</span></div></div>}
          </section>
          <section className="panel campaign-panel" id="behavior"><div className="panel-heading"><div><h2>Behavior signals</h2><p>Aggregate choices · last 24 hours</p></div><ShieldAlert size={16} color="#d6ad75"/></div>
            <div className="behavior-summary"><strong>{data ? fmt(data.behaviorSampleSize) : "—"}</strong><span>decision events sampled</span></div>
            {behavior.map((item) => <div className="behavior-row" key={item.id}><div><span>{item.label}</span><strong>{fmt(item.count)}</strong></div><div className="behavior-track"><i style={{ width: `${data?.behaviorSampleSize ? item.count / data.behaviorSampleSize * 100 : 0}%`, background: item.color }}/></div></div>)}
            <p className="analytics-note">Training indicators only. Aggregate counts are not individual risk scores or employee rankings.</p>
          </section>
        </div>
        <div className="insight-strip">
          <div><strong>Session completion</strong><span>{data ? `${data.metrics.completionRate}%` : "—"} ended sessions / all created sessions</span></div>
          <div><strong>Reports submitted</strong><span>{data ? fmt(data.metrics.reports) : "—"} report records</span></div>
          <div><strong>Last database refresh</strong><span>{updated ? stamp(updated) : "Waiting for data"}</span></div>
        </div>
        <footer className="footer"><span>PHANTOM TRACE <b>·</b> BUILDING AWARENESS THROUGH SAFE SIMULATION</span><span><CircleHelp size={13}/> Phase 4 · Local analytics preview</span></footer>
      </div>
    </section>
  </main>;
}
