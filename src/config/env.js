import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || 'development';

// Resolve env file based on NODE_ENV. Project root is two levels up from src/config.
const projectRoot = path.resolve(__dirname, '../..');
const envFile = NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.join(projectRoot, envFile) });

function required(name) {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name} (loaded from ${envFile})`);
  }
  return v;
}

export const env = {
  NODE_ENV,
  isProd: NODE_ENV === 'production',
  isDev: NODE_ENV !== 'production',
  PORT: Number(process.env.PORT || 1112),
  HOST: process.env.HOST || '127.0.0.1',
  DATABASE_URL: required('DATABASE_URL'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '10y',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '10y',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:1111',
  COOKIE_SECURE: String(process.env.COOKIE_SECURE).toLowerCase() === 'true',
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || 'lax',
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS || 10),
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR || path.join(projectRoot, 'uploads'),
  MAX_UPLOAD_BYTES: Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024),

  // Save a copy of each sent email to the mailbox "Sent" folder over IMAP
  // (SMTP alone can't). Each user's own SMTP credentials (Settings → Email
  // settings) are reused for this. Requires IMAP enabled on their mailbox.
  SAVE_TO_SENT: String(process.env.SAVE_TO_SENT).toLowerCase() === 'true',
  IMAP_HOST: process.env.IMAP_HOST || 'imap.zoho.com',
  IMAP_PORT: Number(process.env.IMAP_PORT || 993),
  IMAP_SENT_FOLDER: process.env.IMAP_SENT_FOLDER || 'Sent',
};
