import { z } from "zod";

export const DevicePermissionResultSchema = z.object({
  capability: z.enum(["NOTIFICATION", "SCREEN_SHARING", "CAMERA"]),
  outcome: z.enum(["GRANTED", "DENIED", "UNAVAILABLE", "ERROR", "STOPPED"]),
}).strict();
