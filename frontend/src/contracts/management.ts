import { z } from 'zod';
import {
  DeviceIdSchema,
  RobotIdSchema,
  RuntimeIdSchema,
  RuntimeSessionIdSchema,
  UnixMillisecondsSchema,
} from './common';

export const ExternalRefSchema = z.strictObject({
  namespace: z.string().min(1),
  value: z.string().min(1),
});

const lifecycleSchema = z.enum(['active', 'retired']);

export const RobotWireSchema = z.strictObject({
  id: RobotIdSchema,
  display_name: z.string().min(1),
  domain: z.string().min(1),
  embodiment: z.enum(['physical', 'simulation']),
  lifecycle_state: lifecycleSchema,
  external_refs: z.array(ExternalRefSchema).optional(),
  created_at: UnixMillisecondsSchema,
  updated_at: UnixMillisecondsSchema,
});

export const DeviceWireSchema = z.strictObject({
  id: DeviceIdSchema,
  robot_id: RobotIdSchema,
  parent_device_id: DeviceIdSchema.optional(),
  display_name: z.string().min(1),
  device_class: z.enum(['compute', 'controller', 'sensor', 'actuator', 'bus_node', 'composite']),
  domain_type: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  lifecycle_state: lifecycleSchema,
  external_refs: z.array(ExternalRefSchema).optional(),
  created_at: UnixMillisecondsSchema,
  updated_at: UnixMillisecondsSchema,
});

export const RuntimeSessionWireSchema = z.strictObject({
  session_id: RuntimeSessionIdSchema,
  runtime_id: RuntimeIdSchema,
  software_version_ref: z.string().min(1),
  started_at_reported: UnixMillisecondsSchema.optional(),
  started_at_received: UnixMillisecondsSchema,
  ended_at_reported: UnixMillisecondsSchema.optional(),
  ended_at_received: UnixMillisecondsSchema.optional(),
  session_state: z.enum(['current', 'ended', 'superseded']),
  last_heartbeat_at_ms: UnixMillisecondsSchema,
});

export const RuntimeWireSchema = z.strictObject({
  id: RuntimeIdSchema,
  robot_id: RobotIdSchema,
  display_name: z.string().min(1),
  runtime_role: z.enum(['control_runtime', 'domain_executor', 'device_bridge', 'replay_executor']),
  component: z.string().min(1),
  host_device_id: DeviceIdSchema.optional(),
  heartbeat_interval_ms: z.int().positive(),
  lifecycle_state: lifecycleSchema,
  external_refs: z.array(ExternalRefSchema).optional(),
  created_at: UnixMillisecondsSchema,
  updated_at: UnixMillisecondsSchema,
});

export const RuntimeLivenessSchema = z.enum(['unknown', 'online', 'stale', 'offline']);

export const RuntimeDetailWireSchema = z.strictObject({
  runtime: RuntimeWireSchema,
  liveness: RuntimeLivenessSchema,
  current_session: RuntimeSessionWireSchema.optional(),
  last_session: RuntimeSessionWireSchema.optional(),
});

export const RobotListWireSchema = z.strictObject({
  robots: z.array(RobotWireSchema),
  count: z.int().nonnegative(),
});

export const DeviceListWireSchema = z.strictObject({
  devices: z.array(DeviceWireSchema),
  count: z.int().nonnegative(),
});

export const RuntimeListItemWireSchema = RuntimeWireSchema.extend({
  liveness: RuntimeLivenessSchema,
  current_session: RuntimeSessionWireSchema.optional(),
});

export const RuntimeListWireSchema = z.strictObject({
  runtimes: z.array(RuntimeListItemWireSchema),
  count: z.int().nonnegative(),
});

export const RuntimeSessionListWireSchema = z.strictObject({
  sessions: z.array(RuntimeSessionWireSchema),
  count: z.int().nonnegative(),
});

export type RobotWire = z.infer<typeof RobotWireSchema>;
export type DeviceWire = z.infer<typeof DeviceWireSchema>;
export type RuntimeWire = z.infer<typeof RuntimeWireSchema>;
export type RuntimeSessionWire = z.infer<typeof RuntimeSessionWireSchema>;
export type RuntimeDetailWire = z.infer<typeof RuntimeDetailWireSchema>;
