import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });
export const idParamSchema = z.object({ params: idParam });

// A report is a customizable table: editable column headers + editable rows
// (each with a $/count format, previous-year actual, current-year total, and 4
// weekly values). The weekly 합계 total is derived client-side.
const cellNum = z.number().nullable().optional();

const rowSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().max(200).optional(),
    money: z.boolean().optional(),
    prevYear: cellNum,
    currentYear: cellNum,
    weeks: z.array(z.number().nullable()).max(24).optional(),
  })
  .passthrough();

const headersSchema = z
  .object({
    category: z.string().max(160).optional(),
    prevYear: z.string().max(160).optional(),
    currentYear: z.string().max(160).optional(),
    month: z.string().max(160).optional(),
    weeks: z.array(z.string().max(160)).max(24).optional(),
    total: z.string().max(160).optional(),
  })
  .partial();

const dataSchema = z
  .object({
    headers: headersSchema.optional(),
    rows: z.array(rowSchema).max(100).optional(),
  })
  .passthrough(); // tolerate legacy metric-keyed data on read/round-trip

const reportCore = {
  account: z.enum(['LM', 'SM', 'SMS']),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  data: dataSchema.optional(),
};

export const createReportSchema = z.object({ body: z.object(reportCore) });
export const updateReportSchema = z.object({
  params: idParam,
  body: z
    .object({
      ...reportCore,
      account: reportCore.account.optional(),
      year: reportCore.year.optional(),
      month: reportCore.month.optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});
