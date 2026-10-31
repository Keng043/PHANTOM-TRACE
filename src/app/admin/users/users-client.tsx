"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Users } from "lucide-react";

type UserRow = { id: string; name: string; email: string; role: "ADMIN" | "RESEARCHER"; active: boolean; createdAt: string };

export default function UsersClient() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "RESEARCHER">("RESEARCHER");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    if (response.status === 401 || response.status === 403) { router.replace("/"); return; }
    const data = await response.json() as { users: UserRow[] };
    setUsers(data.users);
  }, [router]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, role }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to create account.");
      setName(""); setEmail(""); setPassword(""); setRole("RESEARCHER"); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create account."); }
    finally { setBusy(false); }
  }
  return <main className="admin-page">
    <header className="admin-header"><Link href="/" className="secondary-button"><ArrowLeft size={14}/> Dashboard</Link><span className="environment">ADMINISTRATOR CONTROL</span></header>
    <div className="admin-title"><div className="eyebrow"><span/> ACCESS CONTROL / IDENTITY</div><h1>User management<span>.</span></h1><p className="subtitle">Create authorized workspace accounts. Public registration is disabled.</p></div>
    <div className="admin-grid">
      <section className="panel admin-form-panel"><div className="panel-heading"><div><h2>Create account</h2><p>New Admin or Researcher account</p></div><UserPlus size={18}/></div>
        <form className="admin-form" onSubmit={create}>
          <label htmlFor="user-name">Full name</label><input id="user-name" value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={80}/>
          <label htmlFor="user-email">Email</label><input id="user-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}/>
          <label htmlFor="user-password">Temporary password</label><input id="user-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={12} maxLength={200}/>
          <label htmlFor="user-role">Role</label><select id="user-role" value={role} onChange={e=>setRole(e.target.value as "ADMIN" | "RESEARCHER")}><option value="RESEARCHER">Researcher</option><option value="ADMIN">Admin</option></select>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="primary-button" disabled={busy}><UserPlus size={15}/>{busy ? "Creating…" : "Create account"}</button>
        </form>
      </section>
      <section className="panel admin-list-panel"><div className="panel-heading"><div><h2>Workspace accounts</h2><p>{users.length} registered users</p></div><Users size={18}/></div>
        <div className="admin-user-list">{users.map(user=><article className="admin-user-row" key={user.id}><div className="profile-avatar">{user.name.slice(0,1).toUpperCase()}</div><div className="admin-user-meta"><strong>{user.name}</strong><span>{user.email}</span></div><span className={`role-pill ${user.role.toLowerCase()}`}>{user.role}</span><span className={user.active ? "user-active" : "user-disabled"}>{user.active ? "ACTIVE" : "DISABLED"}</span></article>)}</div>
      </section>
    </div>
  </main>;
}
