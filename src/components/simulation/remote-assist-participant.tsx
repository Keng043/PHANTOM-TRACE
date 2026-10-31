"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, ShieldCheck, Square } from "lucide-react";

type Signal = { id: string; kind: "OFFER" | "ANSWER" | "ICE"; payload: RTCSessionDescriptionInit | RTCIceCandidateInit; createdAt: string };
type Room = { id: string; status: "PENDING" | "ACTIVE" | "CLOSED" | "EXPIRED"; expiresAt: string };

export function RemoteAssistParticipant({ authorized }: { authorized: boolean }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const lastSignal = useRef("");
  const processedSignals = useRef(new Set<string>());
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const post = useCallback(async (body: unknown) => {
    const response = await fetch("/api/simulation/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Support action failed.");
  }, []);
  const stop = useCallback(async (notify = true) => {
    const pc = pcRef.current; pcRef.current = null; pc?.close();
    const stream = streamRef.current; streamRef.current = null;
    stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    if (video.current) video.current.srcObject = null;
    setSharing(false);
    if (notify) { try { await post({ action: "close" }); } catch { /* local tracks are already stopped */ } }
    setRoom(null);
  }, [post]);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/simulation/support", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active && data.room?.status === "PENDING") setRoom(data.room as Room); else if (active && data.room?.status !== "ACTIVE") setRoom(null);
      } catch { /* polling is best effort */ }
    };
    void check();
    const timer = window.setInterval(() => void check(), 2000);
    return () => { active = false; window.clearInterval(timer); pcRef.current?.close(); streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [authorized]);

  async function accept() {
    if (!room || busy || sharing) return;
    setBusy(true); setMessage("");
    try {
      // Invoke the native screen picker directly from the participant's click
      // before awaiting network work so the browser's transient user activation is preserved.
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 12 }, audio: false });
      streamRef.current = stream;
      await post({ action: "approve" });
      setRoom({ ...room, status: "ACTIVE" });
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.onicecandidate = (event) => {
        if (event.candidate) void post({ action: "signal", kind: "ICE", payload: event.candidate.toJSON() }).catch(() => setMessage("Connection signaling failed."));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") setMessage("Remote viewing connection ended. You can stop sharing at any time.");
      };
      const track = stream.getVideoTracks()[0];
      if (track) track.onended = () => { void stop(true); setMessage("You stopped screen sharing."); };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await post({ action: "signal", kind: "OFFER", payload: { type: offer.type, sdp: offer.sdp } });
      setSharing(true);
      if (video.current) video.current.srcObject = stream;
      setMessage("Screen sharing is active. Staff can view this screen only; they cannot click or type on your device.");
    } catch (error) {
      await stop(true);
      setMessage(error instanceof DOMException && error.name === "NotAllowedError" ? "You declined the screen picker. No screen is shared." : error instanceof Error ? error.message : "Could not start remote assist.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (sharing && video.current && streamRef.current) video.current.srcObject = streamRef.current;
  }, [sharing]);

  useEffect(() => {
    if (!sharing || !room) return;
    let active = true;
    const poll = async () => {
      try {
        const url = lastSignal.current ? `/api/simulation/support?after=${encodeURIComponent(lastSignal.current)}` : "/api/simulation/support";
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        if (data.room?.status === "CLOSED" || data.room?.status === "EXPIRED") { await stop(false); setMessage(data.room.status === "EXPIRED" ? "The remote support invitation expired. Screen sharing has stopped." : "Staff ended the remote viewing session."); return; }
        for (const signal of data.signals as Signal[]) {
          if (processedSignals.current.has(signal.id)) continue;
          processedSignals.current.add(signal.id);
          lastSignal.current = signal.createdAt;
          const pc = pcRef.current;
          if (!pc) continue;
          if (signal.kind === "ANSWER" && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
            for (const candidate of pendingIce.current.splice(0)) await pc.addIceCandidate(candidate);
          }
          if (signal.kind === "ICE") {
            if (pc.remoteDescription) await pc.addIceCandidate(signal.payload as RTCIceCandidateInit);
            else pendingIce.current.push(signal.payload as RTCIceCandidateInit);
          }
        }
      } catch { /* retry on next poll */ }
    };
    const timer = window.setInterval(() => void poll(), 1000);
    void poll();
    return () => { active = false; window.clearInterval(timer); };
  }, [sharing, room, stop]);

  if (!authorized) return null;
  return <section className="remote-assist-card">
    <div className="capability-heading"><div><strong><Monitor size={16}/> Remote support invitation</strong><span>Screen viewing only · participant approval required</span></div><ShieldCheck size={18}/></div>
    {!room ? <p className="permission-state">No staff invitation is waiting. Remote support can only start after you grant this study permission.</p> : room.status === "PENDING" ? <><p>A researcher has requested a time-limited screen-viewing session. Your screen will not be shared unless you accept and choose a screen in the browser prompt.</p><button className="permission-action" disabled={busy} onClick={() => void accept()}>{busy ? "Opening browser permission…" : "Review request and choose screen"}</button></> : <><video ref={video} className="permission-preview" autoPlay playsInline muted/><p className="permission-state">A researcher may view your selected screen. Remote keyboard, mouse, file and system control are not available.</p><button className="sim-revoke permission-stop" onClick={() => void stop(true)}><Square size={13}/> Stop sharing and disconnect</button></>}
    {message && <p className="sim-feedback" role="status">{message}</p>}
  </section>;
}
