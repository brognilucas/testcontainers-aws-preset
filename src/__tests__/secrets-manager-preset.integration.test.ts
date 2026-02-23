import {
  CreateSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { createSecretsManagerPreset } from '../index';

const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('Secrets Manager preset against live LocalStack', () => {
  it('retrieves secret value after preset creates seed secrets', async () => {
    const preset = createSecretsManagerPreset({
      region: 'us-east-1',
      seedSecrets: [
        { name: 'integration-db-password', secretString: 'my-secret-password' },
      ],
    });
    await preset.start();
    try {
      const connectionUri = preset.getConnectionUri();
      const credentials = preset.getCredentials();
      const region = preset.options.region ?? 'us-east-1';
      const client = new SecretsManagerClient({
        endpoint: connectionUri,
        region,
        credentials,
      });

      const response = await client.send(
        new GetSecretValueCommand({ SecretId: 'integration-db-password' })
      );
      expect(response.SecretString).toBe('my-secret-password');
    } finally {
      await preset.stop();
    }
  }, 60_000);

  it('retrieves secret created via SDK when no seed secrets', async () => {
    const preset = createSecretsManagerPreset();
    await preset.start();
    try {
      const connectionUri = preset.getConnectionUri();
      const credentials = preset.getCredentials();
      const region = preset.options.region ?? 'us-east-1';
      const client = new SecretsManagerClient({
        endpoint: connectionUri,
        region,
        credentials,
      });

      await client.send(
        new CreateSecretCommand({
          Name: 'sdk-created-secret',
          SecretString: 'created-in-test',
        })
      );

      const response = await client.send(
        new GetSecretValueCommand({ SecretId: 'sdk-created-secret' })
      );
      expect(response.SecretString).toBe('created-in-test');
    } finally {
      await preset.stop();
    }
  }, 60_000);
});
