import { ApiError } from '../utils/ApiError.js';
import { isMailConfigured, mailFrom, sendMail } from '../services/mailer.js';

// GET /zoho/status — whether Zoho Mail sending is configured on the server.
export async function getStatus(_req, res) {
  res.json({
    success: true,
    data: {
      configured: isMailConfigured(),
      from: mailFrom(),
      provider: 'Zoho Mail',
      mode: 'smtp',
    },
  });
}

// POST /zoho/send — send an invoice report email with attachments.
export async function sendReport(req, res) {
  if (!isMailConfigured()) {
    throw ApiError.badRequest(
      'Zoho email is not configured. Add SMTP_USER / SMTP_PASS to the API .env and restart.',
    );
  }
  const { to, cc, subject, text, html, attachments } = req.body;
  try {
    const result = await sendMail({ to, cc, subject, text, html, attachments });
    res.json({ success: true, data: { sent: true, ...result } });
  } catch (err) {
    // Surface the SMTP error message (e.g. auth failure, plan restriction).
    throw ApiError.badRequest(`Email send failed: ${err.message}`);
  }
}
