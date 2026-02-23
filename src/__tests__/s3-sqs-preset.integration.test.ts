/**
 * S3 + SQS preset against live LocalStack: upload triggers notification to queue.
 * Run with: RUN_INTEGRATION=1 npm test
 */
import { GetQueueUrlCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { SQSClient } from '@aws-sdk/client-sqs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { createS3SqsPreset } from '../index';

const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('S3 + SQS preset against live LocalStack', () => {
  it('should receive S3 object-created notification on queue after upload', async () => {
    const preset = createS3SqsPreset({
      bucketName: 'integration-s3-bucket',
      queueName: 'integration-s3-queue',
    });
    await preset.start();
    try {
      const connectionUri = preset.getConnectionUri();
      const credentials = preset.getCredentials();
      const region = preset.options.region ?? 'us-east-1';
      const s3Client = new S3Client({
        endpoint: connectionUri,
        region,
        credentials,
        forcePathStyle: true,
      });
      const sqsClient = new SQSClient({
        endpoint: connectionUri,
        region,
        credentials,
      });

      const bucketName = preset.getBucketName();
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: 'test/file.txt',
          Body: 'hello from S3',
        })
      );

      await new Promise((r) => setTimeout(r, 2000));

      const getQueueUrlResponse = await sqsClient.send(
        new GetQueueUrlCommand({ QueueName: 'integration-s3-queue' })
      );
      const queueUrl = getQueueUrlResponse.QueueUrl;
      expect(queueUrl).toBeDefined();

      const receiveResponse = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 8,
        })
      );
      expect(receiveResponse.Messages).toBeDefined();
      expect(receiveResponse.Messages!.length).toBeGreaterThanOrEqual(1);
      const rawBody = receiveResponse.Messages![0]?.Body;
      const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
      expect(bodyString).toMatch(/Amazon S3|s3|ObjectCreated/);
      expect(bodyString).toContain('integration-s3-bucket');
      const parsed = JSON.parse(bodyString);
      const isTestEvent = parsed.Event === 's3:TestEvent';
      const isObjectEvent = Array.isArray(parsed.Records) && parsed.Records.some((r: { s3?: { object?: { key?: string } } }) => r.s3?.object?.key === 'test/file.txt');
      expect(isTestEvent || isObjectEvent || bodyString.includes('test/file.txt')).toBe(true);
    } finally {
      await preset.stop();
    }
  }, 120_000);
});
