import {
  createAwsPreset,
  createSqsPreset,
  createSnsSqsPreset,
  createEventBridgeSqsPreset,
  createDynamoDBPreset,
  createS3SqsPreset,
  createSecretsManagerPreset,
} from '../index';

describe('Preset lifecycle: start and stop for setup and teardown hooks', () => {
  it('each preset exposes start() and stop()', () => {
    const factories = [
      createAwsPreset,
      createSqsPreset,
      createSnsSqsPreset,
      createEventBridgeSqsPreset,
      createDynamoDBPreset,
      createS3SqsPreset,
      createSecretsManagerPreset,
    ] as const;
    for (const create of factories) {
      const preset = create();
      expect(typeof preset.start).toBe('function');
      expect(typeof preset.stop).toBe('function');
      expect(preset.options).toBeDefined();
    }
  });

  it('base preset start and stop are no-ops and can be called in order', async () => {
    const preset = createAwsPreset();
    await preset.start();
    await preset.stop();
  });
});
