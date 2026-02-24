import { createSecretsManagerPreset, type SecretsManagerPresetOptions } from '../index';

describe('Secrets Manager preset: pre-configured secrets without mocking AWS SDK', () => {
  it('returns a LocalStack preset with start, stop, getConnectionUri, getCredentials, and options', () => {
    const preset = createSecretsManagerPreset();
    expect(preset).toBeDefined();
    expect(typeof preset.start).toBe('function');
    expect(typeof preset.stop).toBe('function');
    expect(typeof preset.reset).toBe('function');
    expect(typeof preset.getConnectionUri).toBe('function');
    expect(typeof preset.getCredentials).toBe('function');
    expect(preset.options).toEqual({
      region: 'us-east-1',
      seedSecrets: [],
    });
  });

  it('accepts custom region', () => {
    const options: SecretsManagerPresetOptions = { region: 'eu-west-1' };
    const preset = createSecretsManagerPreset(options);
    expect(preset.options.region).toBe('eu-west-1');
  });

  it('throws when getConnectionUri is called before start', () => {
    const preset = createSecretsManagerPreset();
    expect(() => preset.getConnectionUri()).toThrow('Preset not started; call start() first');
  });

  it('throws when seedSecrets entry has empty name', () => {
    expect(() =>
      createSecretsManagerPreset({
        seedSecrets: [{ name: '', secretString: 'x' }],
      })
    ).toThrow(/seedSecrets\[0\]\.name must be a non-empty string/);
  });

  it('throws when seedSecrets is not an array', () => {
    expect(() =>
      createSecretsManagerPreset({ seedSecrets: 'not-array' as unknown as [] })
    ).toThrow('seedSecrets must be an array when provided');
  });
});
