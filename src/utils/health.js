// Customer health (care proposal, feature 1): one green / amber / red status
// per customer that is being served, from the signals WeCRM already holds.
// Unpaid invoices and usage are not tracked per customer yet, so they are not
// part of it. Thresholds live here — tune them in one place.

import { todayKey } from './activities.js';

// Customers in these stages are being served; prospects and churned are not.
export const HEALTH_STAGES = ['Active', 'On hold'];

export const THRESHOLDS = {
  contactAmberDays: 30,  // no contact for this long → amber
  contactRedDays: 60,    //                          → red
  overdueRedDays: 14,    // any overdue work → amber; this late → red
  invoiceAmberDays: 90,  // no invoice for this long → amber
};

// Whole days from 'YYYY-MM-DD' a to b, never negative (a future-dated
// invoice counts as today).
const daysBetween = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 864e5));

// 'YYYY-MM-DD' of an instant on the team's (Phnom Penh) calendar.
const keyOf = (d) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' }) : null);

const latest = (keys) => keys.filter(Boolean).sort().at(-1) || null;

// One customer's health. `sales` are that customer's sales with activities;
// `invoiceDates` are the dates of income entries tagged with the customer;
// `lastInvoiceSend` is the newest 'invoice.send' log time.
export function customerHealth(customer, { sales, invoiceDates, lastInvoiceSend }, today = todayKey()) {
  const since = keyOf(customer.createdAt);

  // Last contact: anything that means someone talked to or served the customer.
  const contactKeys = [keyOf(lastInvoiceSend)];
  for (const s of sales) {
    const at = keyOf(s.saleAt);
    if (at && at <= today) contactKeys.push(at);
    for (const a of s.activities) if (a.status === 'Done') contactKeys.push(keyOf(a.doneAt));
  }
  for (const link of customer.productLinks || []) {
    for (const entry of link.activities || []) contactKeys.push(keyOf(entry.ts));
  }
  for (const task of customer.tasks || []) {
    if (task.status === 'Done') contactKeys.push(keyOf(task.doneAt));
  }
  const lastContact = latest(contactKeys);
  const contactDays = daysBetween(lastContact || since, today);
  const contact = {
    lastAt: lastContact,
    days: contactDays,
    status: contactDays >= THRESHOLDS.contactRedDays ? 'red'
      : contactDays >= THRESHOLDS.contactAmberDays ? 'amber' : 'green',
  };

  // Overdue work: customer tasks and open sale activities past their due date.
  const overdueKeys = [];
  for (const task of customer.tasks || []) {
    if (task.status !== 'Done' && task.due && task.due < today) overdueKeys.push(task.due);
  }
  for (const s of sales) {
    if (s.status === 'Cancelled') continue;
    for (const a of s.activities) {
      const due = a.dueDate ? a.dueDate.toISOString().slice(0, 10) : null;
      if (a.status !== 'Done' && due && due < today) overdueKeys.push(due);
    }
  }
  const oldestDays = overdueKeys.length ? daysBetween(overdueKeys.sort()[0], today) : 0;
  const overdue = {
    count: overdueKeys.length,
    oldestDays,
    status: !overdueKeys.length ? 'green' : oldestDays >= THRESHOLDS.overdueRedDays ? 'red' : 'amber',
  };

  // Billing: days since the last invoice (or since the customer was added).
  const lastInvoice = latest(invoiceDates);
  const invoiceDays = daysBetween(lastInvoice || since, today);
  const invoice = {
    lastDate: lastInvoice,
    days: invoiceDays,
    status: invoiceDays >= THRESHOLDS.invoiceAmberDays ? 'amber' : 'green',
  };

  const products = { count: (customer.productLinks || []).length };

  // Overall: any red signal, or two or more amber ones → red.
  const signals = [contact, overdue, invoice];
  const reds = signals.filter((s) => s.status === 'red').length;
  const ambers = signals.filter((s) => s.status === 'amber').length;
  const status = reds || ambers >= 2 ? 'red' : ambers ? 'amber' : 'green';

  return { customerId: customer.id, status, contact, overdue, invoice, products };
}
