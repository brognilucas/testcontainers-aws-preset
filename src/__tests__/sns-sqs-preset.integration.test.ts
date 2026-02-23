/**
 * US-05 integration: SNS + SQS preset with subscription wired; pub/sub against live LocalStack.
 * Run with: RUN_INTEGRATION=1 npm test
 */
import { PublishCommand } from '@aws-sdk/client-sns';
import { SNSClient } from '@aws-sdk/client-sns';
import { GetQueueUrlCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { SQSClient } from '@aws-sdk/client-sqs';
import { createSnsSqsPreset } from '../index';

const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('SNS + SQS preset against live LocalStack', () => {
  it('should publish to topic and receive message on subscribed queue', async () => {
    const preset = createSnsSqsPreset({
      topicName: 'integration-topic',
      queueName: 'integration-sns-queue',
    });
    await preset.start();
    try {
      const connectionUri = preset.getConnectionUri();
      const credentials = preset.getCredentials();
      const region = preset.options.region ?? 'us-east-1';
      const snsClient = new SNSClient({
        endpoint: connectionUri,
        region,
        credentials,
      });
      const sqsClient = new SQSClient({
        endpoint: connectionUri,
        region,
        credentials,
      });

      const topicArn = preset.getTopicArn();
      await snsClient.send(
        new PublishCommand({
          TopicArn: topicArn,
          Message: 'hello from SNS',
        })
      );

      const getQueueUrlResponse = await sqsClient.send(
        new GetQueueUrlCommand({ QueueName: 'integration-sns-queue' })
      );
      const queueUrl = getQueueUrlResponse.QueueUrl;
      expect(queueUrl).toBeDefined();

      const receiveResponse = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 5,
        })
      );
      expect(receiveResponse.Messages).toBeDefined();
      expect(receiveResponse.Messages!.length).toBeGreaterThanOrEqual(1);
      const rawBody = receiveResponse.Messages![0]?.Body;
      const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      const message = parsed?.Message ?? parsed;
      expect(message).toContain('hello from SNS');
    } finally {
      await preset.stop();
    }
  }, 120_000);
});
