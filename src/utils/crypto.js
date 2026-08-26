// AES-256-GCM encryption for secrets stored at rest (e.g. a tenant's Zoho
// app password in User.mailPassEnc). The key is derived from
// JWT_ACCESS_SECRET, so there's no extra secret to provision/rotate — it
// simply rides along with the existing one.

import crypto from 'node:crypto';
import { env } from '../config/env.js';

const key = crypto.scryptSync(env.JWT_ACCESS_SECRET, 'ohmycmo-mail-settings', 32);

// Returns "iv:authTag:ciphertext" (base64 each part).
export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(packed) {
  if (!packed) return null;
  const [ivB64, tagB64, dataB64] = packed.split(':');
  if (!ivB64 || !tagB64 || !dataB64) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}
