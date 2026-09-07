import { z } from 'zod';
import { ApiClientError } from './errors';
import { HttpClient, type QueryParameters } from './httpClient';
import {
  ArtifactViewWireSchema,
  DatasetVersionViewWireSchema,
  DatasetVersionWireSchema,
  EpisodeViewWireSchema,
  EpisodeWireSchema,
  EvaluationRunViewWireSchema,
  EvaluationRunWireSchema,
  FailureCaseViewWireSchema,
  ProcessingJobWireSchema,
  RunLineageViewWireSchema,
  RunWireSchema,
  TelemetryQueryResultWireSchema,
  TelemetryQuerySchema,
  type ArtifactViewWire,
  type DatasetVersionViewWire,
  type DatasetVersionWire,
  type EpisodeViewWire,
  type EpisodeWire,
  type EvaluationRunViewWire,
  type EvaluationRunWire,
  type FailureCaseViewWire,
  type ProcessingJobWire,
  type RunLineageViewWire,
  type RunWire,
  type TelemetryQuery,
  type TelemetryQueryResultWire,
} from '../contracts/dataPlatform';
import {
  ArtifactIdSchema,
  DataRunIdSchema,
  DatasetVersionIdSchema,
  EpisodeIdSchema,
  EvaluationRunIdSchema,
  ExternalEntityRefSchema,
  ProcessingJobIdSchema,
  type ArtifactId,
  type DataRunId,
  type DatasetVersionId,
  type EpisodeId,
  type EvaluationRunId,
  type ExternalEntityRef,
  type ProcessingJobId,
} from '../contracts/common';

const DatasetVersionListWireSchema = z.array(DatasetVersionWireSchema);
const EvaluationRunListWireSchema = z.array(EvaluationRunWireSchema);
const FailureCaseListWireSchema = z.array(FailureCaseViewWireSchema);

function parseInput<Output>(schema: z.ZodType<Output>, value: unknown, label: string): Output {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiClientError({
      kind: 'invalid_request',
      message: `Invalid ${label}`,
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`),
    });
  }
  return parsed.data;
}

export interface ReadOnlyPlatformClient {
  listDatasetVersions(signal?: AbortSignal): Promise<DatasetVersionWire[]>;
  getDatasetVersion(id: DatasetVersionId, signal?: AbortSignal): Promise<DatasetVersionViewWire>;
  findRun(ref: ExternalEntityRef, signal?: AbortSignal): Promise<RunWire>;
  getRun(id: DataRunId, signal?: AbortSignal): Promise<RunWire>;
  getRunLineage(id: DataRunId, signal?: AbortSignal): Promise<RunLineageViewWire>;
  findEpisode(ref: ExternalEntityRef, signal?: AbortSignal): Promise<EpisodeWire>;
  getEpisodeContext(id: EpisodeId, signal?: AbortSignal): Promise<EpisodeViewWire>;
  getProcessingJob(id: ProcessingJobId, signal?: AbortSignal): Promise<ProcessingJobWire>;
  listEvaluationRuns(signal?: AbortSignal): Promise<EvaluationRunWire[]>;
  getEvaluationRun(id: EvaluationRunId, signal?: AbortSignal): Promise<EvaluationRunViewWire>;
  listFailureCases(signal?: AbortSignal): Promise<FailureCaseViewWire[]>;
  getArtifact(id: ArtifactId, signal?: AbortSignal): Promise<ArtifactViewWire>;
  queryTelemetry(query: TelemetryQuery, signal?: AbortSignal): Promise<TelemetryQueryResultWire>;
}

function signalOptions(signal: AbortSignal | undefined): { signal?: AbortSignal } {
  return signal === undefined ? {} : { signal };
}

export class PlatformClient implements ReadOnlyPlatformClient {
  constructor(private readonly http: HttpClient) {}

  listDatasetVersions(signal?: AbortSignal): Promise<DatasetVersionWire[]> {
    return this.http.get('/dataset-versions', DatasetVersionListWireSchema, signalOptions(signal));
  }

  getDatasetVersion(id: DatasetVersionId, signal?: AbortSignal): Promise<DatasetVersionViewWire> {
    const value = parseInput(DatasetVersionIdSchema, id, 'dataset_version_id');
    return this.http.get(`/dataset-versions/${value}`, DatasetVersionViewWireSchema, signalOptions(signal));
  }

  findRun(ref: ExternalEntityRef, signal?: AbortSignal): Promise<RunWire> {
    const value = parseInput(ExternalEntityRefSchema, ref, 'Run external reference');
    return this.http.get('/runs', RunWireSchema, {
      query: value,
      ...signalOptions(signal),
    });
  }

  getRun(id: DataRunId, signal?: AbortSignal): Promise<RunWire> {
    const value = parseInput(DataRunIdSchema, id, 'run_id');
    return this.http.get(`/runs/${value}`, RunWireSchema, signalOptions(signal));
  }

  getRunLineage(id: DataRunId, signal?: AbortSignal): Promise<RunLineageViewWire> {
    const value = parseInput(DataRunIdSchema, id, 'run_id');
    return this.http.get(`/runs/${value}/lineage`, RunLineageViewWireSchema, signalOptions(signal));
  }

  findEpisode(ref: ExternalEntityRef, signal?: AbortSignal): Promise<EpisodeWire> {
    const value = parseInput(ExternalEntityRefSchema, ref, 'Episode external reference');
    return this.http.get('/episodes', EpisodeWireSchema, {
      query: value,
      ...signalOptions(signal),
    });
  }

  getEpisodeContext(id: EpisodeId, signal?: AbortSignal): Promise<EpisodeViewWire> {
    const value = parseInput(EpisodeIdSchema, id, 'episode_id');
    return this.http.get(`/episodes/${value}`, EpisodeViewWireSchema, signalOptions(signal));
  }

  getProcessingJob(id: ProcessingJobId, signal?: AbortSignal): Promise<ProcessingJobWire> {
    const value = parseInput(ProcessingJobIdSchema, id, 'processing_job_id');
    return this.http.get(`/processing-jobs/${value}`, ProcessingJobWireSchema, signalOptions(signal));
  }

  listEvaluationRuns(signal?: AbortSignal): Promise<EvaluationRunWire[]> {
    return this.http.get('/evaluation-runs', EvaluationRunListWireSchema, signalOptions(signal));
  }

  getEvaluationRun(id: EvaluationRunId, signal?: AbortSignal): Promise<EvaluationRunViewWire> {
    const value = parseInput(EvaluationRunIdSchema, id, 'evaluation_run_id');
    return this.http.get(`/evaluation-runs/${value}`, EvaluationRunViewWireSchema, signalOptions(signal));
  }

  listFailureCases(signal?: AbortSignal): Promise<FailureCaseViewWire[]> {
    return this.http.get('/failure-cases', FailureCaseListWireSchema, signalOptions(signal));
  }

  getArtifact(id: ArtifactId, signal?: AbortSignal): Promise<ArtifactViewWire> {
    const value = parseInput(ArtifactIdSchema, id, 'artifact_id');
    return this.http.get(`/artifacts/${value}`, ArtifactViewWireSchema, signalOptions(signal));
  }

  queryTelemetry(input: TelemetryQuery, signal?: AbortSignal): Promise<TelemetryQueryResultWire> {
    const query = parseInput(TelemetryQuerySchema, input, 'telemetry query');
    const ranged = query.from !== undefined && query.to !== undefined;
    const parameters: QueryParameters = {
      robot_id: query.robot_id,
      device_id: query.device_id,
      runtime_id: query.runtime_id,
      session_id: query.session_id,
      stream_name: query.stream_name,
      from: query.from,
      to: query.to,
      aggregation: query.aggregation,
      window: query.window,
      limit: query.limit,
    };
    return this.http.get(
      ranged ? '/telemetry/range' : '/telemetry/latest',
      TelemetryQueryResultWireSchema,
      { query: parameters, ...signalOptions(signal) },
    );
  }
}

export interface CreatePlatformClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  requestIdFactory?: () => string;
}

export function createPlatformClient(options: CreatePlatformClientOptions): PlatformClient {
  return new PlatformClient(new HttpClient(options));
}
