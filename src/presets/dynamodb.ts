import {
  BatchWriteItemCommand,
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  type KeySchemaElement,
  type AttributeDefinition,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { LocalstackContainer } from '@testcontainers/localstack';
import type { AwsPresetCredentials, AwsPresetOptions, LocalStackAwsPreset, SharedConnection } from '../index.js';
import { validateAwsPresetOptions } from '../lib/validate-options.js';

const DEFAULT_LOCALSTACK_IMAGE = 'localstack/localstack:3.0';
const DEFAULT_TABLE_NAME = 'test-table';
const DEFAULT_PARTITION_KEY = 'id';
const DEFAULT_CREDENTIALS: AwsPresetCredentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test',
};

export type DynamoDBKeyType = 'S' | 'N' | 'B';

export interface DynamoDBKeySchema {
  name: string;
  type: DynamoDBKeyType;
}

export interface DynamoDBPresetOptions extends AwsPresetOptions {
  /**
   * Name of the DynamoDB table to create. Defaults to 'test-table'.
   */
  tableName?: string;
  /**
   * Partition key definition. Defaults to { name: 'id', type: 'S' }.
   */
  partitionKey?: DynamoDBKeySchema;
  /**
   * Optional sort key definition.
   */
  sortKey?: DynamoDBKeySchema;
  /**
   * Optional seed data: array of item objects to put after table creation.
   * Each item must include the partition key (and sort key if defined).
   */
  seedData?: Record<string, unknown>[];
}

export interface DynamoDBPreset extends LocalStackAwsPreset {
  getTableName(): string;
}

function validateDynamoDBPresetOptions(
  options: unknown
): asserts options is DynamoDBPresetOptions {
  validateAwsPresetOptions(options);
  const opts = options as DynamoDBPresetOptions;
  if (opts !== undefined && 'tableName' in opts && opts.tableName !== undefined) {
    if (typeof opts.tableName !== 'string' || opts.tableName.trim() === '') {
      throw new Error(`tableName must be a non-empty string when provided, got: ${typeof opts.tableName}`);
    }
  }
  if (opts !== undefined && 'partitionKey' in opts && opts.partitionKey !== undefined) {
    const pk = opts.partitionKey;
    if (typeof pk !== 'object' || pk === null || typeof pk.name !== 'string' || pk.name.trim() === '') {
      throw new Error('partitionKey must be { name: string, type: "S"|"N"|"B" }');
    }
    if (!['S', 'N', 'B'].includes(pk.type)) {
      throw new Error('partitionKey.type must be S, N, or B');
    }
  }
  if (opts !== undefined && 'sortKey' in opts && opts.sortKey !== undefined) {
    const sk = opts.sortKey;
    if (typeof sk !== 'object' || sk === null || typeof sk.name !== 'string' || sk.name.trim() === '') {
      throw new Error('sortKey must be { name: string, type: "S"|"N"|"B" }');
    }
    if (!['S', 'N', 'B'].includes(sk.type)) {
      throw new Error('sortKey.type must be S, N, or B');
    }
  }
  if (opts !== undefined && 'seedData' in opts && opts.seedData !== undefined) {
    if (!Array.isArray(opts.seedData)) {
      throw new Error('seedData must be an array when provided');
    }
  }
}

function createDynamoDBClient(
  connectionUri: string,
  region: string,
  credentials: AwsPresetCredentials
): DynamoDBClient {
  return new DynamoDBClient({ endpoint: connectionUri, region, credentials });
}

function buildKeySchema(partitionKey: DynamoDBKeySchema, sortKey?: DynamoDBKeySchema): KeySchemaElement[] {
  const schema: KeySchemaElement[] = [
    { AttributeName: partitionKey.name, KeyType: 'HASH' },
  ];
  if (sortKey) {
    schema.push({ AttributeName: sortKey.name, KeyType: 'RANGE' });
  }
  return schema;
}

function buildAttributeDefinitions(
  partitionKey: DynamoDBKeySchema,
  sortKey?: DynamoDBKeySchema
): AttributeDefinition[] {
  const defs: AttributeDefinition[] = [
    { AttributeName: partitionKey.name, AttributeType: partitionKey.type },
  ];
  if (sortKey) {
    defs.push({ AttributeName: sortKey.name, AttributeType: sortKey.type });
  }
  return defs;
}

async function waitForTableActive(
  client: DynamoDBClient,
  tableName: string,
  maxWaitMs: number = 30_000
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const response = await client.send(new DescribeTableCommand({ TableName: tableName }));
    const status = response.Table?.TableStatus;
    if (status === 'ACTIVE') return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Table ${tableName} did not become ACTIVE within ${maxWaitMs}ms`);
}

const BATCH_WRITE_MAX = 25;

function keyFromItem(
  item: Record<string, AttributeValue>,
  partitionKeyName: string,
  sortKeyName?: string
): Record<string, AttributeValue> {
  const key: Record<string, AttributeValue> = { [partitionKeyName]: item[partitionKeyName] };
  if (sortKeyName && item[sortKeyName]) key[sortKeyName] = item[sortKeyName];
  return key;
}

async function clearDynamoDBTable(
  client: DynamoDBClient,
  tableName: string,
  partitionKeyName: string,
  sortKeyName?: string
): Promise<void> {
  const keysToDelete: Record<string, AttributeValue>[] = [];
  let lastEvaluatedKey: Record<string, AttributeValue> | undefined;
  do {
    const scanResponse = await client.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    const items = scanResponse.Items ?? [];
    for (const item of items) {
      keysToDelete.push(keyFromItem(item, partitionKeyName, sortKeyName));
    }
    lastEvaluatedKey = scanResponse.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  for (let i = 0; i < keysToDelete.length; i += BATCH_WRITE_MAX) {
    const chunk = keysToDelete.slice(i, i + BATCH_WRITE_MAX);
    await client.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: chunk.map((Key) => ({ DeleteRequest: { Key } })),
        },
      })
    );
  }
}

export function createDynamoDBPreset(options?: DynamoDBPresetOptions): DynamoDBPreset {
  validateDynamoDBPresetOptions(options);
  const partitionKey = options?.partitionKey ?? { name: DEFAULT_PARTITION_KEY, type: 'S' as const };
  const sortKey = options?.sortKey;
  const resolvedOptions: DynamoDBPresetOptions = Object.freeze({
    region: 'us-east-1',
    ...(options ?? {}),
    tableName: options?.tableName?.trim() || DEFAULT_TABLE_NAME,
    partitionKey,
    sortKey,
    seedData: options?.seedData ?? [],
  });

  let startedContainer: Awaited<ReturnType<LocalstackContainer['start']>> | null = null;
  let sharedConnection: SharedConnection | null = null;
  let tableNameAfterStart: string | null = null;

  return {
    get options(): DynamoDBPresetOptions {
      return resolvedOptions;
    },
    async start(shared?: SharedConnection): Promise<void> {
      const region = resolvedOptions.region ?? 'us-east-1';
      let connectionUri: string;
      let credentials: AwsPresetCredentials;
      if (shared) {
        sharedConnection = shared;
        connectionUri = shared.getConnectionUri();
        credentials = shared.getCredentials();
      } else {
        const container = new LocalstackContainer(DEFAULT_LOCALSTACK_IMAGE);
        startedContainer = await container.start();
        connectionUri = startedContainer.getConnectionUri();
        credentials = DEFAULT_CREDENTIALS;
      }
      const client = createDynamoDBClient(connectionUri, shared?.getRegion() ?? region, credentials);

      const keySchema = buildKeySchema(partitionKey, sortKey);
      const attributeDefinitions = buildAttributeDefinitions(partitionKey, sortKey);

      await client.send(
        new CreateTableCommand({
          TableName: resolvedOptions.tableName,
          KeySchema: keySchema,
          AttributeDefinitions: attributeDefinitions,
          BillingMode: 'PAY_PER_REQUEST',
        })
      );
      tableNameAfterStart = resolvedOptions.tableName ?? DEFAULT_TABLE_NAME;
      await waitForTableActive(client, tableNameAfterStart);

      const seedData = resolvedOptions.seedData;
      if (seedData && seedData.length > 0) {
        for (const item of seedData) {
          await client.send(
            new PutItemCommand({
              TableName: resolvedOptions.tableName,
              Item: marshall(item),
            })
          );
        }
      }
    },
    async reset(): Promise<void> {
      if (!tableNameAfterStart) {
        throw new Error('Preset not started; call start() first');
      }
      const connectionUri = startedContainer
        ? startedContainer.getConnectionUri()
        : sharedConnection!.getConnectionUri();
      const credentials = sharedConnection
        ? sharedConnection.getCredentials()
        : { ...DEFAULT_CREDENTIALS };
      const region = sharedConnection?.getRegion() ?? resolvedOptions.region ?? 'us-east-1';
      const client = createDynamoDBClient(connectionUri, region, credentials);
      await clearDynamoDBTable(
        client,
        tableNameAfterStart,
        partitionKey.name,
        sortKey?.name
      );
      for (const item of resolvedOptions.seedData ?? []) {
        await client.send(
          new PutItemCommand({
            TableName: tableNameAfterStart,
            Item: marshall(item),
          })
        );
      }
    },
    async stop(): Promise<void> {
      if (startedContainer) {
        await startedContainer.stop();
        startedContainer = null;
      }
      sharedConnection = null;
      tableNameAfterStart = null;
    },
    getTableName(): string {
      if (!tableNameAfterStart) {
        throw new Error('Preset not started; call start() first');
      }
      return tableNameAfterStart;
    },
    getConnectionUri(): string {
      if (startedContainer) return startedContainer.getConnectionUri();
      if (sharedConnection) return sharedConnection.getConnectionUri();
      throw new Error('Preset not started; call start() first');
    },
    getContainerId(): string {
      if (!startedContainer) {
        throw new Error('Preset does not own a container; call start() without shared connection first');
      }
      return startedContainer.getId();
    },
    getCredentials(): AwsPresetCredentials {
      if (sharedConnection) return sharedConnection.getCredentials();
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
