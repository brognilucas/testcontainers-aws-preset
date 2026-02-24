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

export interface AwsPresetCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface AwsPresetConnectionConfig {
  endpoint: string;
  credentials: AwsPresetCredentials;
  region: string;
}

export interface SharedConnection {
  getConnectionUri(): string;
  getCredentials(): AwsPresetCredentials;
  getRegion(): string;
}

export interface AwsPreset {
  /** Resolved options used to create this preset (read-only). */
  readonly options: AwsPresetOptions;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface LocalStackAwsPreset extends AwsPreset {
  getConnectionUri(): string;
  getCredentials(): AwsPresetCredentials;
  getConnectionConfig(): AwsPresetConnectionConfig;
  getContainerId(): string;
  start(sharedConnection?: SharedConnection): Promise<void>;
  reset(): Promise<void>;
}

import { validateAwsPresetOptions } from './lib/validate-options.js';

/**
 * Creates an AWS preset with zero manual configuration.
 * @param options - Optional preset configuration. All properties are optional.
 * @returns An AWS preset instance; call start() then stop() for lifecycle.
 */
export function createAwsPreset(options?: AwsPresetOptions): AwsPreset {
  validateAwsPresetOptions(options);
  const resolvedOptions: AwsPresetOptions = Object.freeze({ ...(options ?? {}) });
  return {
    get options(): AwsPresetOptions {
      return resolvedOptions;
    },
    async start(): Promise<void> {},
    async stop(): Promise<void> {},
  };
}

export { createSqsPreset } from './presets/sqs.js';
export type { SqsPresetOptions } from './presets/sqs.js';
export { createSnsSqsPreset } from './presets/sns-sqs.js';
export type { SnsSqsPresetOptions, SnsSqsPreset } from './presets/sns-sqs.js';
export { createEventBridgeSqsPreset } from './presets/eventbridge-sqs.js';
export type {
  EventBridgeSqsPresetOptions,
  EventBridgeSqsPreset,
  EventBridgeSeedEvent,
} from './presets/eventbridge-sqs.js';
export { createDynamoDBPreset } from './presets/dynamodb.js';
export type {
  DynamoDBPresetOptions,
  DynamoDBPreset,
  DynamoDBKeySchema,
  DynamoDBKeyType,
} from './presets/dynamodb.js';
export { createS3SqsPreset } from './presets/s3-sqs.js';
export type { S3SqsPresetOptions, S3SqsPreset, S3SeedObject } from './presets/s3-sqs.js';
export { createSecretsManagerPreset } from './presets/secrets-manager.js';
export type {
  SecretsManagerPresetOptions,
  SecretsManagerPreset,
  SeedSecret,
} from './presets/secrets-manager.js';
export { createSharedPreset } from './presets/shared.js';
export type { SharedPreset } from './presets/shared.js';
