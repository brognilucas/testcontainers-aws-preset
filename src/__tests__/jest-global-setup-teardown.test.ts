import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createSqsPreset } from '../index';
import {
  createJestGlobalSetupTeardown,
  getConnectionConfigFromJestGlobalState,
} from '../jest/global-setup-teardown.js';

describe('Jest globalSetup / globalTeardown: suite-level container lifecycle', () => {
  it('createJestGlobalSetupTeardown returns globalSetup and globalTeardown functions', () => {
    const preset = createSqsPreset();
    const { globalSetup, globalTeardown } = createJestGlobalSetupTeardown(preset);
    expect(typeof globalSetup).toBe('function');
    expect(typeof globalTeardown).toBe('function');
  });

  it('getConnectionConfigFromJestGlobalState throws when state file does not exist', () => {
    expect(() =>
      getConnectionConfigFromJestGlobalState(path.join(os.tmpdir(), 'nonexistent-state.json'))
    ).toThrow(/ENOENT|no such file/);
  });
});

const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('Jest globalSetup and globalTeardown against live LocalStack', () => {
  it('globalSetup writes state file; getConnectionConfigFromJestGlobalState reads it; globalTeardown stops container', async () => {
    const preset = createSqsPreset({ queueName: 'jest-global-queue' });
    const statePath = path.join(os.tmpdir(), `jest-aws-preset-state-${Date.now()}.json`);
    const { globalSetup, globalTeardown } = createJestGlobalSetupTeardown(preset, {
      statePath,
    });
    await globalSetup();
    try {
      const config = getConnectionConfigFromJestGlobalState(statePath);
      expect(config.endpoint).toBeDefined();
      expect(config.region).toBeDefined();
      expect(config.credentials.accessKeyId).toBe('test');
    } finally {
      await globalTeardown();
      expect(fs.existsSync(statePath)).toBe(false);
    }
  }, 90_000);
});
