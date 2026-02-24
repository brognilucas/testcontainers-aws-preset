import type { Server } from 'node:http';
import {
  createDynamoDBPreset,
  createSharedPreset,
  createSqsPreset,
} from 'testcontainers-aws-preset';
import { GetQueueUrlCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { loadConfig } from '../config';
import { createApp } from '../app';

describe('Todo API with DynamoDB and SQS presets', () => {
  let server: Server;
  let baseUrl: string;
  const seedTodos = [
    { id: 'seed-1', title: 'First todo', status: 'pending' },
    { id: 'seed-2', title: 'Second todo', status: 'pending' },
  ];

  const preset = createSharedPreset({
    dynamodb: createDynamoDBPreset({
      tableName: 'todos',
      seedData: seedTodos,
    }),
    sqs: createSqsPreset({
      queueName: 'todo-created',
    }),
  });

  beforeAll(async () => {
    await preset.start();
    const config = preset.getConnectionConfig();
    const sqsClient = new SQSClient({
      endpoint: config.endpoint,
      region: config.region,
      credentials: config.credentials,
    });
    const { QueueUrl } = await sqsClient.send(
      new GetQueueUrlCommand({ QueueName: 'todo-created' })
    );
    if (!QueueUrl) throw new Error('No queue URL');

    process.env.AWS_ENDPOINT = config.endpoint;
    process.env.AWS_REGION = config.region;
    process.env.AWS_ACCESS_KEY_ID = config.credentials.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = config.credentials.secretAccessKey;
    process.env.TABLE_NAME = preset.presets.dynamodb.getTableName();
    process.env.QUEUE_URL = QueueUrl;
    process.env.PORT = '0';

    const appConfig = loadConfig();
    const app = createApp(appConfig);
    server = app.listen(0);
    const address = server.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  }, 90_000);

  afterAll(async () => {
    server.close();
    await preset.stop();
  });

  it('GET /todos returns seed data from DynamoDB', async () => {
    const res = await fetch(`${baseUrl}/todos`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; title: string; status: string }[];
    expect(body).toHaveLength(2);
    const titles = body.map((t) => t.title).sort();
    expect(titles).toEqual(['First todo', 'Second todo']);
  });

  it('POST /todos saves to DynamoDB and pushes event to SQS', async () => {
    const res = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New item' }),
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; title: string; status: string };
    expect(created.title).toBe('New item');
    expect(created.status).toBe('pending');
    expect(created.id).toBeDefined();

    const listRes = await fetch(`${baseUrl}/todos`);
    const list = (await listRes.json()) as { id: string; title: string }[];
    expect(list.length).toBe(3);
    expect(list.some((t) => t.title === 'New item')).toBe(true);

    const config = preset.getConnectionConfig();
    const sqsClient = new SQSClient({
      endpoint: config.endpoint,
      region: config.region,
      credentials: config.credentials,
    });
    const { QueueUrl } = await sqsClient.send(
      new GetQueueUrlCommand({ QueueName: 'todo-created' })
    );
    const receiveRes = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: QueueUrl!,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 2,
      })
    );
    const messages = receiveRes.Messages ?? [];
    const bodies = messages.map((m) => m.Body).filter(Boolean) as string[];
    const eventPayload = bodies.find((b) => b.includes('todo.created'));
    expect(eventPayload).toBeDefined();
    const parsed = JSON.parse(eventPayload!);
    expect(parsed.event).toBe('todo.created');
    expect(parsed.title).toBe('New item');
    expect(parsed.id).toBe(created.id);
  });
});
