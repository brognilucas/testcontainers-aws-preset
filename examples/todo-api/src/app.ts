import express from 'express';
import type { AppConfig } from './config';
import {
  createDynamoDBClient,
  getTodos,
  putTodo,
  type Todo,
} from './db';
import { createSqsClient, sendTodoCreated } from './queue';

export function createApp(config: AppConfig): express.Express {
  const app = express();
  app.use(express.json());

  const dynamoClient = createDynamoDBClient(config);
  const sqsClient = createSqsClient(config);

  app.get('/todos', async (_req, res) => {
    try {
      const todos = await getTodos(dynamoClient, config.tableName);
      res.json(todos);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/todos', async (req, res) => {
    const title = req.body?.title;
    if (typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ error: 'title is required and must be a non-empty string' });
      return;
    }
    const todo: Todo = {
      id: crypto.randomUUID(),
      title: title.trim(),
      status: 'pending',
    };
    try {
      await putTodo(dynamoClient, config.tableName, todo);
      await sendTodoCreated(sqsClient, config.queueUrl, todo);
      res.status(201).json(todo);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return app;
}
