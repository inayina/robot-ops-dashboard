import { z } from 'zod';
import {
  ArtifactIdSchema,
  DatasetVersionIdSchema,
  EpisodeIdSchema,
  EvaluationRunIdSchema,
  FailureCaseIdSchema,
} from './common';

export const HOCArtifactLocatorSchema = z.strictObject({
  artifact_id: ArtifactIdSchema,
  artifact_type: z.string().min(1),
  object_uri: z.string().min(1),
});

export const HOCContextSchema = z.strictObject({
  episode_id: EpisodeIdSchema,
  evaluation_run_id: EvaluationRunIdSchema,
  failure_case_id: FailureCaseIdSchema,
  dataset_version_id: DatasetVersionIdSchema,
  artifact: HOCArtifactLocatorSchema.nullable(),
});

export const HOCReplayResolutionSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('unsupported'),
    reason: z.string().min(1),
  }),
  z.strictObject({
    status: z.literal('ready'),
    url: z.url(),
    context: HOCContextSchema,
  }),
]);

export type HOCContext = z.infer<typeof HOCContextSchema>;
export type HOCReplayResolution = z.infer<typeof HOCReplayResolutionSchema>;
