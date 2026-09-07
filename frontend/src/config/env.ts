import { z } from 'zod';

export const DashboardDataModeSchema = z.enum(['real', 'demo']);

export const DashboardConfigSchema = z.strictObject({
  dataMode: DashboardDataModeSchema.default('real'),
  apiBaseUrl: z.url().default('http://127.0.0.1:9000'),
  platformBaseUrl: z.url().default('http://127.0.0.1:9100/data/v1'),
  platformTimeoutMs: z.int().positive().max(60_000).default(5_000),
});

export type DashboardDataMode = z.infer<typeof DashboardDataModeSchema>;
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;

export function parseDashboardConfig(input: unknown): DashboardConfig {
  return DashboardConfigSchema.parse(input);
}
