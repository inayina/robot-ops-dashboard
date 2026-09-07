import { z } from 'zod';

export const DataRunIdSchema = z.uuid().brand<'DataRunId'>();
export const EpisodeIdSchema = z.uuid().brand<'EpisodeId'>();
export const ArtifactIdSchema = z.uuid().brand<'ArtifactId'>();
export const DatasetVersionIdSchema = z.uuid().brand<'DatasetVersionId'>();
export const ProcessingJobIdSchema = z.uuid().brand<'ProcessingJobId'>();
export const EvaluationRunIdSchema = z.uuid().brand<'EvaluationRunId'>();
export const FailureCaseIdSchema = z.uuid().brand<'FailureCaseId'>();

export const RobotIdSchema = z.string().regex(/^rob-[A-Za-z0-9._:-]+$/).brand<'RobotId'>();
export const DeviceIdSchema = z.string().regex(/^dev-[A-Za-z0-9._:-]+$/).brand<'DeviceId'>();
export const RuntimeIdSchema = z.string().regex(/^rt-[A-Za-z0-9._:-]+$/).brand<'RuntimeId'>();
export const RuntimeSessionIdSchema = z.string().min(1).brand<'RuntimeSessionId'>();

export const Rfc3339TimestampSchema = z.iso.datetime({ offset: true });
export const UnixMillisecondsSchema = z.int().nonnegative();
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
export const JsonObjectSchema = z.record(z.string(), z.unknown());

export const ExternalEntityRefSchema = z.strictObject({
  source_repo: z.string().min(1),
  external_id: z.string().min(1),
});

export const PlatformErrorBodySchema = z.strictObject({
  error: z.string().min(1),
});

export type DataRunId = z.infer<typeof DataRunIdSchema>;
export type EpisodeId = z.infer<typeof EpisodeIdSchema>;
export type ArtifactId = z.infer<typeof ArtifactIdSchema>;
export type DatasetVersionId = z.infer<typeof DatasetVersionIdSchema>;
export type ProcessingJobId = z.infer<typeof ProcessingJobIdSchema>;
export type EvaluationRunId = z.infer<typeof EvaluationRunIdSchema>;
export type FailureCaseId = z.infer<typeof FailureCaseIdSchema>;
export type RobotId = z.infer<typeof RobotIdSchema>;
export type DeviceId = z.infer<typeof DeviceIdSchema>;
export type RuntimeId = z.infer<typeof RuntimeIdSchema>;
export type RuntimeSessionId = z.infer<typeof RuntimeSessionIdSchema>;
export type ExternalEntityRef = z.infer<typeof ExternalEntityRefSchema>;
