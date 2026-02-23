import { CreateTopicCommand, SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { LocalstackContainer } from '@testcontainers/localstack';
import type { AwsPresetCredentials, AwsPresetOptions, LocalStackAwsPreset } from '../index.js';
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
  });

  let startedContainer: Awaited<ReturnType<LocalstackContainer['start']>> | null = null;
  let topicArnAfterStart: string | null = null;

  return {
    get options(): SnsSqsPresetOptions {
      return resolvedOptions;
    },
    async start(): Promise<void> {
      const container = new LocalstackContainer(DEFAULT_LOCALSTACK_IMAGE);
      startedContainer = await container.start();
      const connectionUri = startedContainer.getConnectionUri();
      const region = resolvedOptions.region ?? 'us-east-1';
      const sqsClient = createSqsClient(connectionUri, region, DEFAULT_CREDENTIALS);
      const snsClient = createSnsClient(connectionUri, region, DEFAULT_CREDENTIALS);

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
    },
    async stop(): Promise<void> {
      if (startedContainer) {
        await startedContainer.stop();
        startedContainer = null;
        topicArnAfterStart = null;
      }
    },
    getTopicArn(): string {
      if (!topicArnAfterStart) {
        throw new Error('Preset not started; call start() first');
      }
      return topicArnAfterStart;
    },
    getConnectionUri(): string {
      if (!startedContainer) {
        throw new Error('Preset not started; call start() first');
      }
      return startedContainer.getConnectionUri();
    },
    getCredentials(): AwsPresetCredentials {
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
