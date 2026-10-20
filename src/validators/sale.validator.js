import { z } from 'zod';
import { ACTIVITY_TYPES, STATUSES, ACTIVITY_STATUSES, CHANNELS } from '../utils/activities.js';

const idParam = z.object({ id: z.string().min(1) });
export const idParamSchema = z.object({ params: idParam });

// Calendar dates travel as 'YYYY-MM-DD'; the sale time as an ISO timestamp
// with offset (the app sends +07:00).
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const text = (max) => z.string().trim().max(max).nullable().optional();

// One step of a sale. `id` is kept for rows that already exist; new rows may
// carry a temporary client id, which is ignored.
const activity = z
  .object({
    id: z.string().min(1).max(40).optional(),
    type: z.enum(Object.keys(ACTIVITY_TYPES)),
    title: text(200),
    status: z.enum(ACTIVITY_STATUSES).default('New'),
    dueDate: dateKey.nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(), // person in charge
  })
  .refine((a) => a.type !== 'Other' || (a.title && a.title.trim()), {
    message: 'Write what the activity is',
    path: ['title'],
  });

const fields = {
  saleAt: z.string().datetime({ offset: true }),
  status: z.enum(STATUSES).optional(),
  channel: z.enum(CHANNELS).nullable().optional(),
  dueDate: dateKey.nullable().optional(),
  notes: text(5000),
  activities: z.array(activity).max(50).optional(),
  // Who it is with: a customer or a prospect (Partner) — at least one.
  customerId: z.string().min(1).nullable().optional(),
  partnerId: z.string().min(1).nullable().optional(),
  productId: z.string().min(1).nullable().optional(),
  userId: z.string().min(1).optional(), // sales officer; defaults to the caller
};

export const listSalesSchema = z.object({
  query: z.object({
    from: dateKey.optional(),
    to: dateKey.optional(),
    userId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
    partnerId: z.string().min(1).optional(),
    activityType: z.enum(Object.keys(ACTIVITY_TYPES)).optional(), // sales having such an activity
    status: z.enum(STATUSES).optional(),
    channel: z.enum(CHANNELS).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(25),
  }),
});

export const followupsSchema = z.object({
  query: z.object({ userId: z.string().min(1).optional() }),
});

// Week calendar: activities by due date.
export const calendarSchema = z.object({
  query: z.object({
    from: dateKey,
    to: dateKey,
    userId: z.string().min(1).optional(),
  }),
});

export const createSaleSchema = z.object({
  body: z.object(fields).refine((b) => b.customerId || b.partnerId, {
    message: 'Choose a customer or a prospect',
    path: ['customerId'],
  }),
});

export const updateSaleSchema = z.object({
  params: idParam,
  body: z.object(fields).partial().strict(),
});

// Quick change of one activity from the calendar.
export const updateActivitySchema = z.object({
  params: idParam,
  body: z
    .object({
      status: z.enum(ACTIVITY_STATUSES),
      dueDate: dateKey.nullable(),
      assigneeId: z.string().min(1).nullable(),
      title: text(200),
    })
    .partial()
    .strict(),
});

// Customer details confirmed when a prospect is won or converted: an
// existing customer (`customerId`) or a new one (`name` …).
const customerDetails = z
  .object({
    customerId: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    contact: text(120),
    phone: text(40),
  })
  .refine((b) => b.customerId || b.name, { message: 'Customer name is required', path: ['name'] });

export const winSaleSchema = z.object({
  params: idParam,
  body: customerDetails.and(z.object({ productId: z.string().min(1).nullable().optional() })),
});

export const convertPartnerSchema = z.object({ params: idParam, body: customerDetails });

// Dashboard: counts for the cards and deals won by month / year.
export const dashboardSchema = z.object({
  query: z.object({
    userId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
    from: dateKey.optional(),
    to: dateKey.optional(),
  }),
});
