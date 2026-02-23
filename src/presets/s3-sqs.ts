import {
  CreateBucketCommand,
  PutBucketNotificationConfigurationCommand,
  S3Client,
} from '@aws-sdk/client-s3';
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
const DEFAULT_BUCKET_NAME = 'test-bucket';
const DEFAULT_QUEUE_NAME = 'test-queue';
const DEFAULT_CREDENTIALS: AwsPresetCredentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test',
};

export interface S3SqsPresetOptions extends AwsPresetOptions {
  /**
   * Name of the S3 bucket to create. Defaults to 'test-bucket'.
   */
  bucketName?: string;
  /**
   * Name of the SQS queue that receives S3 object-created notifications. Defaults to 'test-queue'.
   */
  queueName?: string;
}

export interface S3SqsPreset extends LocalStackAwsPreset {
  getBucketName(): string;
}

function validateS3SqsPresetOptions(options: unknown): asserts options is S3SqsPresetOptions {
  validateAwsPresetOptions(options);
  const opts = options as S3SqsPresetOptions;
  if (opts !== undefined && 'bucketName' in opts && opts.bucketName !== undefined) {
    if (typeof opts.bucketName !== 'string' || opts.bucketName.trim() === '') {
      throw new Error(`bucketName must be a non-empty string when provided, got: ${typeof opts.bucketName}`);
    }
  }
  if (opts !== undefined && 'queueName' in opts && opts.queueName !== undefined) {
    if (typeof opts.queueName !== 'string' || opts.queueName.trim() === '') {
      throw new Error(`queueName must be a non-empty string when provided, got: ${typeof opts.queueName}`);
    }
  }
}

function createS3Client(
  connectionUri: string,
  region: string,
  credentials: AwsPresetCredentials
): S3Client {
  return new S3Client({
    endpoint: connectionUri,
    region,
    credentials,
    forcePathStyle: true,
  });
}

function createSqsClient(
  connectionUri: string,
  region: string,
  credentials: AwsPresetCredentials
): SQSClient {
  return new SQSClient({ endpoint: connectionUri, region, credentials });
}

function buildSqsPolicyAllowS3(bucketName: string, queueArn: string): string {
  const bucketArn = `arn:aws:s3:::${bucketName}`;
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 's3.amazonaws.com' },
        Action: 'sqs:SendMessage',
        Resource: queueArn,
        Condition: { ArnLike: { 'aws:SourceArn': bucketArn } },
      },
    ],
  });
}

export function createS3SqsPreset(options?: S3SqsPresetOptions): S3SqsPreset {
  validateS3SqsPresetOptions(options);
  const resolvedOptions: S3SqsPresetOptions = Object.freeze({
    region: 'us-east-1',
    ...(options ?? {}),
    bucketName: options?.bucketName?.trim() || DEFAULT_BUCKET_NAME,
    queueName: options?.queueName?.trim() || DEFAULT_QUEUE_NAME,
  });

  let startedContainer: Awaited<ReturnType<LocalstackContainer['start']>> | null = null;
  let bucketNameAfterStart: string | null = null;

  return {
    get options(): S3SqsPresetOptions {
      return resolvedOptions;
    },
    async start(): Promise<void> {
      const container = new LocalstackContainer(DEFAULT_LOCALSTACK_IMAGE);
      startedContainer = await container.start();
      const connectionUri = startedContainer.getConnectionUri();
      const region = resolvedOptions.region ?? 'us-east-1';
      const s3Client = createS3Client(connectionUri, region, DEFAULT_CREDENTIALS);
      const sqsClient = createSqsClient(connectionUri, region, DEFAULT_CREDENTIALS);

      await s3Client.send(
        new CreateBucketCommand({ Bucket: resolvedOptions.bucketName })
      );
      bucketNameAfterStart = resolvedOptions.bucketName ?? DEFAULT_BUCKET_NAME;

      const createQueueResponse = await sqsClient.send(
        new CreateQueueCommand({ QueueName: resolvedOptions.queueName })
      );
      const queueUrl = createQueueResponse.QueueUrl;
      if (!queueUrl) throw new Error('CreateQueue did not return QueueUrl');

      const queueAttrs = await sqsClient.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['QueueArn'],
        })
      );
      const queueArn = queueAttrs.Attributes?.QueueArn;
      if (!queueArn) throw new Error('GetQueueAttributes did not return QueueArn');

      const policy = buildSqsPolicyAllowS3(resolvedOptions.bucketName!, queueArn);
      await sqsClient.send(
        new SetQueueAttributesCommand({
          QueueUrl: queueUrl,
          Attributes: { Policy: policy },
        })
      );

      await s3Client.send(
        new PutBucketNotificationConfigurationCommand({
          Bucket: resolvedOptions.bucketName,
          NotificationConfiguration: {
            QueueConfigurations: [
              {
                Id: 's3-to-sqs',
                QueueArn: queueArn,
                Events: ['s3:ObjectCreated:*'],
              },
            ],
          },
        })
      );
    },
    async stop(): Promise<void> {
      if (startedContainer) {
        await startedContainer.stop();
        startedContainer = null;
        bucketNameAfterStart = null;
      }
    },
    getBucketName(): string {
      if (!bucketNameAfterStart) {
        throw new Error('Preset not started; call start() first');
      }
      return bucketNameAfterStart;
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
  };
}
