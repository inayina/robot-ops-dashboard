import { z } from 'zod';
import {
  ArtifactIdSchema,
  DataRunIdSchema,
  DatasetVersionIdSchema,
  EpisodeIdSchema,
  EvaluationRunIdSchema,
  FailureCaseIdSchema,
  ProcessingJobIdSchema,
  Rfc3339TimestampSchema,
  Sha256Schema,
} from './common';

export const RunWireSchema = z.strictObject({
  run_id: DataRunIdSchema,
  run_kind: z.string().min(1),
  status: z.string().min(1),
  source_repo: z.string().min(1),
  source_version: z.string().optional(),
  external_id: z.string().min(1),
  robot_ref: z.string().optional(),
  task_ref: z.string().optional(),
  started_at: Rfc3339TimestampSchema.optional(),
  ended_at: Rfc3339TimestampSchema.optional(),
  created_at: Rfc3339TimestampSchema,
});

export const EpisodeWireSchema = z.strictObject({
  episode_id: EpisodeIdSchema,
  run_id: DataRunIdSchema,
  source_repo: z.string().min(1),
  source_version: z.string().optional(),
  external_id: z.string().min(1),
  episode_index: z.int().nonnegative(),
  schema_id: z.string().min(1),
  frame_count: z.int().nonnegative(),
  format: z.string().optional(),
  outcome: z.string().optional(),
  outcome_authority: z.string().optional(),
  metadata: z.unknown(),
  created_at: Rfc3339TimestampSchema,
});

export const ArtifactWireSchema = z.strictObject({
  artifact_id: ArtifactIdSchema,
  episode_id: EpisodeIdSchema,
  artifact_type: z.string().min(1),
  source_repo: z.string().min(1),
  source_version: z.string().optional(),
  external_id: z.string().min(1),
  object_uri: z.string().min(1),
  object_key: z.string().min(1),
  sha256: Sha256Schema,
  size_bytes: z.int().nonnegative(),
  media_type: z.string().min(1),
  metadata: z.unknown(),
  created_at: Rfc3339TimestampSchema,
});

export const ArtifactViewWireSchema = z.strictObject({
  artifact: ArtifactWireSchema,
  object_available: z.boolean(),
  object_size_bytes: z.int().nonnegative(),
  object_etag: z.string().optional(),
});

export const DatasetWireSchema = z.strictObject({
  dataset_key: z.string().min(1),
  display_name: z.string().min(1),
  source_repo: z.string().min(1),
  external_id: z.string().min(1),
  created_at: Rfc3339TimestampSchema,
});

export const DatasetVersionWireSchema = z.strictObject({
  dataset_version_id: DatasetVersionIdSchema,
  dataset_key: z.string().min(1),
  source_repo: z.string().min(1),
  source_version: z.string().optional(),
  external_id: z.string().min(1),
  schema_id: z.string().min(1),
  content_sha256: Sha256Schema,
  status: z.string().min(1),
  created_at: Rfc3339TimestampSchema,
});

export const DatasetVersionEpisodeWireSchema = z.strictObject({
  episode: EpisodeWireSchema,
  split: z.string().min(1),
  ordinal: z.int().nonnegative(),
  source_sha256: Sha256Schema,
});

export const DatasetVersionRefWireSchema = DatasetVersionWireSchema.extend({
  split: z.string().min(1),
  ordinal: z.int().nonnegative(),
  source_sha256: Sha256Schema,
});

export const ProcessingJobWireSchema = z.strictObject({
  processing_job_id: ProcessingJobIdSchema,
  job_type: z.string().min(1),
  status: z.string().min(1),
  episode_id: EpisodeIdSchema,
  dataset_key: z.string().min(1),
  source_repo: z.string().min(1),
  source_version: z.string().optional(),
  external_id: z.string().min(1),
  parameters: z.unknown(),
  worker_id: z.string().optional(),
  attempt: z.int().nonnegative(),
  quality_status: z.string().optional(),
  quality_result: z.unknown(),
  report_artifact_id: ArtifactIdSchema.optional(),
  dataset_version_id: DatasetVersionIdSchema.optional(),
  error_message: z.string().optional(),
  created_at: Rfc3339TimestampSchema,
  claimed_at: Rfc3339TimestampSchema.optional(),
  finished_at: Rfc3339TimestampSchema.optional(),
  updated_at: Rfc3339TimestampSchema,
});

export const EvaluationRunWireSchema = z.strictObject({
  evaluation_run_id: EvaluationRunIdSchema,
  run_id: DataRunIdSchema,
  dataset_version_id: DatasetVersionIdSchema,
  evaluation_kind: z.string().min(1),
  status: z.string().min(1),
  evidence_level: z.string().min(1),
  source_repo: z.string().min(1),
  source_version: z.string().optional(),
  external_id: z.string().min(1),
  result: z.unknown(),
  report_object_uri: z.string().min(1),
  report_object_key: z.string().min(1),
  report_sha256: Sha256Schema,
  report_size_bytes: z.int().nonnegative(),
  report_media_type: z.string().min(1),
  created_at: Rfc3339TimestampSchema,
});

export const FailureCaseWireSchema = z.strictObject({
  failure_case_id: FailureCaseIdSchema,
  evaluation_run_id: EvaluationRunIdSchema,
  episode_id: EpisodeIdSchema,
  source_repo: z.string().min(1),
  source_version: z.string().optional(),
  external_id: z.string().min(1),
  failure_stage: z.string().min(1),
  failure_reason: z.string().min(1),
  evidence: z.unknown(),
  created_at: Rfc3339TimestampSchema,
});

export const FailureCaseViewWireSchema = z.strictObject({
  failure_case: FailureCaseWireSchema,
  episode: EpisodeWireSchema,
});

export const EvaluationRefWireSchema = EvaluationRunWireSchema.extend({
  role: z.string().min(1),
});

export const DatasetVersionViewWireSchema = z.strictObject({
  dataset_version: DatasetVersionWireSchema,
  episodes: z.array(DatasetVersionEpisodeWireSchema),
  processing_jobs: z.array(ProcessingJobWireSchema),
  evaluation_runs: z.array(EvaluationRunWireSchema),
});

export const EpisodeViewWireSchema = z.strictObject({
  run: RunWireSchema,
  episode: EpisodeWireSchema,
  artifacts: z.array(ArtifactWireSchema),
  dataset_versions: z.array(DatasetVersionRefWireSchema),
  processing_jobs: z.array(ProcessingJobWireSchema),
  evaluations: z.array(EvaluationRefWireSchema),
});

export const EvaluationRunViewWireSchema = z.strictObject({
  evaluation_run: EvaluationRunWireSchema,
  run: RunWireSchema,
  dataset_version: DatasetVersionWireSchema,
  dataset_episodes: z.array(DatasetVersionEpisodeWireSchema),
  failure_cases: z.array(FailureCaseViewWireSchema),
});

export const RunLineageViewWireSchema = z.strictObject({
  run: RunWireSchema,
  episodes: z.array(EpisodeViewWireSchema),
});

export const TelemetryStreamSchema = z.enum(['imu', 'runtime_metrics']);
export const TelemetryAggregationSchema = z.enum(['raw', 'avg', 'min', 'max', 'count']);

export const TelemetryQuerySchema = z.strictObject({
  robot_id: z.string().min(1),
  device_id: z.string().min(1).optional(),
  runtime_id: z.string().min(1).optional(),
  session_id: z.string().min(1).optional(),
  stream_name: TelemetryStreamSchema,
  from: Rfc3339TimestampSchema.optional(),
  to: Rfc3339TimestampSchema.optional(),
  aggregation: TelemetryAggregationSchema.default('raw'),
  window: z.string().regex(/^[1-9][0-9]*(ms|s|m|h)$/).optional(),
  limit: z.int().min(1).max(10_000).default(1_000),
}).superRefine((value, context) => {
  if ((value.from === undefined) !== (value.to === undefined)) {
    context.addIssue({ code: 'custom', message: 'from and to must be provided together' });
  }
  if (value.from !== undefined && value.to !== undefined && Date.parse(value.to) <= Date.parse(value.from)) {
    context.addIssue({ code: 'custom', message: 'to must be after from', path: ['to'] });
  }
});

export const TelemetryQueryResultWireSchema = z.strictObject({
  stream_name: TelemetryStreamSchema,
  rows: z.array(z.record(z.string(), z.unknown())),
});

export type RunWire = z.infer<typeof RunWireSchema>;
export type EpisodeWire = z.infer<typeof EpisodeWireSchema>;
export type ArtifactWire = z.infer<typeof ArtifactWireSchema>;
export type ArtifactViewWire = z.infer<typeof ArtifactViewWireSchema>;
export type DatasetWire = z.infer<typeof DatasetWireSchema>;
export type DatasetVersionWire = z.infer<typeof DatasetVersionWireSchema>;
export type ProcessingJobWire = z.infer<typeof ProcessingJobWireSchema>;
export type EvaluationRunWire = z.infer<typeof EvaluationRunWireSchema>;
export type FailureCaseWire = z.infer<typeof FailureCaseWireSchema>;
export type FailureCaseViewWire = z.infer<typeof FailureCaseViewWireSchema>;
export type EpisodeViewWire = z.infer<typeof EpisodeViewWireSchema>;
export type DatasetVersionViewWire = z.infer<typeof DatasetVersionViewWireSchema>;
export type EvaluationRunViewWire = z.infer<typeof EvaluationRunViewWireSchema>;
export type RunLineageViewWire = z.infer<typeof RunLineageViewWireSchema>;
export type TelemetryQuery = z.input<typeof TelemetryQuerySchema>;
export type TelemetryQueryResultWire = z.infer<typeof TelemetryQueryResultWireSchema>;
