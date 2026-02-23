/**
 * Jest globalSetup / globalTeardown helpers so container lifecycle is managed at the suite level.
 *
 * In jest.config.js set globalSetup and globalTeardown to a module that exports the functions:
 *
 *   const { createSqsPreset } = require('testcontainers-aws-preset');
 *   const { createJestGlobalSetupTeardown } = require('testcontainers-aws-preset/jest');
 *   const { globalSetup, globalTeardown } = createJestGlobalSetupTeardown(createSqsPreset());
 *   module.exports = { globalSetup, globalTeardown };
 *
 * In tests, use getConnectionConfigFromJestGlobalState() to build AWS SDK clients.
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AwsPresetConnectionConfig, LocalStackAwsPreset } from '../index.js';

const DEFAULT_STATE_FILENAME = '.jest-aws-preset-state.json';

export interface JestGlobalSetupTeardownOptions {
  statePath?: string;
}

export interface JestPresetState {
  connectionConfig: AwsPresetConnectionConfig;
  containerId: string;
}

function resolveStatePath(options?: JestGlobalSetupTeardownOptions): string {
  const statePath = options?.statePath ?? path.join(process.cwd(), DEFAULT_STATE_FILENAME);
  return path.isAbsolute(statePath) ? statePath : path.join(process.cwd(), statePath);
}

export function createJestGlobalSetupTeardown(
  preset: LocalStackAwsPreset,
  options?: JestGlobalSetupTeardownOptions
): {
  globalSetup: () => Promise<void>;
  globalTeardown: () => Promise<void>;
} {
  const statePath = resolveStatePath(options);

  return {
    async globalSetup(): Promise<void> {
      await preset.start();
      const connectionConfig = preset.getConnectionConfig();
      const containerId = preset.getContainerId();
      const state: JestPresetState = { connectionConfig, containerId };
      await fs.promises.writeFile(statePath, JSON.stringify(state), 'utf-8');
    },

    async globalTeardown(): Promise<void> {
      try {
        const raw = await fs.promises.readFile(statePath, 'utf-8');
        const state = JSON.parse(raw) as JestPresetState;
        if (state.containerId) {
          execSync(`docker stop ${state.containerId}`, { stdio: 'inherit' });
        }
      } finally {
        try {
          await fs.promises.unlink(statePath);
        } catch {
          // ignore if already removed
        }
      }
    },
  };
}

export function getConnectionConfigFromJestGlobalState(
  statePath?: string
): AwsPresetConnectionConfig {
  const resolved = statePath
    ? path.isAbsolute(statePath)
      ? statePath
      : path.join(process.cwd(), statePath)
    : path.join(process.cwd(), DEFAULT_STATE_FILENAME);
  const raw = fs.readFileSync(resolved, 'utf-8');
  const state = JSON.parse(raw) as JestPresetState;
  return state.connectionConfig;
}
