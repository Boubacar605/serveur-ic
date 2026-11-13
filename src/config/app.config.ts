import { registerAs } from '@nestjs/config';

const port = Number(process.env.PORT ?? 3000);
const apiPrefix = process.env.API_PREFIX ?? 'api/v1';

export default registerAs('app', () => ({
  port,
  apiPrefix,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  publicUrl: process.env.APP_PUBLIC_URL ?? `http://localhost:${port}/${apiPrefix.replace(/^\/+|\/+$/g, '')}`,
}));
