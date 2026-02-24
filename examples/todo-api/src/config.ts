function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export interface AppConfig {
  dynamodbEndpoint: string;
  sqsEndpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  tableName: string;
  queueUrl: string;
  port: number;
}

export function loadConfig(): AppConfig {
  return {
    dynamodbEndpoint: requireEnv('AWS_ENDPOINT'),
    sqsEndpoint: requireEnv('AWS_ENDPOINT'),
    region: requireEnv('AWS_REGION'),
    accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    tableName: requireEnv('TABLE_NAME'),
    queueUrl: requireEnv('QUEUE_URL'),
    port: parseInt(process.env.PORT ?? '0', 10) || 0,
  };
}
