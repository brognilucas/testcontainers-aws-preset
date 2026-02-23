/**
 * US-01: As a developer, I want to install the library via npm/yarn
 * so that I can start using AWS presets with zero manual configuration.
 */
import { createAwsPreset } from '../index';

describe('Installing the library and using a preset with zero configuration', () => {
  it('should export a preset factory usable with zero manual configuration', () => {
    const preset = createAwsPreset();
    expect(preset).toBeDefined();
    expect(typeof preset.start).toBe('function');
    expect(typeof preset.stop).toBe('function');
  });

  it('should create preset without any arguments', () => {
    expect(() => createAwsPreset()).not.toThrow();
  });
});
