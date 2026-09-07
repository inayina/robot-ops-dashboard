type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as UnknownRecord : {};
}

function first(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

export function buildRunFromEvaluationSummary(input: unknown): UnknownRecord | null {
  const summary = record(input);
  const liveRun = record(summary.live_run);
  if (Object.keys(liveRun).length === 0) return null;
  const scenario = record(summary.scenario);
  return {
    run_id: first(liveRun.run_id, summary.run_id),
    run_type: first(liveRun.run_type, summary.run_type, 'baseline_system_evaluation'),
    scenario: first(liveRun.scenario, scenario.description, scenario.name, 'Live dashboard snapshot'),
    robot_id: liveRun.robot_id,
    task_source: liveRun.task_source,
    dataset_version: first(liveRun.dataset_version, summary.dataset_version),
    model_version: first(liveRun.model_version, summary.model_version),
    baseline_version: first(liveRun.baseline_version, summary.baseline_version, liveRun.model_version, summary.model_version),
    control_policy: first(liveRun.control_policy, summary.control_policy, summary.policy_type),
    status: first(liveRun.status, summary.status, summary.latest_status),
    task_total: first(liveRun.task_total, summary.task_total),
    task_success: first(liveRun.task_success, summary.task_success),
    task_failed: first(liveRun.task_failed, summary.task_failed),
    task_success_rate: first(liveRun.task_success_rate, summary.task_success_rate),
    started_at: liveRun.started_at,
    finished_at: liveRun.finished_at,
    latest_task_id: liveRun.latest_task_id,
    latest_task_route: liveRun.latest_task_route,
    latest_task_status: liveRun.latest_task_status,
    result_scope: first(liveRun.result_scope, 'live_dashboard_snapshot_not_model_training'),
    feature_snapshot: record(liveRun.feature_snapshot),
    quality_checks: record(liveRun.quality_checks),
  };
}

export function mergeEvaluationFailures(primary: unknown, fallback: unknown): UnknownRecord[] {
  const values = [
    ...(Array.isArray(primary) ? primary : []),
    ...(Array.isArray(fallback) ? fallback : []),
  ];
  const seen = new Set<string>();
  return values.map(record).filter((item) => {
    const explicit = typeof item.failure_case_id === 'string' ? item.failure_case_id : '';
    const key = explicit || `${String(item.failure_type ?? '')}-${String(item.summary ?? '')}`;
    if (!key || key === '-' || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
