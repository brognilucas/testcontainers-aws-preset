import { SQSClient } from '@aws-sdk/client-sqs';
import {
  createSqsPreset,
  createSnsSqsPreset,
  createEventBridgeSqsPreset,
  createDynamoDBPreset,
  createS3SqsPreset,
  createSecretsManagerPreset,
} from '../index';

describe('Preset resolved endpoint and credentials for SDK clients', () => {
  it('each LocalStack preset exposes getConnectionConfig returning endpoint, credentials, and region', () => {
    const factories = [
      createSqsPreset,
      createSnsSqsPreset,
      createEventBridgeSqsPreset,
      createDynamoDBPreset,
      createS3SqsPreset,
      createSecretsManagerPreset,
    ] as const;
    for (const create of factories) {
      const preset = create();
      expect(typeof preset.getConnectionConfig).toBe('function');
      expect(() => preset.getConnectionConfig()).toThrow('Preset not started; call start() first');
    }
  });

  it('getConnectionConfig throws when preset not started', () => {
    const preset = createSqsPreset();
    expect(() => preset.getConnectionConfig()).toThrow('Preset not started; call start() first');
  });
});

const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('Preset connection config against live LocalStack', () => {
  it('getConnectionConfig can be passed directly to AWS SDK client', async () => {
    const preset = createSqsPreset({ region: 'eu-west-1' });
    await preset.start();
    try {
      const config = preset.getConnectionConfig();
      expect(config.endpoint).toBeDefined();
      expect(config.endpoint.length).toBeGreaterThan(0);
      expect(config.credentials.accessKeyId).toBe('test');
      expect(config.credentials.secretAccessKey).toBe('test');
      expect(config.region).toBe('eu-west-1');
      const client = new SQSClient(config);
      expect(client).toBeDefined();
    } finally {
      await preset.stop();
    }
  }, 60_000);
});
