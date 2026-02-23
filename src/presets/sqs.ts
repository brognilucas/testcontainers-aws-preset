import { CreateQueueCommand, SQSClient } from '@aws-sdk/client-sqs';
import { LocalstackContainer } from '@testcontainers/localstack';
import type { AwsPresetCredentials, AwsPresetOptions, LocalStackAwsPreset, SharedConnection } from '../index.js';
import { validateAwsPresetOptions } from '../lib/validate-options.js';

const DEFAULT_LOCALSTACK_IMAGE = 'localstack/localstack:3.0';
const DEFAULT_QUEUE_NAME = 'test-queue';
const DEFAULT_CREDENTIALS: AwsPresetCredentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test',
};

export interface SqsPresetOptions extends AwsPresetOptions {
  /**
   * Name of the SQS queue to create. Defaults to 'test-queue'.
   * @example 'my-queue'
   */
  queueName?: string;
}

function validateSqsPresetOptions(options: unknown): asserts options is SqsPresetOptions {
  validateAwsPresetOptions(options);
  const opts = options as SqsPresetOptions;
  if (opts !== undefined && 'queueName' in opts && opts.queueName !== undefined) {
    if (typeof opts.queueName !== 'string' || opts.queueName.trim() === '') {
      throw new Error(`queueName must be a non-empty string when provided, got: ${typeof opts.queueName}`);
    }
  }
}

function createSqsClient(
  connectionUri: string,
  region: string,
  credentials: AwsPresetCredentials
): SQSClient {
  return new SQSClient({
    endpoint: connectionUri,
    region,
    credentials,
  });
}

export function createSqsPreset(options?: SqsPresetOptions): LocalStackAwsPreset {
  validateSqsPresetOptions(options);
  const resolvedOptions: SqsPresetOptions = Object.freeze({
    region: 'us-east-1',
    ...(options ?? {}),
    queueName: options?.queueName?.trim() || DEFAULT_QUEUE_NAME,
  });

  let startedContainer: Awaited<ReturnType<LocalstackContainer['start']>> | null = null;
  let sharedConnection: SharedConnection | null = null;

  return {
    get options(): SqsPresetOptions {
      return resolvedOptions;
    },
    async start(shared?: SharedConnection): Promise<void> {
      const region = resolvedOptions.region ?? 'us-east-1';
      if (shared) {
        sharedConnection = shared;
        const connectionUri = shared.getConnectionUri();
        const client = createSqsClient(connectionUri, shared.getRegion(), shared.getCredentials());
        await client.send(
          new CreateQueueCommand({ QueueName: resolvedOptions.queueName })
        );
        return;
      }
      const container = new LocalstackContainer(DEFAULT_LOCALSTACK_IMAGE);
      startedContainer = await container.start();
      const connectionUri = startedContainer.getConnectionUri();
      const client = createSqsClient(connectionUri, region, DEFAULT_CREDENTIALS);
      await client.send(
        new CreateQueueCommand({ QueueName: resolvedOptions.queueName })
      );
    },
    async stop(): Promise<void> {
      if (startedContainer) {
        await startedContainer.stop();
        startedContainer = null;
      }
      sharedConnection = null;
    },
    getConnectionUri(): string {
      if (startedContainer) return startedContainer.getConnectionUri();
      if (sharedConnection) return sharedConnection.getConnectionUri();
      throw new Error('Preset not started; call start() first');
    },
    getCredentials(): AwsPresetCredentials {
      if (sharedConnection) return sharedConnection.getCredentials();
      return { ...DEFAULT_CREDENTIALS };
    },
    getConnectionConfig() {
      return {
        endpoint: this.getConnectionUri(),
        credentials: this.getCredentials(),
        region: resolvedOptions.region ?? 'us-east-1',
      };
    },
  };
}
