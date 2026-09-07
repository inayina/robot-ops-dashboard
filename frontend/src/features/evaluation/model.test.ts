import { describe, expect, it } from 'vitest';
import { buildRunFromEvaluationSummary, mergeEvaluationFailures } from './model';

describe('evaluation domain transforms', () => {
  it('builds a bounded live snapshot without upgrading evidence', () => {
    const run = buildRunFromEvaluationSummary({
      run_id: 'summary-run',
      live_run: { task_total: 2, model_version: 'baseline-no-learning' },
    });
    expect(run).toMatchObject({
      run_id: 'summary-run', task_total: 2,
      result_scope: 'live_dashboard_snapshot_not_model_training',
    });
  });

  it('deduplicates failure cases by real ID', () => {
    expect(mergeEvaluationFailures(
      [{ failure_case_id: 'failure-1', summary: 'first' }],
      [{ failure_case_id: 'failure-1', summary: 'duplicate' }, { failure_case_id: 'failure-2' }],
    ).map((item) => item.failure_case_id)).toEqual(['failure-1', 'failure-2']);
  });
});
