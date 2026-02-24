# testcontainers-aws-preset

Testcontainers presets for AWS services (LocalStack). No manual container setup, ports, or health checks—create a preset, call `start()`, and use the connection.

**Prerequisites:** Node.js 18+, Docker.

## Install

```bash
npm install testcontainers-aws-preset @aws-sdk/client-sqs
```

Install the AWS SDK clients for the services you use (e.g. `@aws-sdk/client-dynamodb`, `@aws-sdk/client-sqs`). Jest and TypeScript are required only if you use them in your project.

## Quick start

Create a preset, call `start()`, then build AWS clients from `getConnectionConfig()`:

```typescript
import { createSqsPreset } from 'testcontainers-aws-preset';
import { SQSClient } from '@aws-sdk/client-sqs';

const preset = createSqsPreset({ queueName: 'my-queue', seedMessages: ['hello'] });
await preset.start();
try {
  const client = new SQSClient(preset.getConnectionConfig());
  // use client...
} finally {
  await preset.stop();
}
```

## Example: Todo API (DynamoDB + SQS)

The **[`examples/todo-api`](./examples/todo-api)** folder contains a small HTTP API that:

- **GET /todos** — reads todos from DynamoDB
- **POST /todos** — saves a todo to DynamoDB and pushes a `todo.created` event to SQS

Tests use a **shared preset** (one LocalStack container with both DynamoDB and SQS): they start the preset, configure the app with the preset’s connection, start the server, and assert that GET returns seed data and POST persists to DynamoDB and sends a message to SQS.

**Run the example from the repo root:**

```bash
npm run build
cd examples/todo-api && npm install && npm test
```

See [`examples/todo-api`](./examples/todo-api) for the full code and test setup.

### Restoring state between tests

Use `reset()` to restore the environment to its initial seed state without restarting the container:

```typescript
beforeEach(async () => {
  await preset.reset();
});
```

## Presets

| Preset | Purpose |
|--------|---------|
| **SQS** | Queue with optional `seedMessages`. |
| **DynamoDB** | Table with optional `seedData`. |
| **S3-SQS** | Bucket + queue with S3 event notifications, optional `seedObjects`. |
| **SNS-SQS** | Topic + queue subscription, optional `seedMessages`. |
| **EventBridge-SQS** | Rule + queue target, optional `seedEvents`. |
| **Secrets Manager** | Optional `seedSecrets`. |
| **Shared** | One container for multiple presets (e.g. SQS + DynamoDB). |

Create with `createSqsPreset()`, `createDynamoDBPreset()`, `createS3SqsPreset()`, etc. All expose `getConnectionConfig()` for building AWS SDK clients and support `reset()` to restore seed state without restarting the container.

## License

MIT
