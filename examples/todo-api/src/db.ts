import { DynamoDBClient, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { AppConfig } from './config';

export interface Todo {
  id: string;
  title: string;
  status: string;
}

export function createDynamoDBClient(config: AppConfig): DynamoDBClient {
  return new DynamoDBClient({
    endpoint: config.dynamodbEndpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function getTodos(client: DynamoDBClient, tableName: string): Promise<Todo[]> {
  const response = await client.send(new ScanCommand({ TableName: tableName }));
  const items = (response.Items ?? []).map((item) => unmarshall(item) as Todo);
  return items;
}

export async function putTodo(
  client: DynamoDBClient,
  tableName: string,
  todo: Todo
): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(todo),
    })
  );
}
