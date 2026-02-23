/**
 * US-02: As a developer, I want TypeScript types and autocompletion for all preset options
 * so that I can configure environments without reading the docs every time.
 */
import { createAwsPreset, type AwsPresetOptions } from '../index';

describe('Preset options: TypeScript types and autocompletion', () => {
  it('should create preset with valid options and preserve them', () => {
    const options: AwsPresetOptions = { region: 'us-east-1' };
    const preset = createAwsPreset(options);
    expect(preset).toBeDefined();
    expect(preset.options).toEqual({ region: 'us-east-1' });
    expect(preset.options.region).toBe('us-east-1');
  });

  it('should create preset with no arguments (backward compatibility with US-01)', () => {
    const preset = createAwsPreset();
    expect(preset).toBeDefined();
    expect(preset.options).toEqual({});
    expect(typeof preset.start).toBe('function');
    expect(typeof preset.stop).toBe('function');
  });

  it('should create preset with empty options object', () => {
    const preset = createAwsPreset({});
    expect(preset.options).toEqual({});
  });
});
