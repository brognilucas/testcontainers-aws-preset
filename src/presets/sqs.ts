import { CreateQueueCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
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
  /**
   * Optional seed messages to send to the queue after creation.
   */
  seedMessages?: string[];
}

function validateSqsPresetOptions(options: unknown): asserts options is SqsPresetOptions {
  validateAwsPresetOptions(options);
  const opts = options as SqsPresetOptions;
  if (opts !== undefined && 'queueName' in opts && opts.queueName !== undefined) {
    if (typeof opts.queueName !== 'string' || opts.queueName.trim() === '') {
      throw new Error(`queueName must be a non-empty string when provided, got: ${typeof opts.queueName}`);
    }
  }
  if (opts !== undefined && 'seedMessages' in opts && opts.seedMessages !== undefined) {
    if (!Array.isArray(opts.seedMessages)) {
      throw new Error('seedMessages must be an array when provided');
    }
    for (let i = 0; i < opts.seedMessages.length; i++) {
      if (typeof opts.seedMessages[i] !== 'string') {
        throw new Error(`seedMessages[${i}] must be a string`);
      }
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
    seedMessages: options?.seedMessages ?? [],
  });

  let startedContainer: Awaited<ReturnType<LocalstackContainer['start']>> | null = null;
  let sharedConnection: SharedConnection | null = null;

  return {
    get options(): SqsPresetOptions {
      return resolvedOptions;
    },
    async start(shared?: SharedConnection): Promise<void> {
      const region = resolvedOptions.region ?? 'us-east-1';
      let connectionUri: string;
      let credentials: AwsPresetCredentials;
      if (shared) {
        sharedConnection = shared;
        connectionUri = shared.getConnectionUri();
        credentials = shared.getCredentials();
      } else {
        const container = new LocalstackContainer(DEFAULT_LOCALSTACK_IMAGE);
        startedContainer = await container.start();
        connectionUri = startedContainer.getConnectionUri();
        credentials = DEFAULT_CREDENTIALS;
      }
      const client = createSqsClient(
        connectionUri,
        shared?.getRegion() ?? region,
        credentials
      );
      const createResponse = await client.send(
        new CreateQueueCommand({ QueueName: resolvedOptions.queueName })
      );
      const queueUrl = createResponse.QueueUrl;
      if (!queueUrl) throw new Error('CreateQueue did not return QueueUrl');
      for (const body of resolvedOptions.seedMessages ?? []) {
        await client.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: body }));
      }
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
    getContainerId(): string {
      if (!startedContainer) {
        throw new Error('Preset does not own a container; call start() without shared connection first');
      }
      return startedContainer.getId();
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
