/**
 * US-04 integration: SQS preset against a live LocalStack container.
 * Run with: RUN_INTEGRATION=1 npm test
 */
import {
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { SQSClient } from '@aws-sdk/client-sqs';
import { createSqsPreset } from '../index';

const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('SQS preset against live LocalStack', () => {
  it('should start LocalStack, create queue, and send/receive message', async () => {
    const preset = createSqsPreset({ queueName: 'integration-test-queue' });
    await preset.start();
    try {
      const connectionUri = preset.getConnectionUri();
      const credentials = preset.getCredentials();
      const client = new SQSClient({
        endpoint: connectionUri,
        region: preset.options.region ?? 'us-east-1',
        credentials,
      });
      const getQueueUrlResponse = await client.send(
        new GetQueueUrlCommand({ QueueName: 'integration-test-queue' })
      );
      const queueUrl = getQueueUrlResponse.QueueUrl;
      expect(queueUrl).toBeDefined();
      await client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: 'hello from integration test',
        })
      );
      const receiveResponse = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 2,
        })
      );
      expect(receiveResponse.Messages).toHaveLength(1);
      expect(receiveResponse.Messages?.[0]?.Body).toBe('hello from integration test');
    } finally {
      await preset.stop();
    }
  }, 120_000);
});
