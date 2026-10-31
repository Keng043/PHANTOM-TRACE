"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, ShieldCheck, Square } from "lucide-react";
type Signal = { id: string; kind: "OFFER" | "ANSWER" | "ICE"; payload: RTCSessionDescriptionInit | RTCIceCandidateInit; createdAt: string };
export function SupportViewer({ roomId }: { roomId: string }) {
  const [status, setStatus] = useState("Waiting for participant approval");
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const processed = useRef(new Set<string>());
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const send = useCallback(async (signal: { kind: string; payload: unknown }) => {
    const response = await fetch(`/api/support/rooms/${roomId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(signal) });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Signaling failed.");
  }, [roomId]);
  useEffect(() => {
    let active = true;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcRef.current = pc;
    pc.ontrack = (event) => { if (video.current) video.current.srcObject = event.streams[0]; setStatus("Connected · viewing participant screen"); };
    pc.onicecandidate = (event) => { if (event.candidate) void send({ kind: "ICE", payload: event.candidate.toJSON() }).catch((e) => setError(e.message)); };
    pc.onconnectionstatechange = () => setStatus(`Connection: ${pc.connectionState}`);
    const poll = async () => {
      try {
        const response = await fetch(`/api/support/rooms/${roomId}`, { cache: "no-store" });
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Room unavailable.");
        const data = await response.json();
        if (!active) return;
        if (data.room.status === "CLOSED") { setStatus("Participant ended the session"); pc.close(); return; }
        if (data.room.status === "PENDING") { setStatus("Waiting for participant approval"); return; }
        for (const signal of data.signals as Signal[]) {
          if (processed.current.has(signal.id)) continue;
          processed.current.add(signal.id);
          if (signal.kind === "OFFER" && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
            for (const candidate of pendingIce.current.splice(0)) await pc.addIceCandidate(candidate);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await send({ kind: "ANSWER", payload: { type: answer.type, sdp: answer.sdp } });
            setStatus("Connecting to participant screen…");
          } else if (signal.kind === "ICE") {
            if (pc.remoteDescription) await pc.addIceCandidate(signal.payload as RTCIceCandidateInit);
            else pendingIce.current.push(signal.payload as RTCIceCandidateInit);
          }
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Connection error."); }
    };
    const timer = window.setInterval(() => void poll(), 1000);
    void poll();
    return () => { active = false; window.clearInterval(timer); pc.close(); pcRef.current = null; };
  }, [roomId, send]);
  async function end() {
    pcRef.current?.close();
    await fetch(`/api/support/rooms/${roomId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close" }) }).catch(() => null);
    setStatus("Support viewer closed");
    setError("Viewer closed. The participant stream will stop after the room status refresh.");
  }
  return <main className="support-shell">
    <header><div><span className="support-mark"><Monitor size={20}/></span><strong>PHANTOM TRACE <b>REMOTE ASSIST</b></strong></div><span className="support-secure"><ShieldCheck size={14}/> CONSENT-GATED VIEW</span></header>
    <section className="support-panel">
      <div className="support-title"><div><span className="eyebrow">RESEARCHER VIEWER</span><h1>Participant screen</h1><p>View-only session. No remote input or operating-system control.</p></div><span className="support-status"><i/>{status}</span></div>
      <video ref={video} className="support-video" autoPlay playsInline/>
      {error && <p className="sim-feedback" role="alert">{error}</p>}
      <div className="support-foot"><span>Room {roomId}</span><button className="sim-revoke" onClick={() => void end()}><Square size={13}/> Close viewer</button></div>
    </section>
    <p className="support-note">Screen content is transmitted peer-to-peer where the network allows. Signaling messages are used only to establish the connection. No recording is implemented. A TURN relay is not configured; some restrictive networks may not connect.</p>
  </main>;
}
