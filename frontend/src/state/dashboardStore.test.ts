import { describe, expect, it } from 'vitest';
import { DashboardStore } from './dashboardStore';

describe('DashboardStore', () => {
  it('prevents an older HTTP snapshot from overwriting newer WebSocket data', () => {
    const store = new DashboardStore();
    expect(store.commitSection('tasks', { source: 'ws' }, {
      transport: 'websocket',
      observedAt: '2026-09-07T00:00:02Z',
      receivedAtMs: 3,
    })).toBe(true);
    expect(store.commitSection('tasks', { source: 'http' }, {
      transport: 'http',
      observedAt: '2026-09-07T00:00:01Z',
      receivedAtMs: 4,
    })).toBe(false);
    expect(store.getSection('tasks')).toEqual({ source: 'ws' });
  });

  it('prefers WebSocket when timestamps are equal', () => {
    const store = new DashboardStore();
    store.commitSection('devices', { source: 'ws' }, {
      transport: 'websocket', observedAt: 10, receivedAtMs: 10,
    });
    expect(store.commitSection('devices', { source: 'http' }, {
      transport: 'http', observedAt: 10, receivedAtMs: 11,
    })).toBe(false);
  });

  it('owns refresh, transport, telemetry, and selection state', () => {
    const store = new DashboardStore();
    expect(store.tryBeginRefresh()).toBe(true);
    expect(store.tryBeginRefresh()).toBe(false);
    store.endRefresh();
    expect(store.tryBeginRefresh()).toBe(true);
    store.commitTelemetry('imu', { ax: 1 }, { transport: 'http', observedAt: 1 });
    expect(store.getTelemetry('imu')).toEqual({ ax: 1 });
    store.setTransportConnected('backend', true);
    expect(store.isTransportConnected('backend')).toBe(true);
    store.setSelectedDatasetVersionId('dataset-v7');
    expect(store.getSelectedDatasetVersionId()).toBe('dataset-v7');
  });
});
