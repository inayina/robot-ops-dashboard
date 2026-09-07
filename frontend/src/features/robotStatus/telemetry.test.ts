import { describe, expect, it } from 'vitest';
import {
  extractImuSnapshotFromRobotStatus,
  extractMotorSnapshotFromStatusMessage,
} from './telemetry';

describe('robot telemetry transforms', () => {
  it('normalizes HTTP IMU status with robot-state provenance', () => {
    const snapshot = extractImuSnapshotFromRobotStatus({
      generated_at: '2026-09-07T00:00:00Z',
      source: 'mqtt_robot_status',
      topics: {
        'robot/imu': { received_at: '2026-09-07T00:00:01Z', payload: { ax: 1 } },
        'robot/state': { received_at: '2026-09-07T00:00:02Z', payload: { state: 'normal' } },
      },
      robot: {},
    });
    expect(snapshot).toMatchObject({
      topic: 'robot/imu', last_seen: '2026-09-07T00:00:01Z', payload: { ax: 1 },
      robot_state: { last_seen: '2026-09-07T00:00:02Z' },
    });
  });

  it('prefers explicit WebSocket motor payload over nested MQTT cache', () => {
    const snapshot = extractMotorSnapshotFromStatusMessage({
      timestamp: '2026-09-07T00:00:00Z',
      motor: { actual_rpm: 20 },
      robot: { mqtt: { robot: { motor_status: { actual_rpm: 10 } } } },
    });
    expect(snapshot.payload).toEqual({ actual_rpm: 20 });
    expect(snapshot.source).toBe('websocket:/ws/status');
  });
});
