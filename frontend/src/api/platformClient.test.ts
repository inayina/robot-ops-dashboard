import { describe, expect, it } from 'vitest';
import { ApiClientError } from './errors';
import { createPlatformClient } from './platformClient';
import { DatasetVersionIdSchema } from '../contracts/common';

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

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
}

describe('PlatformClient', () => {
  it('exposes no generic request or write transport', () => {
    const client = createPlatformClient({
      baseUrl: 'http://platform.test/data/v1',
      fetchImpl: async () => jsonResponse([]),
    });
    expect('request' in client).toBe(false);
    expect('post' in client).toBe(false);
    expect('put' in client).toBe(false);
    expect('delete' in client).toBe(false);
  });

  it('maps list and detail methods to the current API without inventing pagination', async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith('/dataset-versions')) return jsonResponse([]);
      return jsonResponse({
        dataset_version: datasetVersion,
        episodes: [],
        processing_jobs: [],
        evaluation_runs: [],
      });
    };
    const client = createPlatformClient({ baseUrl: 'http://platform.test/data/v1', fetchImpl });
    await expect(client.listDatasetVersions()).resolves.toEqual([]);
    await expect(client.getDatasetVersion(DatasetVersionIdSchema.parse(datasetVersion.dataset_version_id)))
      .resolves.toMatchObject({ dataset_version: datasetVersion });
    expect(urls).toEqual([
      'http://platform.test/data/v1/dataset-versions',
      `http://platform.test/data/v1/dataset-versions/${datasetVersion.dataset_version_id}`,
    ]);
  });

  it('uses exact source_repo/external_id lookup semantics for Runs', async () => {
    let requestedUrl = '';
    const fetchImpl: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return jsonResponse({
        run_id: '01911111-1111-7111-8111-111111111111',
        run_kind: 'evaluation',
        status: 'completed',
        source_repo: 'robot-arm-episode-data-lab',
        external_id: 'eval/seed 42',
        created_at: '2026-09-07T00:00:00Z',
      });
    };
    const client = createPlatformClient({ baseUrl: 'http://platform.test/data/v1', fetchImpl });
    await client.findRun({ source_repo: 'robot-arm-episode-data-lab', external_id: 'eval/seed 42' });
    expect(requestedUrl).toContain('/runs?');
    expect(requestedUrl).toContain('source_repo=robot-arm-episode-data-lab');
    expect(requestedUrl).toContain('external_id=eval%2Fseed+42');
  });

  it('selects latest/range telemetry endpoints and rejects unsupported motor streams', async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input));
      return jsonResponse({ stream_name: 'imu', rows: [] });
    };
    const client = createPlatformClient({ baseUrl: 'http://platform.test/data/v1', fetchImpl });
    await client.queryTelemetry({ robot_id: 'rob-1', stream_name: 'imu' });
    await client.queryTelemetry({
      robot_id: 'rob-1',
      stream_name: 'imu',
      from: '2026-09-07T00:00:00Z',
      to: '2026-09-07T00:01:00Z',
      aggregation: 'avg',
      window: '10s',
    });
    expect(urls[0]).toContain('/telemetry/latest?');
    expect(urls[1]).toContain('/telemetry/range?');
    try {
      await client.queryTelemetry({ robot_id: 'rob-1', stream_name: 'motor' as 'imu' });
      throw new Error('expected invalid telemetry query');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiClientError);
      expect((error as ApiClientError).kind).toBe('invalid_request');
    }
  });
});
