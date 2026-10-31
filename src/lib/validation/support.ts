import { z } from "zod";

const offer = z.object({
  kind: z.literal("OFFER"),
  payload: z.object({ type: z.literal("offer"), sdp: z.string().min(1).max(12_000) }).strict(),
}).strict();
const answer = z.object({
  kind: z.literal("ANSWER"),
  payload: z.object({ type: z.literal("answer"), sdp: z.string().min(1).max(12_000) }).strict(),
}).strict();
const ice = z.object({
  kind: z.literal("ICE"),
  payload: z.object({
    candidate: z.string().min(1).max(2_048),
    sdpMid: z.string().max(128).nullable(),
    sdpMLineIndex: z.number().int().min(0).max(64).nullable(),
    usernameFragment: z.string().max(256).nullable().optional(),
  }).strict(),
}).strict();

export const SupportSignalSchema = z.discriminatedUnion("kind", [offer, answer, ice]);
export const ParticipantSupportActionSchema = z.union([
  z.object({ action: z.literal("approve") }).strict(),
  z.object({ action: z.literal("close") }).strict(),
  z.object({ action: z.literal("signal"), ...offer.shape }).strict(),
  z.object({ action: z.literal("signal"), ...answer.shape }).strict(),
  z.object({ action: z.literal("signal"), ...ice.shape }).strict(),
]);
export const StaffSupportActionSchema = z.union([
  z.object({ action: z.literal("close") }).strict(),
  SupportSignalSchema,
]);
