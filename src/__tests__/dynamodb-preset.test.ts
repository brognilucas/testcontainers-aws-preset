/**
 * US-07: As a developer, I want a pre-configured DynamoDB preset with optional seed data
 * so that I can test data access patterns against a real schema.
 */
import {
  createDynamoDBPreset,
  type DynamoDBPresetOptions,
} from '../index';

describe('DynamoDB preset: table with optional seed data', () => {
  it('should return a LocalStack preset with start, stop, getConnectionUri, getCredentials, getTableName, and options', () => {
    const preset = createDynamoDBPreset();
    expect(preset).toBeDefined();
    expect(typeof preset.start).toBe('function');
    expect(typeof preset.stop).toBe('function');
    expect(typeof preset.getConnectionUri).toBe('function');
    expect(typeof preset.getCredentials).toBe('function');
    expect(typeof preset.getTableName).toBe('function');
    expect(preset.options.tableName).toBe('test-table');
    expect(preset.options.partitionKey).toEqual({ name: 'id', type: 'S' });
    expect(preset.options.seedData).toEqual([]);
  });

  it('should accept custom table name, partition key, and region', () => {
    const options: DynamoDBPresetOptions = {
      tableName: 'my-table',
      partitionKey: { name: 'pk', type: 'S' },
      region: 'eu-west-1',
    };
    const preset = createDynamoDBPreset(options);
    expect(preset.options.tableName).toBe('my-table');
    expect(preset.options.partitionKey).toEqual({ name: 'pk', type: 'S' });
    expect(preset.options.region).toBe('eu-west-1');
  });

  it('should accept sort key and optional seed data', () => {
    const options: DynamoDBPresetOptions = {
      tableName: 'orders',
      partitionKey: { name: 'customerId', type: 'S' },
      sortKey: { name: 'orderId', type: 'N' },
      seedData: [{ customerId: 'c1', orderId: 1, total: 99 }],
    };
    const preset = createDynamoDBPreset(options);
    expect(preset.options.sortKey).toEqual({ name: 'orderId', type: 'N' });
    expect(preset.options.seedData).toHaveLength(1);
    expect(preset.options.seedData![0]).toEqual({ customerId: 'c1', orderId: 1, total: 99 });
  });

  it('should throw when getConnectionUri is called before start', () => {
    const preset = createDynamoDBPreset();
    expect(() => preset.getConnectionUri()).toThrow('Preset not started; call start() first');
  });

  it('should throw when getTableName is called before start', () => {
    const preset = createDynamoDBPreset();
    expect(() => preset.getTableName()).toThrow('Preset not started; call start() first');
  });

  it('should throw when tableName is empty string', () => {
    expect(() => createDynamoDBPreset({ tableName: '' })).toThrow(
      /tableName must be a non-empty string when provided/
    );
  });

  it('should throw when partitionKey has invalid type', () => {
    expect(() =>
      createDynamoDBPreset({ partitionKey: { name: 'id', type: 'X' as 'S' } })
    ).toThrow(/partitionKey.type must be S, N, or B/);
  });

  it('should throw when seedData is not an array', () => {
    expect(() =>
      createDynamoDBPreset({ seedData: 'not-array' as unknown as Record<string, unknown>[] })
    ).toThrow(/seedData must be an array when provided/);
  });
});
