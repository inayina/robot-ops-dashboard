import { DashboardStatusMessageSchema, type DashboardStatusMessage } from '../contracts/dashboard';

export interface StatusSocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  close(): void;
}

export interface StatusSocketOptions {
  url: string;
  reconnectDelayMs: number;
  createSocket?: (url: string) => StatusSocketLike;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
  onOpen: () => void;
  onMessage: (message: DashboardStatusMessage) => void;
  onClose: () => void;
  onError: (message: string) => void;
}

function browserSocket(url: string): StatusSocketLike {
  return new WebSocket(url) as unknown as StatusSocketLike;
}

function decodeMessage(data: unknown): DashboardStatusMessage {
  if (typeof data !== 'string') throw new Error('status frame must be UTF-8 JSON text');
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw new Error('status frame is not valid JSON');
  }
  const parsed = DashboardStatusMessageSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`status contract mismatch at ${issue?.path.join('.') || '<root>'}: ${issue?.message || 'invalid frame'}`);
  }
  return parsed.data;
}

export class StatusSocket {
  private socket: StatusSocketLike | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private stopped = true;
  private readonly createSocket: (url: string) => StatusSocketLike;
  private readonly setTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (handle: ReturnType<typeof setTimeout>) => void;

  constructor(private readonly options: StatusSocketOptions) {
    this.createSocket = options.createSocket ?? browserSocket;
    this.setTimer = options.setTimer ?? globalThis.setTimeout.bind(globalThis);
    this.clearTimer = options.clearTimer ?? globalThis.clearTimeout.bind(globalThis);
  }

  start(): void {
    this.stop();
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.generation += 1;
    if (this.reconnectTimer !== null) {
      this.clearTimer(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  private connect(): void {
    if (this.stopped) return;
    const generation = ++this.generation;
    const socket = this.createSocket(this.options.url);
    this.socket = socket;
    socket.onopen = () => {
      if (!this.isCurrent(socket, generation)) return;
      this.options.onOpen();
    };
    socket.onmessage = (event) => {
      if (!this.isCurrent(socket, generation)) return;
      try {
        this.options.onMessage(decodeMessage(event.data));
      } catch (error) {
        this.options.onError(error instanceof Error ? error.message : 'invalid status frame');
      }
    };
    socket.onerror = () => {
      if (this.isCurrent(socket, generation)) this.options.onError('status stream error');
    };
    socket.onclose = () => {
      if (!this.isCurrent(socket, generation)) return;
      this.socket = null;
      this.options.onClose();
      this.reconnectTimer = this.setTimer(() => {
        this.reconnectTimer = null;
        this.connect();
      }, this.options.reconnectDelayMs);
    };
  }

  private isCurrent(socket: StatusSocketLike, generation: number): boolean {
    return !this.stopped && this.socket === socket && this.generation === generation;
  }
}
