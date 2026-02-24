import { loadConfig } from './config';
import { createApp } from './app';

const config = loadConfig();
const app = createApp(config);
const server = app.listen(config.port, () => {
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : config.port;
  console.log(`Todo API listening on port ${port}`);
});
