import { z } from 'zod';
import { Rfc3339TimestampSchema } from './common';

export const DashboardEnvelopeSchema = <T extends z.ZodType>(itemSchema: T) => z.strictObject({
  generated_at: z.string().min(1),
  source: z.string().min(1),
  data: z.array(itemSchema),
});

export const DashboardApiErrorSchema = z.strictObject({
  detail: z.union([
    z.string(),
    z.strictObject({
      error_type: z.string().min(1),
      detail: z.string().min(1),
      path: z.string(),
    }),
  ]),
});

export type DashboardEnvelope<T> = {
  generated_at: string;
  source: string;
  data: T[];
};

export const DashboardStatusMessageSchema = z.strictObject({
  type: z.literal('dashboard_status'),
  timestamp: Rfc3339TimestampSchema,
  tasks: z.array(z.record(z.string(), z.unknown())),
  robot: z.record(z.string(), z.unknown()),
  motor: z.unknown().nullable().optional(),
  imu: z.unknown().nullable().optional(),
});

export type DashboardStatusMessage = z.infer<typeof DashboardStatusMessageSchema>;
