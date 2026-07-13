// Outbound email via Zoho Mail SMTP (nodemailer).
//
// Configured entirely from env (SMTP_HOST/PORT/USER/PASS/FROM). When the
// credentials are absent, isMailConfigured() returns false and callers surface
// a clear "not configured" message instead of attempting to send.
//
// Zoho note: SMTP_PASS must be an app-specific password generated in
// Zoho Mail → Settings → Security → App Passwords (not the account password),
// and SMTP_USER/SMTP_FROM must be a real Zoho-hosted mailbox.

import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { ImapFlow } from 'imapflow';
import { env } from '../config/env.js';

let transporter = null;

export function isMailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

export function mailFrom() {
  return env.SMTP_FROM || env.SMTP_USER || null;
}

// The From header — with a display name when SMTP_FROM_NAME is set, e.g.
// "KOSIGN Billing <billing@kosign.com.kh>". A named sender scores marginally
// better with spam filters than a bare address.
function fromHeader() {
  const addr = mailFrom();
  if (!addr) return undefined;
  return env.SMTP_FROM_NAME ? `"${env.SMTP_FROM_NAME}" <${addr}>` : addr;
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

// Verify the SMTP connection/credentials without sending a message.
export async function verifyMail() {
  const tx = getTransporter();
  if (!tx) throw new Error('SMTP is not configured');
  await tx.verify();
  return true;
}

// attachments: [{ filename, content }] where content is a base64 string.
// Append a copy of the sent message to the mailbox "Sent" folder over IMAP.
// SMTP alone never populates "Sent"; this rebuilds the message as raw MIME and
// IMAP-APPENDs it. Best-effort — failures are logged, never thrown, so a Sent-
// copy hiccup can't fail the actual send. `mailOptions` is the nodemailer
// options WITHOUT bcc (a Sent copy shouldn't carry bcc headers).
async function saveToSent(mailOptions) {
  const raw = await new Promise((resolve, reject) => {
    new MailComposer(mailOptions).compile().build((err, msg) => (err ? reject(err) : resolve(msg)));
  });
  const client = new ImapFlow({
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    secure: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    logger: false,
  });
  await client.connect();
  try {
    await client.append(env.IMAP_SENT_FOLDER, raw, ['\\Seen']);
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function sendMail({ to, cc, bcc, subject, text, html, attachments }) {
  const tx = getTransporter();
  if (!tx) throw new Error('SMTP is not configured');
  // Merge any per-send bcc with the configured archive address (SMTP_BCC), so a
  // copy of every sent email is retained even though SMTP doesn't fill "Sent".
  const bccList = [...(Array.isArray(bcc) ? bcc : []), ...(env.SMTP_BCC ? [env.SMTP_BCC] : [])]
  const baseOptions = {
    from: fromHeader(),
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
      await saveToSent(baseOptions);
    } catch (err) {
      const detail = err.responseText || err.message;
      console.error('[mailer] saveToSent (IMAP append) failed:', detail);
    }
  }

  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}
