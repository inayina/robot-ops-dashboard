import { describe, expect, it, vi } from 'vitest';
import { StatusSocket, type StatusSocketLike } from './statusSocket';

class FakeSocket implements StatusSocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  close(): void { this.closed = true; }
}

const validFrame = JSON.stringify({
  type: 'dashboard_status',
  timestamp: '2026-09-07T00:00:00Z',
  tasks: [],
  robot: {},
  motor: null,
  imu: null,
});

describe('StatusSocket', () => {
  it('validates messages before delivery', () => {
    const socket = new FakeSocket();
    const onMessage = vi.fn();
    const onError = vi.fn();
    const stream = new StatusSocket({
      url: 'ws://dashboard.test/ws/status', reconnectDelayMs: 3_000,
      createSocket: () => socket, onOpen: vi.fn(), onMessage, onClose: vi.fn(), onError,
    });
    stream.start();
    socket.onmessage?.({ data: validFrame });
    socket.onmessage?.({ data: JSON.stringify({ type: 'dashboard_status', tasks: [] }) });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('contract mismatch'));
  });

  it('does not reconnect after an explicit stop', () => {
    const socket = new FakeSocket();
    const timers: Array<() => void> = [];
    const stream = new StatusSocket({
      url: 'ws://dashboard.test/ws/status', reconnectDelayMs: 3_000,
      createSocket: () => socket,
      setTimer: (callback) => { timers.push(callback); return 1 as unknown as ReturnType<typeof setTimeout>; },
      clearTimer: vi.fn(), onOpen: vi.fn(), onMessage: vi.fn(), onClose: vi.fn(), onError: vi.fn(),
    });
    stream.start();
    stream.stop();
    socket.onclose?.();
    expect(socket.closed).toBe(true);
    expect(timers).toHaveLength(0);
  });
});
