import { LocalstackContainer } from '@testcontainers/localstack';
import type {
  AwsPresetCredentials,
  AwsPresetOptions,
  LocalStackAwsPreset,
  SharedConnection,
} from '../index.js';
import { validateAwsPresetOptions } from '../lib/validate-options.js';

const DEFAULT_LOCALSTACK_IMAGE = 'localstack/localstack:3.0';
const DEFAULT_CREDENTIALS: AwsPresetCredentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test',
};

export interface MyServicePresetOptions extends AwsPresetOptions {
  resourceName?: string;
  seedData?: string[];
}

export interface MyServicePreset extends LocalStackAwsPreset {}

function validateMyServicePresetOptions(
  options: unknown
): asserts options is MyServicePresetOptions {
  validateAwsPresetOptions(options);
  const opts = options as MyServicePresetOptions;
  if (opts !== undefined && 'resourceName' in opts && opts.resourceName !== undefined) {
    if (typeof opts.resourceName !== 'string' || opts.resourceName.trim() === '') {
      throw new Error(
        `resourceName must be a non-empty string when provided, got: ${typeof opts.resourceName}`
      );
    }
  }
  if (opts !== undefined && 'seedData' in opts && opts.seedData !== undefined) {
    if (!Array.isArray(opts.seedData)) {
      throw new Error('seedData must be an array when provided');
    }
  }
}

export function createMyServicePreset(
  options?: MyServicePresetOptions
): MyServicePreset {
  validateMyServicePresetOptions(options);
  const resolvedOptions: MyServicePresetOptions = Object.freeze({
    region: 'us-east-1',
    ...(options ?? {}),
    resourceName: options?.resourceName?.trim() || 'my-resource',
    seedData: options?.seedData ?? [],
  });

  let startedContainer: Awaited<ReturnType<LocalstackContainer['start']>> | null =
    null;
  let sharedConnection: SharedConnection | null = null;

  return {
    get options(): MyServicePresetOptions {
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
      // TODO: create AWS client for your service and create resource(s)
      // TODO: apply resolvedOptions.seedData if applicable
    },
    async reset(): Promise<void> {
      const connectionUri = startedContainer
        ? startedContainer.getConnectionUri()
        : sharedConnection?.getConnectionUri();
      if (!connectionUri) {
        throw new Error('Preset not started; call start() first');
      }
      const region =
        sharedConnection?.getRegion() ?? resolvedOptions.region ?? 'us-east-1';
      const credentials = sharedConnection
        ? sharedConnection.getCredentials()
        : { ...DEFAULT_CREDENTIALS };
      // TODO: restore environment to initial seed state (e.g. clear + re-apply seedData)
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
        throw new Error(
          'Preset does not own a container; call start() without shared connection first'
        );
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
