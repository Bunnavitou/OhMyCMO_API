import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });
export const idParamSchema = z.object({ params: idParam });

// Nested arrays come from the client as opaque JSON. We accept any array
// shape — the frontend is the source of truth for nested structure.
const jsonArray = z.array(z.unknown());

const profileImageSchema = z
  .object({
    fileId: z.string().min(1).optional(),
    dataUrl: z.string().min(1).optional(),
    name: z.string().max(255).optional(),
    type: z.string().max(120).optional(),
    size: z.number().nonnegative().optional(),
  })
  .refine((v) => !!(v.fileId || v.dataUrl), {
    message: 'profileImage must include fileId or dataUrl',
  })
  .nullable()
  .optional();

// A single email address; also permits '' so the client can clear the field.
const optionalEmail = z.string().email().nullable().or(z.literal('')).optional();

// A recipient list — an array of emails (preferred) or a single email string
// (legacy) or '' to clear. Used by the multi-recipient "To" field.
const recipientList = z
  .union([
    z.array(z.string().email()).max(50),
    z.string().email(),
    z.literal(''),
  ])
  .nullable()
  .optional();

// Optional per-customer email template override for invoices.
const emailTemplateSchema = z
  .object({
    subject: z.string().max(300).optional(),
    body: z.string().max(5000).optional(),
  })
  .nullable()
  .optional();

// Task email settings bound to a customer (Email tab in the detail view).
const taskEmailSchema = z
  .object({
    to: recipientList,
    cc: z.array(z.string().email()).optional(),
    subject: z.string().max(300).optional(),
    body: z.string().max(5000).optional(),
  })
  .nullable()
  .optional();

const customerCore = {
  name: z.string().min(1).max(200),
  industry: z.string().max(120).nullable().optional(),
  contact: z.string().max(120).nullable().optional(),
  email: optionalEmail,
  phone: z.string().max(40).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  vatTin: z.string().max(80).nullable().optional(),
  stage: z.string().max(40).optional(),
  groupId: z.string().min(1).nullable().optional(),
  profileImage: profileImageSchema,
  // Invoice email defaults
  billingEmail: optionalEmail,
  emailCc: z.array(z.string().email()).nullable().optional(),
  emailTemplate: emailTemplateSchema,
  taskEmail: taskEmailSchema,
  pinned: z.boolean().optional(),
  staff: jsonArray.optional(),
  tasks: jsonArray.optional(),
  taskGroups: jsonArray.optional(),
  files: jsonArray.optional(),
  agreements: jsonArray.optional(),
  productLinks: jsonArray.optional(),
};

export const createCustomerSchema = z.object({
  body: z.object(customerCore),
});

export const updateCustomerSchema = z.object({
  params: idParam,
  body: z
    .object({
      ...customerCore,
      name: customerCore.name.optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});

export const appendLogSchema = z.object({
  params: idParam,
  body: z.object({
    type: z.string().min(1).max(80),
    message: z.string().min(1).max(500),
    meta: z.record(z.unknown()).nullable().optional(),
  }),
});
