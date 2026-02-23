/**
 * US-05: As a developer, I want a pre-configured SNS + SQS preset with a subscription
 * already wired so that I can test pub/sub flows out of the box.
 */
import { createSnsSqsPreset, type SnsSqsPresetOptions } from '../index';

describe('SNS + SQS preset: pub/sub with subscription wired', () => {
  it('should return a LocalStack preset with start, stop, getConnectionUri, getCredentials, and options', () => {
    const preset = createSnsSqsPreset();
    expect(preset).toBeDefined();
    expect(typeof preset.start).toBe('function');
    expect(typeof preset.stop).toBe('function');
    expect(typeof preset.getConnectionUri).toBe('function');
    expect(typeof preset.getCredentials).toBe('function');
    expect(preset.options).toEqual({
      region: 'us-east-1',
      topicName: 'test-topic',
      queueName: 'test-queue',
      seedMessages: [],
    });
  });

  it('should accept custom topic name, queue name, and region', () => {
    const options: SnsSqsPresetOptions = {
      topicName: 'my-topic',
      queueName: 'my-queue',
      region: 'eu-west-1',
    };
    const preset = createSnsSqsPreset(options);
    expect(preset.options.topicName).toBe('my-topic');
    expect(preset.options.queueName).toBe('my-queue');
    expect(preset.options.region).toBe('eu-west-1');
  });

  it('should return credentials before start', () => {
    const preset = createSnsSqsPreset();
    const credentials = preset.getCredentials();
    expect(credentials.accessKeyId).toBe('test');
    expect(credentials.secretAccessKey).toBe('test');
  });

  it('should throw when getConnectionUri is called before start', () => {
    const preset = createSnsSqsPreset();
    expect(() => preset.getConnectionUri()).toThrow('Preset not started; call start() first');
  });

  it('should throw when topicName is empty string', () => {
    expect(() => createSnsSqsPreset({ topicName: '' })).toThrow(
      /topicName must be a non-empty string when provided/
    );
  });

  it('should throw when queueName is empty string', () => {
    expect(() => createSnsSqsPreset({ queueName: '' })).toThrow(
      /queueName must be a non-empty string when provided/
    );
  });

  it('accepts seedMessages in options', () => {
    const preset = createSnsSqsPreset({ seedMessages: ['event1'] });
    expect(preset.options.seedMessages).toEqual(['event1']);
  });

  it('throws when seedMessages is not an array', () => {
    expect(() =>
      createSnsSqsPreset({ seedMessages: 'not-array' as unknown as string[] })
    ).toThrow('seedMessages must be an array when provided');
  });
});
