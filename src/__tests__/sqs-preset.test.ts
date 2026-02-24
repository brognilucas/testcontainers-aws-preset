/**
 * US-04: As a developer, I want a pre-configured SQS preset so that I can test
 * queue producers and consumers without manually setting up LocalStack, ports, and health checks.
 */
import { createSqsPreset, type SqsPresetOptions } from '../index';

describe('SQS preset: pre-configured queue without manual LocalStack setup', () => {
  it('should return a LocalStack preset with start, stop, reset, getConnectionUri, getCredentials, and options', () => {
    const preset = createSqsPreset();
    expect(preset).toBeDefined();
    expect(typeof preset.start).toBe('function');
    expect(typeof preset.stop).toBe('function');
    expect(typeof preset.reset).toBe('function');
    expect(typeof preset.getConnectionUri).toBe('function');
    expect(typeof preset.getCredentials).toBe('function');
    expect(preset.options).toEqual({
      region: 'us-east-1',
      queueName: 'test-queue',
      seedMessages: [],
    });
  });

  it('should accept custom queue name and region', () => {
    const options: SqsPresetOptions = { queueName: 'my-queue', region: 'eu-west-1' };
    const preset = createSqsPreset(options);
    expect(preset.options.queueName).toBe('my-queue');
    expect(preset.options.region).toBe('eu-west-1');
  });

  it('should return credentials before start', () => {
    const preset = createSqsPreset();
    const credentials = preset.getCredentials();
    expect(credentials.accessKeyId).toBe('test');
    expect(credentials.secretAccessKey).toBe('test');
  });

  it('should throw when getConnectionUri is called before start', () => {
    const preset = createSqsPreset();
    expect(() => preset.getConnectionUri()).toThrow('Preset not started; call start() first');
  });

  it('should throw when reset is called before start', async () => {
    const preset = createSqsPreset();
    await expect(preset.reset()).rejects.toThrow('Preset not started; call start() first');
  });

  it('should throw when queueName is empty string', () => {
    expect(() => createSqsPreset({ queueName: '' })).toThrow(
      /queueName must be a non-empty string when provided/
    );
  });

  it('should throw when queueName is not a string', () => {
    expect(() => createSqsPreset({ queueName: 123 as unknown as string })).toThrow(
      /queueName must be a non-empty string when provided/
    );
  });

  it('accepts seedMessages in options', () => {
    const preset = createSqsPreset({ seedMessages: ['msg1', 'msg2'] });
    expect(preset.options.seedMessages).toEqual(['msg1', 'msg2']);
  });

  it('throws when seedMessages is not an array', () => {
    expect(() =>
      createSqsPreset({ seedMessages: 'not-array' as unknown as string[] })
    ).toThrow('seedMessages must be an array when provided');
  });
});
