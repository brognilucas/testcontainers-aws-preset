/**
 * testcontainers-aws-preset
 *
 * Public API: preset factory and types for AWS presets with zero manual configuration.
 */

/**
 * Configuration options for AWS presets.
 * All properties are optional; use these to tailor the environment without reading the docs.
 */
export interface AwsPresetOptions {
  /**
   * AWS region for the preset environment (e.g. LocalStack).
   * @example 'us-east-1'
   */
  region?: string;
}

export interface AwsPreset {
  /** Resolved options used to create this preset (read-only). */
  readonly options: AwsPresetOptions;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Creates an AWS preset with zero manual configuration.
 * @param options - Optional preset configuration. All properties are optional.
 * @returns An AWS preset instance; call start() then stop() for lifecycle.
 */
export function createAwsPreset(options?: AwsPresetOptions): AwsPreset {
  const resolvedOptions: AwsPresetOptions = Object.freeze({ ...(options ?? {}) });
  return {
    get options(): AwsPresetOptions {
      return resolvedOptions;
    },
    async start(): Promise<void> {},
    async stop(): Promise<void> {},
  };
}
