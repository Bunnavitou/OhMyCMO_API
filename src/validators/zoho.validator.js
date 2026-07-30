import { z } from 'zod';

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
