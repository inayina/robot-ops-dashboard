export const WMS_TASK_POINTS = ['station_a', 'station_b', 'dock_a', 'start_zone'] as const;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function extractWmsTasks(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const value = record(payload);
  if (Array.isArray(value.tasks)) return value.tasks;
  if (Array.isArray(value.data)) return value.data;
  return [];
}

export function parseDashboardTaskName(taskName: string): Partial<{
  task_type: string;
  pickup: string;
  dropoff: string;
}> {
  if (!taskName.startsWith('dashboard_')) return {};
  const body = taskName.slice('dashboard_'.length);
  for (const pickup of WMS_TASK_POINTS) {
    const marker = `_${pickup}_to_`;
    const markerIndex = body.indexOf(marker);
    if (markerIndex === -1) continue;
    const rest = body.slice(markerIndex + marker.length);
    const dropoff = WMS_TASK_POINTS.find((point) => rest === point || rest.startsWith(`${point}_`));
    return { task_type: body.slice(0, markerIndex), pickup, dropoff: dropoff ?? '-' };
  }
  return {};
}

export function normalizeWmsTask(input: unknown): Record<string, unknown> {
  const task = record(input);
  const taskName = text(task.task_name) || text(task.name) || text(task.order_id);
  const metadata = parseDashboardTaskName(taskName);
  return {
    id: text(task.id) || text(task.task_id) || taskName || '-',
    name: taskName,
    pickup: text(task.pickup) || text(task.pickup_station) || metadata.pickup || '-',
    dropoff: text(task.dropoff) || text(task.dropoff_station) || metadata.dropoff || text(task.target_name) || '-',
    status: text(task.status) || text(task.source_status) || '-',
    created_at: task.created_at ?? task.createdAt ?? null,
    updated_at: task.updated_at ?? task.updatedAt ?? null,
  };
}
