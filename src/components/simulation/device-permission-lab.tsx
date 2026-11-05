"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Camera, Monitor, ShieldCheck, Square, Video } from "lucide-react";

type Capability = "NOTIFICATION" | "SCREEN_SHARING" | "CAMERA";
type Outcome = "GRANTED" | "DENIED" | "UNAVAILABLE" | "ERROR" | "STOPPED";
type Props = { authorized: string[]; recordOutcomes: boolean };

const names: Record<Capability, string> = {
  NOTIFICATION: "Notifications", SCREEN_SHARING: "Screen sharing", CAMERA: "Camera",
};

export function DevicePermissionLab({ authorized, recordOutcomes }: Props) {
  const [notificationState, setNotificationState] = useState("Browser permission is checked when you start the test.");
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState<Capability | "">("");
  const [message, setMessage] = useState("");
  const screenVideo = useRef<HTMLVideoElement>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const allowed = (capability: Capability) => authorized.includes(capability);
  const screenAllowed = allowed("SCREEN_SHARING");
  const cameraAllowed = allowed("CAMERA");

  const report = useCallback(async (capability: Capability, outcome: Outcome): Promise<boolean> => {
    if (!recordOutcomes) return true;
    try {
      const response = await fetch("/api/simulation/permission-result", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capability, outcome }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setMessage(result?.error ?? "Could not save the permission result. The local device test has still ended.");
        return false;
      }
      return true;
    } catch {
      setMessage("Permission result could not be sent. No screen or camera content is uploaded.");
      return false;
    }
  }, [recordOutcomes]);

  useEffect(() => {
    return () => {
      screenRef.current?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
      cameraRef.current?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    };
  }, []);

  useEffect(() => {
    if (screenVideo.current) screenVideo.current.srcObject = screenStream;
  }, [screenStream]);
  useEffect(() => {
    if (cameraVideo.current) cameraVideo.current.srcObject = cameraStream;
  }, [cameraStream]);

  async function testNotification() {
    if (!allowed("NOTIFICATION") || busy) return;
    setBusy("NOTIFICATION"); setMessage("");
    try {
      if (!("Notification" in window)) {
        setNotificationState("Not supported by this browser");
        await report("NOTIFICATION", "UNAVAILABLE"); return;
      }
      if (!window.isSecureContext) {
        setNotificationState("Requires HTTPS or localhost");
        await report("NOTIFICATION", "UNAVAILABLE"); return;
      }
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      setNotificationState(`Browser permission: ${permission}`);
      if (permission === "granted") {
        const recorded = await report("NOTIFICATION", "GRANTED");
        if (!recorded) { setNotificationState("Research consent is no longer active."); return; }
        const notification = new Notification("PHANTOM TRACE — Permission test", {
          body: "This is a test notification requested by you. No device data is included.",
          tag: "phantom-trace-permission-test",
        });
        window.setTimeout(() => notification.close(), 5000);
        setMessage("Notification displayed. It will close automatically.");
      } else {
        await report("NOTIFICATION", "DENIED");
        setMessage(permission === "denied" ? "Notification permission was denied." : "Notification request was dismissed.");
      }
    } catch {
      await report("NOTIFICATION", "ERROR");
      setMessage("The browser could not complete the notification test.");
    } finally { setBusy(""); }
  }

  async function startScreenShare() {
    if (!allowed("SCREEN_SHARING") || busy || screenRef.current) return;
    setBusy("SCREEN_SHARING"); setMessage("");
    try {
      if (!navigator.mediaDevices?.getDisplayMedia || !window.isSecureContext) {
        await report("SCREEN_SHARING", "UNAVAILABLE");
        setMessage("Screen sharing is unavailable. Use a supported browser over HTTPS or localhost."); return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenRef.current = stream;
      stream.getVideoTracks()[0].onended = () => {
        if (screenRef.current !== stream) return;
        screenRef.current = null; setScreenStream(null);
        void report("SCREEN_SHARING", "STOPPED");
        setMessage("Screen sharing has stopped.");
      };
      if (!await report("SCREEN_SHARING", "GRANTED")) {
        screenRef.current = null;
        stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
        return;
      }
      setScreenStream(stream);
      setMessage("Screen preview is active on this page only. No video is uploaded or recorded.");
    } catch (error) {
      const outcome = error instanceof DOMException && error.name === "NotAllowedError" ? "DENIED" : "ERROR";
      await report("SCREEN_SHARING", outcome);
      setMessage(outcome === "DENIED" ? "Screen sharing was denied or cancelled." : "Could not start screen sharing.");
    } finally { setBusy(""); }
  }

  async function startCamera() {
    if (!allowed("CAMERA") || busy || cameraRef.current) return;
    setBusy("CAMERA"); setMessage("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        await report("CAMERA", "UNAVAILABLE");
        setMessage("Camera access is unavailable. Use a supported browser over HTTPS or localhost."); return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraRef.current = stream;
      stream.getVideoTracks()[0].onended = () => {
        if (cameraRef.current !== stream) return;
        cameraRef.current = null; setCameraStream(null);
        void report("CAMERA", "STOPPED");
        setMessage("Camera preview has stopped.");
      };
      if (!await report("CAMERA", "GRANTED")) {
        cameraRef.current = null;
        stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
        return;
      }
      setCameraStream(stream);
      setMessage("Camera preview is local to this browser tab. No photo, video, or audio is uploaded.");
    } catch (error) {
      const outcome = error instanceof DOMException && error.name === "NotAllowedError" ? "DENIED" : "ERROR";
      await report("CAMERA", outcome);
      setMessage(outcome === "DENIED" ? "Camera permission was denied or cancelled." : "Could not start the camera preview.");
    } finally { setBusy(""); }
  }

  function stopScreenShare() {
    const stream = screenRef.current;
    if (!stream) return;
    screenRef.current = null;
    stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    setScreenStream(null);
    void report("SCREEN_SHARING", "STOPPED");
    setMessage("Screen sharing stopped. The stream has been closed.");
  }

  function stopCamera() {
    const stream = cameraRef.current;
    if (!stream) return;
    cameraRef.current = null;
    stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    setCameraStream(null);
    void report("CAMERA", "STOPPED");
    setMessage("Camera stopped. The stream has been closed.");
  }

  return <section className="permission-lab">
    <div className="capability-heading"><div><strong>Device permission tests</strong><span>Native browser prompts · each test starts only when you click</span></div><ShieldCheck size={18}/></div>
    <div className="permission-grid">
      <article className="permission-card">
        <div className="permission-card-head"><span className="capability-icon"><Bell size={18}/></span><div><strong>{names.NOTIFICATION}</strong><small>{allowed("NOTIFICATION") ? "Research consent active" : "Not authorised in your consent"}</small></div></div>
        <p>Ask the browser for notification permission, then display one clearly labelled test notification.</p>
        <p className="permission-state">{notificationState}</p>
        <button className="permission-action" disabled={!allowed("NOTIFICATION") || !!busy} onClick={() => void testNotification()}>{busy === "NOTIFICATION" ? "Requesting…" : "Request notification permission"}</button>
      </article>
      <article className="permission-card">
        <div className="permission-card-head"><span className="capability-icon"><Monitor size={18}/></span><div><strong>{names.SCREEN_SHARING}</strong><small>{screenAllowed ? "Research consent active" : "Not authorised in your consent"}</small></div></div>
        <p>Open the browser&apos;s native screen picker. A selected screen is previewed locally and never uploaded.</p>
        {screenStream && <video ref={screenVideo} className="permission-preview" autoPlay playsInline muted/>}
        <button className={screenStream ? "sim-revoke permission-stop" : "permission-action"} disabled={!screenAllowed || (!!busy && busy !== "SCREEN_SHARING")} onClick={() => void (screenStream ? stopScreenShare() : startScreenShare())}>{screenStream && <Square size={13}/>} {screenStream ? "Stop screen sharing" : busy === "SCREEN_SHARING" ? "Waiting for browser…" : "Choose a screen to share"}</button>
      </article>
      <article className="permission-card">
        <div className="permission-card-head"><span className="capability-icon"><Camera size={18}/></span><div><strong>{names.CAMERA}</strong><small>{cameraAllowed ? "Research consent active" : "Not authorised in your consent"}</small></div></div>
        <p>Request camera-only access (no microphone) and show a local preview. No image or video is saved.</p>
        {cameraStream && <video ref={cameraVideo} className="permission-preview" autoPlay playsInline muted/>}
        <button className={cameraStream ? "sim-revoke permission-stop" : "permission-action"} disabled={!cameraAllowed || (!!busy && busy !== "CAMERA")} onClick={() => void (cameraStream ? stopCamera() : startCamera())}>{cameraStream && <Square size={13}/>} {cameraStream ? "Stop camera" : busy === "CAMERA" ? "Waiting for browser…" : "Request camera permission"}</button>
      </article>
    </div>
    {message && <p className="sim-feedback" role="status">{message}</p>}
    <p className="permission-footnote"><Video size={13}/> Screen and camera streams stay in this browser tab. Withdrawing research consent stops this app from using a capability; revoke persistent browser permissions separately in the browser site settings. Audio capture, recording, file access, and remote control are not part of these tests.</p>
  </section>;
}
