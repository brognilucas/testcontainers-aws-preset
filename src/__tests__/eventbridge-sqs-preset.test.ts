/**
 * US-06: As a developer, I want a pre-configured EventBridge + SQS preset so that I can test
 * event-driven workflows without manually creating rules and targets.
 */
import {
  createEventBridgeSqsPreset,
  type EventBridgeSqsPresetOptions,
} from '../index';

describe('EventBridge + SQS preset: event-driven workflow with rule and target', () => {
  it('should return a LocalStack preset with start, stop, getConnectionUri, getCredentials, getRuleName, and options', () => {
    const preset = createEventBridgeSqsPreset();
    expect(preset).toBeDefined();
    expect(typeof preset.start).toBe('function');
    expect(typeof preset.stop).toBe('function');
    expect(typeof preset.getConnectionUri).toBe('function');
    expect(typeof preset.getCredentials).toBe('function');
    expect(typeof preset.getRuleName).toBe('function');
    expect(preset.options).toEqual({
      region: 'us-east-1',
      ruleName: 'test-rule',
      queueName: 'test-queue',
    });
  });

  it('should accept custom rule name, queue name, and region', () => {
    const options: EventBridgeSqsPresetOptions = {
      ruleName: 'my-rule',
      queueName: 'my-queue',
      region: 'eu-west-1',
    };
    const preset = createEventBridgeSqsPreset(options);
    expect(preset.options.ruleName).toBe('my-rule');
    expect(preset.options.queueName).toBe('my-queue');
    expect(preset.options.region).toBe('eu-west-1');
  });

  it('should throw when getConnectionUri is called before start', () => {
    const preset = createEventBridgeSqsPreset();
    expect(() => preset.getConnectionUri()).toThrow('Preset not started; call start() first');
  });

  it('should throw when getRuleName is called before start', () => {
    const preset = createEventBridgeSqsPreset();
    expect(() => preset.getRuleName()).toThrow('Preset not started; call start() first');
  });

  it('should throw when ruleName is empty string', () => {
    expect(() => createEventBridgeSqsPreset({ ruleName: '' })).toThrow(
      /ruleName must be a non-empty string when provided/
    );
  });

  it('should throw when queueName is empty string', () => {
    expect(() => createEventBridgeSqsPreset({ queueName: '' })).toThrow(
      /queueName must be a non-empty string when provided/
    );
  });
});
