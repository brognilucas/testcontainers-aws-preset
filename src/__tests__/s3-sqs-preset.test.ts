/**
 * S3 + SQS notification preset: file upload triggers and downstream queue.
 */
import { createS3SqsPreset, type S3SqsPresetOptions } from '../index';

describe('S3 + SQS preset: file upload triggers and downstream queue', () => {
  it('should return a LocalStack preset with start, stop, getConnectionUri, getCredentials, getBucketName, and options', () => {
    const preset = createS3SqsPreset();
    expect(preset).toBeDefined();
    expect(typeof preset.start).toBe('function');
    expect(typeof preset.stop).toBe('function');
    expect(typeof preset.getConnectionUri).toBe('function');
    expect(typeof preset.getCredentials).toBe('function');
    expect(typeof preset.getBucketName).toBe('function');
    expect(preset.options).toEqual({
      region: 'us-east-1',
      bucketName: 'test-bucket',
      queueName: 'test-queue',
    });
  });

  it('should accept custom bucket name, queue name, and region', () => {
    const options: S3SqsPresetOptions = {
      bucketName: 'my-bucket',
      queueName: 'my-queue',
      region: 'eu-west-1',
    };
    const preset = createS3SqsPreset(options);
    expect(preset.options.bucketName).toBe('my-bucket');
    expect(preset.options.queueName).toBe('my-queue');
    expect(preset.options.region).toBe('eu-west-1');
  });

  it('should throw when getConnectionUri is called before start', () => {
    const preset = createS3SqsPreset();
    expect(() => preset.getConnectionUri()).toThrow('Preset not started; call start() first');
  });

  it('should throw when getBucketName is called before start', () => {
    const preset = createS3SqsPreset();
    expect(() => preset.getBucketName()).toThrow('Preset not started; call start() first');
  });

  it('should throw when bucketName is empty string', () => {
    expect(() => createS3SqsPreset({ bucketName: '' })).toThrow(
      /bucketName must be a non-empty string when provided/
    );
  });

  it('should throw when queueName is empty string', () => {
    expect(() => createS3SqsPreset({ queueName: '' })).toThrow(
      /queueName must be a non-empty string when provided/
    );
  });
});
