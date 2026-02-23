import { CreateTopicCommand, PublishCommand, SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { LocalstackContainer } from '@testcontainers/localstack';
import type { AwsPresetCredentials, AwsPresetOptions, LocalStackAwsPreset, SharedConnection } from '../index.js';
import { validateAwsPresetOptions } from '../lib/validate-options.js';

const DEFAULT_LOCALSTACK_IMAGE = 'localstack/localstack:3.0';
const DEFAULT_TOPIC_NAME = 'test-topic';
const DEFAULT_QUEUE_NAME = 'test-queue';
const DEFAULT_CREDENTIALS: AwsPresetCredentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test',
};

export interface SnsSqsPresetOptions extends AwsPresetOptions {
  /**
   * Name of the SNS topic to create. Defaults to 'test-topic'.
   */
  topicName?: string;
  /**
   * Name of the SQS queue to create and subscribe to the topic. Defaults to 'test-queue'.
   */
  queueName?: string;
  /**
   * Optional seed messages to publish to the topic after setup (delivered to subscribed queue).
   */
  seedMessages?: string[];
}

export interface SnsSqsPreset extends LocalStackAwsPreset {
  getTopicArn(): string;
}

function validateSnsSqsPresetOptions(options: unknown): asserts options is SnsSqsPresetOptions {
  validateAwsPresetOptions(options);
  const opts = options as SnsSqsPresetOptions;
  if (opts !== undefined && 'topicName' in opts && opts.topicName !== undefined) {
    if (typeof opts.topicName !== 'string' || opts.topicName.trim() === '') {
      throw new Error(`topicName must be a non-empty string when provided, got: ${typeof opts.topicName}`);
    }
  }
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
  return new SQSClient({ endpoint: connectionUri, region, credentials });
}

function createSnsClient(
  connectionUri: string,
  region: string,
  credentials: AwsPresetCredentials
): SNSClient {
  return new SNSClient({ endpoint: connectionUri, region, credentials });
}

function buildSqsPolicyAllowSns(topicArn: string, queueArn: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'sns.amazonaws.com' },
        Action: 'sqs:SendMessage',
        Resource: queueArn,
        Condition: { ArnEquals: { 'aws:SourceArn': topicArn } },
      },
    ],
  });
}

export function createSnsSqsPreset(options?: SnsSqsPresetOptions): SnsSqsPreset {
  validateSnsSqsPresetOptions(options);
  const resolvedOptions: SnsSqsPresetOptions = Object.freeze({
    region: 'us-east-1',
    ...(options ?? {}),
    topicName: options?.topicName?.trim() || DEFAULT_TOPIC_NAME,
    queueName: options?.queueName?.trim() || DEFAULT_QUEUE_NAME,
    seedMessages: options?.seedMessages ?? [],
  });

  let startedContainer: Awaited<ReturnType<LocalstackContainer['start']>> | null = null;
  let sharedConnection: SharedConnection | null = null;
  let topicArnAfterStart: string | null = null;

  return {
    get options(): SnsSqsPresetOptions {
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
      const sqsClient = createSqsClient(connectionUri, shared?.getRegion() ?? region, credentials);
      const snsClient = createSnsClient(connectionUri, shared?.getRegion() ?? region, credentials);

      const createQueueResponse = await sqsClient.send(
        new CreateQueueCommand({ QueueName: resolvedOptions.queueName })
      );
      const queueUrl = createQueueResponse.QueueUrl;
      if (!queueUrl) throw new Error('CreateQueue did not return QueueUrl');

      const topicResponse = await snsClient.send(
        new CreateTopicCommand({ Name: resolvedOptions.topicName })
      );
      const topicArn = topicResponse.TopicArn;
      if (!topicArn) throw new Error('CreateTopic did not return TopicArn');
      topicArnAfterStart = topicArn;

      const queueAttrs = await sqsClient.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['QueueArn'],
        })
      );
      const queueArn = queueAttrs.Attributes?.QueueArn;
      if (!queueArn) throw new Error('GetQueueAttributes did not return QueueArn');

      const policy = buildSqsPolicyAllowSns(topicArn, queueArn);
      await sqsClient.send(
        new SetQueueAttributesCommand({
          QueueUrl: queueUrl,
          Attributes: { Policy: policy },
        })
      );

      await snsClient.send(
        new SubscribeCommand({
          TopicArn: topicArn,
          Protocol: 'sqs',
          Endpoint: queueArn,
        })
      );
      for (const message of resolvedOptions.seedMessages ?? []) {
        await snsClient.send(
          new PublishCommand({ TopicArn: topicArn, Message: message })
        );
      }
    },
    async stop(): Promise<void> {
      if (startedContainer) {
        await startedContainer.stop();
        startedContainer = null;
      }
      sharedConnection = null;
      topicArnAfterStart = null;
    },
    getTopicArn(): string {
      if (!topicArnAfterStart) {
        throw new Error('Preset not started; call start() first');
      }
      return topicArnAfterStart;
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
