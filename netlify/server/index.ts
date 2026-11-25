import type { Config } from '@netlify/server';
import { createApp } from '../../server.ts';

const app = await createApp({ serveFrontend: false });
app.listen(Number(process.env.PORT) || 3000);

export const config: Config = {
  path: [
    '/api/*',
    '/dashboard',
    '/search',
    '/movie/*',
    '/series/*',
    '/img/*',
    '/stream/*',
  ],
};
