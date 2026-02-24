import { createSqsPreset } from 'testcontainers-aws-preset';
import { GetQueueUrlCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { createSqsClient, sendTodoCreated } from '../queue';
import type { Todo } from '../db';

describe('sendTodoCreated with SQS preset', () => {
  const preset = createSqsPreset({
    queueName: 'todo-events-unit',
  });

  beforeAll(async () => {
    await preset.start();
  }, 90_000);

  afterAll(async () => {
    await preset.stop();
  });

  it('sends message that can be received from the queue', async () => {
    const config = preset.getConnectionConfig();
    const client = createSqsClient({
      dynamodbEndpoint: config.endpoint,
      sqsEndpoint: config.endpoint,
      region: config.region,
      accessKeyId: config.credentials.accessKeyId,
      secretAccessKey: config.credentials.secretAccessKey,
      tableName: '',
      queueUrl: '',
      port: 0,
    });
    const sqsClient = new SQSClient({
      endpoint: config.endpoint,
      region: config.region,
      credentials: config.credentials,
    });
    const { QueueUrl } = await sqsClient.send(
      new GetQueueUrlCommand({ QueueName: 'todo-events-unit' })
    );
    if (!QueueUrl) throw new Error('No queue URL');

    const todo: Todo = { id: 'ev-1', title: 'Evented todo', status: 'pending' };
    await sendTodoCreated(client, QueueUrl, todo);

    const receiveRes = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: QueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 2,
      })
    );
    const messages = receiveRes.Messages ?? [];
    expect(messages).toHaveLength(1);
    const body = JSON.parse(messages[0].Body!);
    expect(body.event).toBe('todo.created');
    expect(body.id).toBe('ev-1');
    expect(body.title).toBe('Evented todo');
  });
});
