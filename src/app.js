import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(cookieParser());
  app.use(morgan(env.isDev ? 'dev' : 'combined'));

  // Stored images are fetched one authenticated request at a time, so an
  // image-heavy page costs hundreds in one go — a single Partners load is
  // ~280. Counted against the general budget that let one page view exhaust
  // it for everyone and start 429ing logins, so file bytes get their own
  // generous bucket and are skipped below.
  const fileLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.isProd ? 3000 : 10000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/files', fileLimiter);

  // Basic global rate limit; tighten on /auth in particular.
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.isProd ? 1000 : 2000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/files/'),
  });
  app.use('/api', apiLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.isProd ? 20 : 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
