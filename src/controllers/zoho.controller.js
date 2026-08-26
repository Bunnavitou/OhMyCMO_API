import { ApiError } from '../utils/ApiError.js';
import { prisma } from '../config/prisma.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import {
  isMailConfigured, mailFrom, sendMail, verifyMailConfig, clearMailCache,
} from '../services/mailer.js';

// Mail settings are per USER, not per tenant — every team member (owner or
// sub-user) connects their own Zoho mailbox and sends as themselves. Anyone
// authenticated may read/edit their own row here; there's no owner-only gate.

// GET /zoho/status — whether Zoho Mail sending is configured for the current user.
export async function getStatus(req, res) {
  const userId = req.user.id;
  res.json({
    success: true,
    data: {
      configured: await isMailConfigured(userId),
      from: await mailFrom(userId),
      provider: 'Zoho Mail',
      mode: 'smtp',
    },
  });
}

// POST /zoho/send — send an invoice report email with attachments, as the
// current user's own configured mailbox.
export async function sendReport(req, res) {
  const userId = req.user.id;
  if (!(await isMailConfigured(userId))) {
    throw ApiError.badRequest(
      'Zoho email is not configured yet. Set it up in More → Email settings.',
    );
  }
  const { to, cc, subject, text, html, attachments } = req.body;
  try {
    const result = await sendMail({ userId, to, cc, subject, text, html, attachments });
    res.json({ success: true, data: { sent: true, ...result } });
  } catch (err) {
    // Surface the SMTP error message (e.g. auth failure, plan restriction).
    throw ApiError.badRequest(`Email send failed: ${err.message}`);
  }
}

// GET /zoho/settings — returns the current user's own mail config, with the
// app password masked (never sent back to the client once saved).
export async function getMailSettings(req, res) {
  const userId = req.user.id;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { mailHost: true, mailPort: true, mailUser: true, mailPassEnc: true, mailFromName: true, mailBcc: true },
  });
  const configured = Boolean(row.mailHost && row.mailUser && row.mailPassEnc);
  res.json({
    success: true,
    data: {
      host: row.mailHost || '',
      port: row.mailPort || 465,
      user: row.mailUser || '',
      hasPassword: Boolean(row.mailPassEnc),
      fromName: row.mailFromName || '',
      bcc: row.mailBcc || '',
      configured,
    },
  });
}

// PUT /zoho/settings — Body: { host, port, user, pass?, fromName?, bcc? }.
// `pass` is optional on update — omit/blank to keep the currently saved one.
// Pass `clear: true` to remove this user's config entirely — sending is then
// disabled for them until they reconnect an account.
export async function updateMailSettings(req, res) {
  const userId = req.user.id;
  const { host, port, user, pass, fromName, bcc, clear } = req.body;

  const data = clear
    ? { mailHost: null, mailPort: null, mailUser: null, mailPassEnc: null, mailFromName: null, mailBcc: null }
    : {
        mailHost: host,
        mailPort: port || null,
        mailUser: user,
        mailFromName: fromName || null,
        mailBcc: bcc || null,
        ...(pass ? { mailPassEnc: encryptSecret(pass) } : {}),
      };

  await prisma.user.update({ where: { id: userId }, data });
  clearMailCache(userId);
  res.json({ success: true, data: { saved: true } });
}

// POST /zoho/verify — actually connects/authenticates to confirm credentials
// work, instead of just checking they're present. Body fields are optional
// overrides on top of the saved row, so the Settings page can test whatever
// is currently in the form (even unsaved) — omitted fields (typically the
// password, left blank so it isn't retyped) fall back to what's saved.
export async function verifySettings(req, res) {
  const userId = req.user.id;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { mailHost: true, mailPort: true, mailUser: true, mailPassEnc: true },
  });
  const { host, port, user, pass } = req.body || {};
  const config = {
    host: host || row.mailHost || '',
    port: port || row.mailPort || 465,
    user: user || row.mailUser || '',
    pass: pass || (row.mailPassEnc ? decryptSecret(row.mailPassEnc) : ''),
  };
  try {
    await verifyMailConfig(config);
    res.json({ success: true, data: { verified: true } });
  } catch (err) {
    throw ApiError.badRequest(`Connection failed: ${err.message}`);
  }
}
