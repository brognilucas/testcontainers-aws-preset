import {
  createSqsPreset,
  createDynamoDBPreset,
  createSharedPreset,
} from '../index';

describe('Shared preset: single container for multiple presets', () => {
  it('throws when no presets provided', () => {
    expect(() => createSharedPreset({})).toThrow(
      'createSharedPreset requires at least one preset'
    );
  });

  it('exposes start, stop, getConnectionUri, getCredentials, getConnectionConfig, and presets', () => {
    const shared = createSharedPreset({
      sqs: createSqsPreset(),
      dynamodb: createDynamoDBPreset(),
    });
    expect(typeof shared.start).toBe('function');
    expect(typeof shared.stop).toBe('function');
    expect(typeof shared.getConnectionUri).toBe('function');
    expect(typeof shared.getCredentials).toBe('function');
    expect(typeof shared.getConnectionConfig).toBe('function');
    expect(shared.presets.sqs).toBeDefined();
    expect(shared.presets.dynamodb).toBeDefined();
  });

  it('getConnectionUri throws before start', () => {
    const shared = createSharedPreset({ sqs: createSqsPreset() });
    expect(() => shared.getConnectionUri()).toThrow('Preset not started; call start() first');
  });
});

const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('Shared preset against live LocalStack', () => {
  it('single preset in shared starts and stops', async () => {
    const shared = createSharedPreset({ sqs: createSqsPreset({ queueName: 'shared-single' }) });
    await shared.start();
    try {
      expect(shared.getConnectionUri()).toBeDefined();
      expect(shared.presets.sqs.getConnectionUri()).toBe(shared.getConnectionUri());
    } finally {
      await shared.stop();
    }
  }, 60_000);

  it('multiple presets share same connection after start', async () => {
    const shared = createSharedPreset({
      sqs: createSqsPreset({ queueName: 'shared-queue' }),
      dynamodb: createDynamoDBPreset({ tableName: 'shared-table' }),
    });
    await shared.start();
    try {
      const uriFromSqs = shared.presets.sqs.getConnectionUri();
      const uriFromDynamo = shared.presets.dynamodb.getConnectionUri();
      expect(uriFromSqs).toBe(uriFromDynamo);
      expect(uriFromSqs).toBe(shared.getConnectionUri());
    } finally {
      await shared.stop();
    }
  }, 90_000);
});
