/**
 * testcontainers-aws-preset
 *
 * Public API: preset factory and types for AWS presets with zero manual configuration.
 */

export interface AwsPreset {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Creates an AWS preset with zero manual configuration.
 * @returns An AWS preset instance; call start() then stop() for lifecycle.
 */
export function createAwsPreset(): AwsPreset {
  return {
    async start(): Promise<void> {},
    async stop(): Promise<void> {},
  };
}
