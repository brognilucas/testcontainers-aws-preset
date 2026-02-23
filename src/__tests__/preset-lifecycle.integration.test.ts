import { createSqsPreset } from '../index';

const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('Preset lifecycle against live LocalStack', () => {
  it('start then stop leaves preset stopped so getConnectionUri throws', async () => {
    const preset = createSqsPreset({ queueName: 'lifecycle-test-queue' });
    await preset.start();
    expect(preset.getConnectionUri()).toBeDefined();
    await preset.stop();
    expect(() => preset.getConnectionUri()).toThrow('Preset not started; call start() first');
  }, 60_000);
});
