"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, ShieldCheck } from "lucide-react";

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to sign in.");
      router.replace("/");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="brand-mark"><Fingerprint size={22}/></span><div>PHANTOM TRACE<small>SIMULATION INTELLIGENCE</small></div></div>
    <div className="auth-eyebrow"><ShieldCheck size={14}/> AUTHORIZED WORKSPACE</div>
    <h1>Welcome back<span>.</span></h1><p>Sign in with your administrator or researcher account to access the lab workspace.</p>
    <form onSubmit={submit}>
      <label htmlFor="email">Work email</label><input id="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)}/>
      <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)}/>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="primary-button auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to workspace"}</button>
    </form><div className="auth-foot">ACCESS IS RESTRICTED TO AUTHORIZED USERS</div>
  </section></main>;
}
