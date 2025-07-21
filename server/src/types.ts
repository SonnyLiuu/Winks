import type { Context } from "hono";
import { z } from "zod";

export const SettingsSchema = z.object({
  leftWinkSensitivity: z.number(),
  rightWinkSensitivity: z.number(),
  yaw: z.number(),
  pitch: z.number(),
  deadZone: z.number(),
  tiltAngle: z.number(),
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  settings: SettingsSchema,
});

export type AppContext = Context<{ Bindings: Env }>;
export type Settings = z.infer<typeof SettingsSchema>;
