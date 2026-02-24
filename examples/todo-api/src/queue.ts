import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { AppConfig } from './config';
import type { Todo } from './db';

export function createSqsClient(config: AppConfig): SQSClient {
  return new SQSClient({
    endpoint: config.sqsEndpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function sendTodoCreated(
  client: SQSClient,
  queueUrl: string,
  todo: Todo
): Promise<void> {
  await client.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ event: 'todo.created', id: todo.id, title: todo.title }),
    })
  );
}
