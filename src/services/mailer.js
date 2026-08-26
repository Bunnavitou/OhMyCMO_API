// Outbound email via Zoho Mail SMTP (nodemailer) — per user, no shared
// fallback. Every team member (tenant owner or sub-user) connects their own
// Zoho mailbox in Settings (More → Email settings), stored on their own
// User row (mailHost/mailPort/mailUser/mailPassEnc/mailFromName/mailBcc) —
// invoice reports send as whoever clicked Send. A user who hasn't connected
// their own account simply can't send; there is no server-wide default.
//
// Zoho note: the app password must be generated in
// Zoho Mail → Settings → Security → App Passwords (not the account password),
// and the user/from address must be a real Zoho-hosted mailbox.

import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { ImapFlow } from 'imapflow';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { decryptSecret, encryptSecret } from '../utils/crypto.js';

// Cached transporters, keyed by userId — invalidated by clearMailCache()
// whenever that user's settings are updated.
const transporters = new Map();

export function clearMailCache(userId) {
  transporters.delete(userId);
}

// A user's own mail config — entirely their own DB fields, no env fallback.
export async function getUserMailConfig(userId) {
  const row = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { mailHost: true, mailPort: true, mailUser: true, mailPassEnc: true, mailFromName: true, mailBcc: true },
      })
    : null;

  const host = row?.mailHost || '';
  const port = row?.mailPort || 465;
  const user = row?.mailUser || '';
  const pass = row?.mailPassEnc ? decryptSecret(row.mailPassEnc) : '';
  const fromName = row?.mailFromName || '';
  const bcc = row?.mailBcc || '';

  return { host, port, user, pass, from: user, fromName, bcc };
}

export async function isMailConfigured(userId) {
  const { host, user, pass } = await getUserMailConfig(userId);
  return Boolean(host && user && pass);
}

export async function mailFrom(userId) {
  const { from } = await getUserMailConfig(userId);
  return from || null;
}

// The From header — with a display name when set, e.g.
// "KOSIGN Billing <billing@kosign.com.kh>". A named sender scores marginally
// better with spam filters than a bare address.
function fromHeader(config) {
  if (!config.from) return undefined;
  return config.fromName ? `"${config.fromName}" <${config.from}>` : config.from;
}

async function getTransporter(userId) {
  const config = await getUserMailConfig(userId);
  if (!(config.host && config.user && config.pass)) return null;
  if (!transporters.has(userId)) {
    transporters.set(
      userId,
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: Number(config.port) === 465, // 465 = implicit TLS; 587 = STARTTLS
        auth: { user: config.user, pass: config.pass },
      }),
    );
  }
  return { tx: transporters.get(userId), config };
}

// Verify the SMTP connection/credentials without sending a message.
export async function verifyMail(userId) {
  const resolved = await getTransporter(userId);
  if (!resolved) throw new Error('SMTP is not configured');
  await resolved.tx.verify();
  return true;
}

// Verify arbitrary host/port/user/pass without touching the cache or DB — for
// the Settings page's "Test connection" button, which should check whatever
// is currently in the form (saved or not), not just the last saved config.
export async function verifyMailConfig({ host, port, user, pass }) {
  if (!(host && user && pass)) throw new Error('SMTP is not configured');
  const tx = nodemailer.createTransport({
    host,
    port,
    secure: Number(port) === 465,
    auth: { user, pass },
  });
  await tx.verify();
  return true;
}

// attachments: [{ filename, content }] where content is a base64 string.
// Append a copy of the sent message to the mailbox "Sent" folder over IMAP.
// SMTP alone never populates "Sent"; this rebuilds the message as raw MIME and
// IMAP-APPENDs it. Best-effort — failures are logged, never thrown, so a Sent-
// copy hiccup can't fail the actual send. `mailOptions` is the nodemailer
// options WITHOUT bcc (a Sent copy shouldn't carry bcc headers). IMAP save is
// a server-wide option (env-only, not per-user) — it reuses the same user's
// SMTP user/pass since Zoho's IMAP shares SMTP credentials.
async function saveToSent(mailOptions, config) {
  const raw = await new Promise((resolve, reject) => {
    new MailComposer(mailOptions).compile().build((err, msg) => (err ? reject(err) : resolve(msg)));
  });
  const client = new ImapFlow({
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    secure: true,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });
  await client.connect();
  try {
    await client.append(env.IMAP_SENT_FOLDER, raw, ['\\Seen']);
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function sendMail({ userId, to, cc, bcc, subject, text, html, attachments }) {
  const resolved = await getTransporter(userId);
  if (!resolved) throw new Error('SMTP is not configured');
  const { tx, config } = resolved;

  // Merge any per-send bcc with the configured archive address, so a copy of
  // every sent email is retained even though SMTP doesn't fill "Sent".
  const bccList = [...(Array.isArray(bcc) ? bcc : []), ...(config.bcc ? [config.bcc] : [])];
  const baseOptions = {
    from: fromHeader(config),
    to,
    cc: Array.isArray(cc) && cc.length ? cc : undefined,
    subject,
    text: text || undefined,
    html: html || undefined,
    attachments: (attachments || []).map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
    })),
  };
  const info = await tx.sendMail({
    ...baseOptions,
    bcc: bccList.length ? bccList : undefined,
  });

  // Best-effort copy into the "Sent" folder (never fails the send).
  if (env.SAVE_TO_SENT) {
    try {
      await saveToSent(baseOptions, config);
    } catch (err) {
      const detail = err.responseText || err.message;
      console.error('[mailer] saveToSent (IMAP append) failed:', detail);
    }
  }

  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

export { encryptSecret };
