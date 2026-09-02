import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1).max(80).optional(),
  }),
});

const avatarSchema = z
  .object({
    fileId: z.string().min(1),
    name: z.string().max(255).optional(),
    type: z.string().max(120).optional(),
    size: z.number().nonnegative().optional(),
  })
  .nullable()
  .optional();

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().max(80).nullable().optional(),
      avatar: avatarSchema,
      username: z
        .string()
        .min(2, 'Username must be at least 2 characters')
        .max(40)
        .regex(/^[a-zA-Z0-9._-]+$/, 'Username may contain letters, digits, dot, underscore, dash')
        .optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

// Owners log in by email; sub-users log in by username.
// Frontend sends one or the other.
export const loginSchema = z.object({
  body: z
    .object({
      email: z.string().email().optional(),
      username: z.string().min(1).max(40).optional(),
      password: z.string().min(1),
    })
    .refine((d) => d.email || d.username, {
      message: 'email or username is required',
    }),
});
