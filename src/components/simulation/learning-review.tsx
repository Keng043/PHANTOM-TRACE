"use client";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Fingerprint, Link2, ShieldAlert, ShieldCheck } from "lucide-react";

const lessons = [
  { title: "Unexpected urgency", body: "A short deadline is often used to make people act before checking the request." },
  { title: "Sender and domain mismatch", body: "Read the full sender address. A display name can be chosen freely and does not prove who sent a message." },
  { title: "Unverified links", body: "Do not follow a link just because a message looks familiar. Navigate using a trusted bookmark or known address." },
  { title: "Requests for secrets", body: "Legitimate support teams should not ask you to disclose your password or one-time code in a message." },
];

export function LearningReview() {
  const search = useSearchParams();
  const declined = search.get("declined") === "1";

  return <main className="sim-page"><div className="sim-shell sim-wide">
    <header className="sim-brand"><span className="sim-brand-mark"><Fingerprint size={22}/></span><span>PHANTOM <b>TRACE</b><small>SECURITY AWARENESS LAB</small></span><span className="sim-lab-pill"><i/> LEARNING CENTER</span></header>
    <section className="learning-hero">
      <div className="sim-eyebrow"><ShieldCheck size={14}/> {declined ? "YOUR CHOICE IS RESPECTED" : "SIMULATION COMPLETE"}</div>
      <h1>{declined ? "Your choice comes first." : "Pause. Check. Protect."}</h1>
      <p className="sim-lead">{declined ? "You chose not to participate. No participant session or interaction telemetry was created. You can still explore these security-awareness tips." : "The goal is not to catch you out. It is to build a repeatable habit of checking before you act."}</p>
      <div className="learning-status"><CheckCircle2 size={17}/><span>{declined ? "No simulation activity was recorded." : "Your session has ended. Review the signals below."}</span></div>
    </section>
    <section className="lesson-grid">{lessons.map((lesson, index) => <article className="lesson-card" key={lesson.title}>
      <span className="lesson-number">0{index + 1}</span><div className="lesson-icon">{index === 0 ? <ShieldAlert size={19}/> : index === 1 ? <Fingerprint size={19}/> : index === 2 ? <Link2 size={19}/> : <ShieldCheck size={19}/>}</div>
      <h2>{lesson.title}</h2><p>{lesson.body}</p>
    </article>)}</section>
    <div className="learning-callout"><ShieldCheck size={20}/><div><strong>A simple rule worth keeping</strong><p>When a message creates pressure, stop and verify through a separate trusted channel. Never share passwords or one-time codes.</p></div></div>
    <div className="learning-actions"><a className="sim-secondary" href="/simulation"><ArrowLeft size={15}/> Return to consent page</a><span>PHANTOM TRACE · PRIVACY-FIRST AWARENESS TRAINING</span></div>
    <footer className="sim-footer"><span>NO REAL CREDENTIALS ARE REQUESTED OR STORED</span><span>NOTICE VERSION 2026-10-31</span></footer>
  </div></main>;
}
