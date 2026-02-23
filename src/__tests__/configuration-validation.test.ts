/**
 * US-03: As a developer, I want the library to validate my configuration at startup
 * and give clear error messages so that I don't spend time debugging cryptic container errors.
 */
import { createAwsPreset } from '../index';

describe('Validating preset configuration at startup', () => {
  it('should accept undefined options', () => {
    expect(() => createAwsPreset(undefined)).not.toThrow();
    expect(createAwsPreset().options).toEqual({});
  });

  it('should accept empty object options', () => {
    expect(() => createAwsPreset({})).not.toThrow();
  });

  it('should accept valid region string', () => {
    expect(() => createAwsPreset({ region: 'us-east-1' })).not.toThrow();
    expect(createAwsPreset({ region: 'eu-west-1' }).options.region).toBe('eu-west-1');
  });

  it('should throw clear error when options is null', () => {
    expect(() => createAwsPreset(null as unknown as undefined)).toThrow(
      /options must be an object or undefined/
    );
  });

  it('should throw clear error when options is not an object', () => {
    expect(() => createAwsPreset('invalid' as unknown as object)).toThrow(
      /options must be an object or undefined/
    );
    expect(() => createAwsPreset(42 as unknown as object)).toThrow(
      /options must be an object or undefined/
    );
    expect(() => createAwsPreset([] as unknown as object)).toThrow(
      /options must be an object or undefined/
    );
  });

  it('should throw clear error when region is not a string', () => {
    expect(() => createAwsPreset({ region: 123 as unknown as string })).toThrow(
      /region must be a non-empty string when provided/
    );
  });

  it('should throw clear error when region is empty string', () => {
    expect(() => createAwsPreset({ region: '' })).toThrow(
      /region must be a non-empty string when provided/
    );
  });
});
