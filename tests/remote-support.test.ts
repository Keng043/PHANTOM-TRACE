import { describe, expect, it } from "vitest";
import {
  ParticipantSupportActionSchema,
  StaffSupportActionSchema,
  SupportSignalSchema,
} from "../src/lib/validation/support";

const sdp = "v=0\\r\\no=- 0 0 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0";

describe("remote support signaling validation", () => {
  it("accepts only a bounded WebRTC offer", () => {
    expect(SupportSignalSchema.safeParse({ kind: "OFFER", payload: { type: "offer", sdp } }).success).toBe(true);
    expect(SupportSignalSchema.safeParse({ kind: "OFFER", payload: { type: "offer", sdp, command: "remote-shell" } }).success).toBe(false);
  });

  it("accepts an ICE candidate with browser metadata", () => {
    expect(SupportSignalSchema.safeParse({
      kind: "ICE",
      payload: { candidate: "candidate:1 1 udp 1 192.0.2.1 5000 typ host", sdpMid: "0", sdpMLineIndex: 0, usernameFragment: "abc123" },
    }).success).toBe(true);
  });

  it("rejects oversized SDP and unknown control payloads", () => {
    expect(SupportSignalSchema.safeParse({ kind: "OFFER", payload: { type: "offer", sdp: "x".repeat(12_001) } }).success).toBe(false);
    expect(SupportSignalSchema.safeParse({ kind: "KEYBOARD", payload: { keys: ["CTRL", "ALT"] } }).success).toBe(false);
    expect(SupportSignalSchema.safeParse({ kind: "ICE", payload: { candidate: "x", sdpMid: "0", sdpMLineIndex: 0, remoteCommand: "click" } }).success).toBe(false);
  });

  it("requires participant approval or explicit close actions", () => {
    expect(ParticipantSupportActionSchema.safeParse({ action: "approve" }).success).toBe(true);
    expect(ParticipantSupportActionSchema.safeParse({ action: "close" }).success).toBe(true);
    expect(ParticipantSupportActionSchema.safeParse({ action: "signal", kind: "ANSWER", payload: { type: "answer", sdp } }).success).toBe(true);
    expect(ParticipantSupportActionSchema.safeParse({ action: "control", command: "type" }).success).toBe(false);
  });

  it("allows staff to send signaling messages or close a viewer, never remote input", () => {
    expect(StaffSupportActionSchema.safeParse({ kind: "ANSWER", payload: { type: "answer", sdp } }).success).toBe(true);
    expect(StaffSupportActionSchema.safeParse({ action: "close" }).success).toBe(true);
    expect(StaffSupportActionSchema.safeParse({ action: "remote_click", x: 100, y: 200 }).success).toBe(false);
  });
});
