import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1).max(80).optional(),
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
