import {
  CreateSecretCommand,
  DeleteSecretCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { LocalstackContainer } from '@testcontainers/localstack';
import type { AwsPresetCredentials, AwsPresetOptions, LocalStackAwsPreset, SharedConnection } from '../index.js';
import { validateAwsPresetOptions } from '../lib/validate-options.js';

const DEFAULT_LOCALSTACK_IMAGE = 'localstack/localstack:3.0';
const DEFAULT_CREDENTIALS: AwsPresetCredentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test',
};

export interface SeedSecret {
  name: string;
  secretString: string;
}

export interface SecretsManagerPresetOptions extends AwsPresetOptions {
  seedSecrets?: SeedSecret[];
}

export interface SecretsManagerPreset extends LocalStackAwsPreset {}

function validateSecretsManagerPresetOptions(
  options: unknown
): asserts options is SecretsManagerPresetOptions {
  validateAwsPresetOptions(options);
  const opts = options as SecretsManagerPresetOptions;
  if (opts !== undefined && 'seedSecrets' in opts && opts.seedSecrets !== undefined) {
    if (!Array.isArray(opts.seedSecrets)) {
      throw new Error('seedSecrets must be an array when provided');
    }
    for (let i = 0; i < opts.seedSecrets.length; i++) {
      const entry = opts.seedSecrets[i];
      if (typeof entry !== 'object' || entry === null) {
        throw new Error(`seedSecrets[${i}] must be { name: string, secretString: string }`);
      }
      if (typeof entry.name !== 'string' || entry.name.trim() === '') {
        throw new Error(`seedSecrets[${i}].name must be a non-empty string`);
      }
      if (typeof entry.secretString !== 'string') {
        throw new Error(`seedSecrets[${i}].secretString must be a string`);
      }
    }
  }
}

function createSecretsManagerClient(
  connectionUri: string,
  region: string,
  credentials: AwsPresetCredentials
): SecretsManagerClient {
  return new SecretsManagerClient({
    endpoint: connectionUri,
    region,
    credentials,
  });
}

export function createSecretsManagerPreset(
  options?: SecretsManagerPresetOptions
): SecretsManagerPreset {
  validateSecretsManagerPresetOptions(options);
  const resolvedOptions: SecretsManagerPresetOptions = Object.freeze({
    region: 'us-east-1',
    ...(options ?? {}),
    seedSecrets: options?.seedSecrets ?? [],
  });

  let startedContainer: Awaited<ReturnType<LocalstackContainer['start']>> | null = null;
  let sharedConnection: SharedConnection | null = null;

  return {
    get options(): SecretsManagerPresetOptions {
      return resolvedOptions;
    },
    async start(shared?: SharedConnection): Promise<void> {
      const region = resolvedOptions.region ?? 'us-east-1';
      let connectionUri: string;
      let credentials: AwsPresetCredentials;
      if (shared) {
        sharedConnection = shared;
        connectionUri = shared.getConnectionUri();
        credentials = shared.getCredentials();
      } else {
        const container = new LocalstackContainer(DEFAULT_LOCALSTACK_IMAGE);
        startedContainer = await container.start();
        connectionUri = startedContainer.getConnectionUri();
        credentials = DEFAULT_CREDENTIALS;
      }
      const client = createSecretsManagerClient(
        connectionUri,
        shared?.getRegion() ?? region,
        credentials
      );
      for (const seed of resolvedOptions.seedSecrets ?? []) {
        await client.send(
          new CreateSecretCommand({
            Name: seed.name,
            SecretString: seed.secretString,
          })
        );
      }
    },
    async reset(): Promise<void> {
      const connectionUri = startedContainer
        ? startedContainer.getConnectionUri()
        : sharedConnection?.getConnectionUri();
      if (!connectionUri) {
        throw new Error('Preset not started; call start() first');
      }
      const region = sharedConnection?.getRegion() ?? resolvedOptions.region ?? 'us-east-1';
      const credentials = sharedConnection
        ? sharedConnection.getCredentials()
        : { ...DEFAULT_CREDENTIALS };
      const client = createSecretsManagerClient(connectionUri, region, credentials);
      for (const seed of resolvedOptions.seedSecrets ?? []) {
        try {
          await client.send(
            new DeleteSecretCommand({
              SecretId: seed.name,
              ForceDeleteWithoutRecovery: true,
            })
          );
        } catch (error: unknown) {
          if ((error as { name?: string }).name !== 'ResourceNotFoundException') throw error;
        }
        await client.send(
          new CreateSecretCommand({
            Name: seed.name,
            SecretString: seed.secretString,
          })
        );
      }
    },
    async stop(): Promise<void> {
      if (startedContainer) {
        await startedContainer.stop();
        startedContainer = null;
      }
      sharedConnection = null;
    },
    getConnectionUri(): string {
      if (startedContainer) return startedContainer.getConnectionUri();
      if (sharedConnection) return sharedConnection.getConnectionUri();
      throw new Error('Preset not started; call start() first');
    },
    getContainerId(): string {
      if (!startedContainer) {
        throw new Error('Preset does not own a container; call start() without shared connection first');
      }
      return startedContainer.getId();
    },
    getCredentials(): AwsPresetCredentials {
      if (sharedConnection) return sharedConnection.getCredentials();
      return { ...DEFAULT_CREDENTIALS };
    },
    getConnectionConfig() {
      return {
        endpoint: this.getConnectionUri(),
        credentials: this.getCredentials(),
        region: resolvedOptions.region ?? 'us-east-1',
      };
    },
  };
}
