import type { AwsPresetOptions } from '../index.js';

export function validateAwsPresetOptions(options: unknown): asserts options is AwsPresetOptions {
  const hasInvalidOptionsType =
    options !== undefined &&
    (typeof options !== 'object' || options === null || Array.isArray(options));
  if (hasInvalidOptionsType) {
    const got =
      options === null ? 'null' : Array.isArray(options) ? 'array' : typeof options;
    throw new Error(`options must be an object or undefined, got: ${got}`);
  }
  const opts = options as AwsPresetOptions;
  if (opts !== undefined && 'region' in opts && opts.region !== undefined) {
    if (typeof opts.region !== 'string' || opts.region.trim() === '') {
      throw new Error(`region must be a non-empty string when provided, got: ${typeof opts.region}`);
    }
  }
}
