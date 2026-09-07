import { describe, expect, it } from 'vitest';
import { extractWmsTasks, normalizeWmsTask, parseDashboardTaskName } from './model';

describe('WMS domain transforms', () => {
  it('extracts supported response envelopes', () => {
    expect(extractWmsTasks([{ id: '1' }])).toHaveLength(1);
    expect(extractWmsTasks({ tasks: [{ id: '2' }] })).toHaveLength(1);
    expect(extractWmsTasks({ data: [{ id: '3' }] })).toHaveLength(1);
    expect(extractWmsTasks({ invalid: [] })).toEqual([]);
  });

  it('parses and normalizes dashboard task names without inventing points', () => {
    expect(parseDashboardTaskName('dashboard_transport_station_a_to_dock_a_123')).toEqual({
      task_type: 'transport', pickup: 'station_a', dropoff: 'dock_a',
    });
    expect(normalizeWmsTask({ task_name: 'external-task', target_name: 'dock_a' })).toMatchObject({
      id: 'external-task', pickup: '-', dropoff: 'dock_a',
    });
  });
});
