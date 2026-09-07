import { describe, expect, it } from 'vitest';
import { parseDashboardConfig } from '../config/env';
import {
  DatasetVersionWireSchema,
  RunWireSchema,
  TelemetryQueryResultWireSchema,
  TelemetryQuerySchema,
} from './dataPlatform';
import { HOCContextSchema } from './hoc';
import { RobotWireSchema } from './management';

const datasetVersion = {
  dataset_version_id: '01977777-7777-7777-8777-777777777777',
  dataset_key: 'panda',
  source_repo: 'robot-arm-episode-data-lab',
  external_id: 'release-v7',
  schema_id: 'release-v0',
  content_sha256: 'a'.repeat(64),
  status: 'released',
  created_at: '2026-09-07T00:00:00Z',
};

describe('Platform wire contracts', () => {
  it('accepts a valid current DatasetVersion response', () => {
    expect(DatasetVersionWireSchema.parse(datasetVersion).external_id).toBe('release-v7');
  });

  it('rejects a missing required field', () => {
    const { content_sha256: _removed, ...missingHash } = datasetVersion;
    expect(DatasetVersionWireSchema.safeParse(missingHash).success).toBe(false);
  });

  it('rejects invalid identifier semantics', () => {
    expect(DatasetVersionWireSchema.safeParse({
      ...datasetVersion,
      dataset_version_id: 'dsv-release-v7',
    }).success).toBe(false);
  });

  it('reports schema drift instead of silently retaining unknown fields', () => {
    expect(DatasetVersionWireSchema.safeParse({
      ...datasetVersion,
      renamed_status: 'released',
    }).success).toBe(false);
  });

  it('distinguishes omitted Go pointer fields from explicit null', () => {
    const run = {
      run_id: '01911111-1111-7111-8111-111111111111',
      run_kind: 'evaluation',
      status: 'completed',
      source_repo: 'robot-arm-episode-data-lab',
      external_id: 'eval-7',
      created_at: '2026-09-07T00:00:00Z',
    };
    expect(RunWireSchema.safeParse(run).success).toBe(true);
    expect(RunWireSchema.safeParse({ ...run, started_at: null }).success).toBe(false);
  });

  it('accepts a deliberately nullable HOC artifact locator', () => {
    expect(HOCContextSchema.safeParse({
      episode_id: '01955555-5555-7555-8555-555555555555',
      evaluation_run_id: '01944444-4444-7444-8444-444444444444',
      failure_case_id: '01933333-3333-7333-8333-333333333333',
      dataset_version_id: datasetVersion.dataset_version_id,
      artifact: null,
    }).success).toBe(true);
  });
});

describe('Management and telemetry contracts', () => {
  it('keeps prefixed Management Plane IDs separate from Data UUIDs', () => {
    expect(RobotWireSchema.safeParse({
      id: 'rob-amr-001',
      display_name: 'AMR 001',
      domain: 'warehouse',
      embodiment: 'simulation',
      lifecycle_state: 'active',
      created_at: 1_788_739_200_000,
      updated_at: 1_788_739_200_000,
    }).success).toBe(true);
    expect(RobotWireSchema.safeParse({
      id: datasetVersion.dataset_version_id,
      display_name: 'wrong identity family',
      domain: 'warehouse',
      embodiment: 'simulation',
      lifecycle_state: 'active',
      created_at: 1,
      updated_at: 1,
    }).success).toBe(false);
  });

  it('validates telemetry rows while preserving stream-specific fields', () => {
    const result = TelemetryQueryResultWireSchema.parse({
      stream_name: 'imu',
      rows: [{ observed_at: '2026-09-07T00:00:00Z', ax: 1.25 }],
    });
    expect(result.rows[0]?.ax).toBe(1.25);
  });

  it('rejects unsupported motor telemetry and invalid ranges', () => {
    expect(TelemetryQuerySchema.safeParse({
      robot_id: 'rob-amr-001',
      stream_name: 'motor',
    }).success).toBe(false);
    expect(TelemetryQuerySchema.safeParse({
      robot_id: 'rob-amr-001',
      stream_name: 'imu',
      from: '2026-09-07T00:01:00Z',
      to: '2026-09-07T00:00:00Z',
    }).success).toBe(false);
  });
});

describe('Stage 5A configuration', () => {
  it('defaults to real mode and rejects implicit fallback modes', () => {
    const config = parseDashboardConfig({});
    expect(config.dataMode).toBe('real');
    expect(config.platformBaseUrl).toBe('http://127.0.0.1:9100/data/v1');
    expect(() => parseDashboardConfig({ dataMode: 'auto-fallback' })).toThrow();
  });
});
