export type DashboardSectionKey =
  | 'tasks'
  | 'wmsTasks'
  | 'devices'
  | 'alerts'
  | 'robotStatus'
  | 'simPreview'
  | 'evaluationRuns'
  | 'inspectionRuns'
  | 'evaluationDatasets'
  | 'evaluationModels'
  | 'evaluationFailureCases'
  | 'evaluationCompute'
  | 'evaluationSummary';

export type DashboardTransport = 'demo' | 'cache' | 'http' | 'websocket';
export type TelemetryChannel = 'imu' | 'motor';
export type TransportChannel = 'backend' | 'stream';

export interface CommitMetadata {
  transport: DashboardTransport;
  observedAt?: string | number | null;
  receivedAtMs?: number;
}

export interface VersionedValue<T> {
  value: T;
  transport: DashboardTransport;
  observedAtMs: number;
  receivedAtMs: number;
  revision: number;
}

const TRANSPORT_PRIORITY: Readonly<Record<DashboardTransport, number>> = {
  demo: 0,
  cache: 1,
  http: 2,
  websocket: 3,
};

function observationTime(value: string | number | null | undefined, receivedAtMs: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return receivedAtMs;
}

function shouldAccept<T>(current: VersionedValue<T> | undefined, next: VersionedValue<T>): boolean {
  if (current === undefined) return true;
  if (current.value === null && next.value !== null) return true;
  if (next.observedAtMs > current.observedAtMs) return true;
  if (next.observedAtMs < current.observedAtMs) return false;
  return TRANSPORT_PRIORITY[next.transport] >= TRANSPORT_PRIORITY[current.transport];
}

export class DashboardStore {
  private readonly sections = new Map<DashboardSectionKey, VersionedValue<unknown>>();
  private readonly telemetry = new Map<TelemetryChannel, VersionedValue<unknown>>();
  private readonly transport: Record<TransportChannel, boolean> = { backend: false, stream: false };
  private revision = 0;
  private refreshInFlight = false;
  private selectedDatasetVersionId: string | null = null;

  commitSection<T>(key: DashboardSectionKey, value: T, metadata: CommitMetadata): boolean {
    const next = this.version(value, metadata);
    const current = this.sections.get(key) as VersionedValue<T> | undefined;
    if (!shouldAccept(current, next)) return false;
    this.sections.set(key, next);
    return true;
  }

  getSection<T = unknown>(key: DashboardSectionKey): T | null {
    return (this.sections.get(key)?.value as T | undefined) ?? null;
  }

  getSectionVersion(key: DashboardSectionKey): VersionedValue<unknown> | null {
    return this.sections.get(key) ?? null;
  }

  commitTelemetry<T>(channel: TelemetryChannel, value: T, metadata: CommitMetadata): boolean {
    const next = this.version(value, metadata);
    const current = this.telemetry.get(channel) as VersionedValue<T> | undefined;
    if (!shouldAccept(current, next)) return false;
    this.telemetry.set(channel, next);
    return true;
  }

  getTelemetry<T = unknown>(channel: TelemetryChannel): T | null {
    return (this.telemetry.get(channel)?.value as T | undefined) ?? null;
  }

  tryBeginRefresh(): boolean {
    if (this.refreshInFlight) return false;
    this.refreshInFlight = true;
    return true;
  }

  endRefresh(): void {
    this.refreshInFlight = false;
  }

  setTransportConnected(channel: TransportChannel, connected: boolean): void {
    this.transport[channel] = connected;
  }

  isTransportConnected(channel: TransportChannel): boolean {
    return this.transport[channel];
  }

  setSelectedDatasetVersionId(value: string | null): void {
    this.selectedDatasetVersionId = value;
  }

  getSelectedDatasetVersionId(): string | null {
    return this.selectedDatasetVersionId;
  }

  reset(): void {
    this.sections.clear();
    this.telemetry.clear();
    this.transport.backend = false;
    this.transport.stream = false;
    this.refreshInFlight = false;
    this.selectedDatasetVersionId = null;
    this.revision = 0;
  }

  private version<T>(value: T, metadata: CommitMetadata): VersionedValue<T> {
    const receivedAtMs = metadata.receivedAtMs ?? Date.now();
    return {
      value,
      transport: metadata.transport,
      observedAtMs: observationTime(metadata.observedAt, receivedAtMs),
      receivedAtMs,
      revision: ++this.revision,
    };
  }
}

export const dashboardStore = new DashboardStore();
