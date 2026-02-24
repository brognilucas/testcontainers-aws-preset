import { createDynamoDBPreset } from 'testcontainers-aws-preset';
import {
  createDynamoDBClient,
  getTodos,
  putTodo,
  type Todo,
} from '../db';

describe('getTodos with DynamoDB preset', () => {
  const seedTodos: Todo[] = [
    { id: 'u1', title: 'Unit todo one', status: 'pending' },
    { id: 'u2', title: 'Unit todo two', status: 'done' },
  ];

  const preset = createDynamoDBPreset({
    tableName: 'todos-unit',
    seedData: seedTodos,
  });

  beforeAll(async () => {
    await preset.start();
  }, 90_000);

  afterAll(async () => {
    await preset.stop();
  });

  it('returns seed data from preset-created table', async () => {
    const config = preset.getConnectionConfig();
    const client = createDynamoDBClient({
      dynamodbEndpoint: config.endpoint,
      sqsEndpoint: config.endpoint,
      region: config.region,
      accessKeyId: config.credentials.accessKeyId,
      secretAccessKey: config.credentials.secretAccessKey,
      tableName: '',
      queueUrl: '',
      port: 0,
    });
    const tableName = preset.getTableName();

    const todos = await getTodos(client, tableName);

    expect(todos).toHaveLength(2);
    const byId = Object.fromEntries(todos.map((t) => [t.id, t]));
    expect(byId['u1'].title).toBe('Unit todo one');
    expect(byId['u2'].title).toBe('Unit todo two');
    expect(byId['u2'].status).toBe('done');
  });
});

describe('putTodo with DynamoDB preset', () => {
  const preset = createDynamoDBPreset({
    tableName: 'todos-put-unit',
    seedData: [],
  });

  beforeAll(async () => {
    await preset.start();
  }, 90_000);

  afterAll(async () => {
    await preset.stop();
  });

  it('persists todo so getTodos returns it', async () => {
    const config = preset.getConnectionConfig();
    const client = createDynamoDBClient({
      dynamodbEndpoint: config.endpoint,
      sqsEndpoint: config.endpoint,
      region: config.region,
      accessKeyId: config.credentials.accessKeyId,
      secretAccessKey: config.credentials.secretAccessKey,
      tableName: '',
      queueUrl: '',
      port: 0,
    });
    const tableName = preset.getTableName();
    const newTodo: Todo = { id: 'new-1', title: 'Only this', status: 'pending' };

    await putTodo(client, tableName, newTodo);

    const todos = await getTodos(client, tableName);
    expect(todos).toHaveLength(1);
    expect(todos[0].id).toBe('new-1');
    expect(todos[0].title).toBe('Only this');
  });
});
