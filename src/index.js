import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/prisma.js';

async function main() {
  await connectDb();
  const app = createApp();

  // Bind to loopback only — the backend is reached via the frontend's
  // /api proxy on the same server and must not be exposed to the internet.
  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`[${env.NODE_ENV}] OhMyCMO API listening on http://${env.HOST}:${env.PORT}`);
    console.log(`CORS origin: ${env.CORS_ORIGIN}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    // Force exit if not closed in 10s
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(async (err) => {
  console.error('Failed to start server:', err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
