/**
 * US-07 integration: DynamoDB preset with optional seed data against live LocalStack.
 * Run with: RUN_INTEGRATION=1 npm test
 */
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { createDynamoDBPreset } from '../index';

const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('DynamoDB preset against live LocalStack', () => {
  it('should create table with seed data and read items', async () => {
    const preset = createDynamoDBPreset({
      tableName: 'integration-test-table',
      partitionKey: { name: 'id', type: 'S' },
      seedData: [
        { id: 'user-1', name: 'Alice', score: 100 },
        { id: 'user-2', name: 'Bob', score: 200 },
      ],
    });
    await preset.start();
    try {
      const connectionUri = preset.getConnectionUri();
      const credentials = preset.getCredentials();
      const region = preset.options.region ?? 'us-east-1';
      const client = new DynamoDBClient({
        endpoint: connectionUri,
        region,
        credentials,
      });
      const tableName = preset.getTableName();
      expect(tableName).toBe('integration-test-table');

      const getResponse = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { id: { S: 'user-1' } },
        })
      );
      expect(getResponse.Item).toBeDefined();
      const item = unmarshall(getResponse.Item!);
      expect(item.id).toBe('user-1');
      expect(item.name).toBe('Alice');
      expect(item.score).toBe(100);

      await client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: { id: { S: 'user-3' }, name: { S: 'Carol' }, score: { N: '300' } },
        })
      );
      const getNewResponse = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { id: { S: 'user-3' } },
        })
      );
      expect(getNewResponse.Item).toBeDefined();
      const newItem = unmarshall(getNewResponse.Item!);
      expect(newItem.name).toBe('Carol');
      expect(newItem.score).toBe(300);
    } finally {
      await preset.stop();
    }
  }, 120_000);

  it('should create table without seed data', async () => {
    const preset = createDynamoDBPreset({
      tableName: 'empty-integration-table',
      partitionKey: { name: 'pk', type: 'S' },
    });
    await preset.start();
    try {
      const client = new DynamoDBClient({
        endpoint: preset.getConnectionUri(),
        region: preset.options.region ?? 'us-east-1',
        credentials: preset.getCredentials(),
      });
      const tableName = preset.getTableName();
      await client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: { pk: { S: 'only-item' }, data: { S: 'value' } },
        })
      );
      const getResponse = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { pk: { S: 'only-item' } },
        })
      );
      expect(getResponse.Item).toBeDefined();
      expect(unmarshall(getResponse.Item!).data).toBe('value');
    } finally {
      await preset.stop();
    }
  }, 120_000);
});
