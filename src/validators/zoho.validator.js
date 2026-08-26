import { z } from 'zod';

export const mailSettingsSchema = z.object({
  body: z
    .object({
      clear: z.boolean().optional(),
      host: z.string().max(255).optional(),
      port: z.number().int().min(1).max(65535).optional(),
      user: z.string().email().optional(),
      pass: z.string().min(1).max(255).optional(),
      fromName: z.string().max(120).optional(),
      bcc: z.string().email().optional().or(z.literal('')),
    })
    .refine((b) => b.clear || (b.host && b.user), {
      message: 'host and user are required unless clear is set',
    }),
});

// POST /zoho/verify — all fields optional overrides on top of the saved row
// (see verifySettings), so no host/user requirement like mailSettingsSchema.
export const verifyMailSchema = z.object({
  body: z.object({
    host: z.string().max(255).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    user: z.string().email().optional(),
    pass: z.string().min(1).max(255).optional(),
  }),
});

export const sendSchema = z.object({
  body: z.object({
    // Accept a single address (legacy) or a list of recipients.
    to: z.union([z.string().email(), z.array(z.string().email()).min(1).max(50)]),
    cc: z.array(z.string().email()).max(50).optional(),
    subject: z.string().max(500).optional(),
    text: z.string().max(100000).optional(),
    html: z.string().max(300000).optional(),
    attachments: z
      .array(
        z.object({
          filename: z.string().min(1).max(255),
          content: z.string().min(1), // base64-encoded bytes
        }),
      )
      .max(20)
      .optional(),
  }),
});
