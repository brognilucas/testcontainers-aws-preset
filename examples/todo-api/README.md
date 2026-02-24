# Todo API example

Minimal API that reads and writes todos in DynamoDB and publishes `todo.created` events to SQS.

- **GET /todos** — returns all todos from DynamoDB
- **POST /todos** — body `{ "title": "..." }`; saves to DynamoDB and sends event to SQS

- **`api.test.ts`** — Integration tests: shared DynamoDB + SQS preset, HTTP server, GET and POST endpoints.
- **`db.test.ts`** — Unit tests for `getTodos` and `putTodo`: DynamoDB preset only, no HTTP or SQS. Set the preset with the seed data you need and call the method.
- **`queue.test.ts`** — Unit test for `sendTodoCreated`: SQS preset only; send then receive and assert the message body.

## Run tests

From the **repository root**:

```bash
npm run build
cd examples/todo-api && npm install && npm test
```

Requires Docker (for LocalStack).
