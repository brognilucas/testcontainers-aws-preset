import type {
  AwsPresetConnectionConfig,
  AwsPresetCredentials,
  LocalStackAwsPreset,
  SharedConnection,
} from '../index.js';

export interface SharedPreset<T extends Record<string, LocalStackAwsPreset>> extends LocalStackAwsPreset {
  presets: T;
}

function toSharedConnection(preset: LocalStackAwsPreset): SharedConnection {
  return {
    getConnectionUri: () => preset.getConnectionUri(),
    getCredentials: () => preset.getCredentials(),
    getRegion: () => preset.options.region?.trim() ? preset.options.region! : 'us-east-1',
  };
}

export function createSharedPreset<T extends Record<string, LocalStackAwsPreset>>(
  presets: T
): SharedPreset<T> {
  const entries = Object.entries(presets);
  if (entries.length === 0) {
    throw new Error('createSharedPreset requires at least one preset');
  }
  const [, firstPreset] = entries[0];
  const rest = entries.slice(1);

  return {
    get options() {
      return firstPreset.options;
    },
    async start(): Promise<void> {
      await firstPreset.start();
      const connection = toSharedConnection(firstPreset);
      for (const [, preset] of rest) {
        await preset.start(connection);
      }
    },
    async stop(): Promise<void> {
      await firstPreset.stop();
    },
    async reset(): Promise<void> {
      for (const [, preset] of entries) {
        await preset.reset();
      }
    },
    getConnectionUri(): string {
      return firstPreset.getConnectionUri();
    },
    getContainerId(): string {
      return firstPreset.getContainerId();
    },
    getCredentials(): AwsPresetCredentials {
      return firstPreset.getCredentials();
    },
    getConnectionConfig(): AwsPresetConnectionConfig {
      return firstPreset.getConnectionConfig();
    },
    presets,
  } as SharedPreset<T>;
}
