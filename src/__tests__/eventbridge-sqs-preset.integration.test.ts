/**
 * US-06 integration: EventBridge + SQS preset; put event and receive on queue against live LocalStack.
 * Run with: RUN_INTEGRATION=1 npm test
 */
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { GetQueueUrlCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { SQSClient } from '@aws-sdk/client-sqs';
import { createEventBridgeSqsPreset } from '../index';

const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('EventBridge + SQS preset against live LocalStack', () => {
  it('should put event to rule and receive message on target queue', async () => {
    const preset = createEventBridgeSqsPreset({
      ruleName: 'integration-rule',
      queueName: 'integration-eb-queue',
    });
    await preset.start();
    try {
      const connectionUri = preset.getConnectionUri();
      const credentials = preset.getCredentials();
      const region = preset.options.region ?? 'us-east-1';
      const eventBridgeClient = new EventBridgeClient({
        endpoint: connectionUri,
        region,
        credentials,
      });
      const sqsClient = new SQSClient({
        endpoint: connectionUri,
        region,
        credentials,
      });

      await eventBridgeClient.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: 'test',
              DetailType: 'IntegrationTest',
              Detail: JSON.stringify({ message: 'hello from EventBridge' }),
            },
          ],
        })
      );

      const getQueueUrlResponse = await sqsClient.send(
        new GetQueueUrlCommand({ QueueName: 'integration-eb-queue' })
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
      expect(parsed.detail).toBeDefined();
      const detail = typeof parsed.detail === 'string' ? JSON.parse(parsed.detail) : parsed.detail;
      expect(detail.message).toBe('hello from EventBridge');
    } finally {
      await preset.stop();
    }
  }, 120_000);
});
