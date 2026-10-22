// Customer health (care proposal, feature 1): one green / amber / red status
// per customer that is being served, from the signals WeCRM already holds.
// Unpaid invoices and usage are not tracked per customer yet, so they are not
// part of it. Thresholds live here — tune them in one place.

import { todayKey, addDays } from './activities.js';

// Customers in these stages are being served; prospects and churned are not.
export const HEALTH_STAGES = ['Active', 'On hold'];

export const THRESHOLDS = {
  contactAmberDays: 30,  // no contact for this long → amber
  contactRedDays: 60,    //                          → red
  overdueRedDays: 14,    // any overdue work → amber; this late → red
  invoiceAmberDays: 90,  // no invoice for this long → amber
  paymentRedDays: 30,    // an unpaid invoice past its due date → amber; this late → red
  renewalWarnDays: 60,   // an agreement ending within this many days → amber; ended → red
  requestAmberDays: 7,   // a customer request open this long → amber
  requestRedDays: 21,    //                                   → red
};

// Check-in rhythm → days between check-ins (Customer.careCadence).
export const CARE_CADENCES = { monthly: 30, quarterly: 91 };

// Whole days from 'YYYY-MM-DD' a to b, never negative (a future-dated
// invoice counts as today).
const daysBetween = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 864e5));

// 'YYYY-MM-DD' of an instant on the team's (Phnom Penh) calendar.
const keyOf = (d) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' }) : null);

const latest = (keys) => keys.filter(Boolean).sort().at(-1) || null;

// One customer's health. `sales` are that customer's sales with activities;
// `invoices` are the income entries tagged with the customer;
// `lastInvoiceSend` / `lastCheckIn` are the newest 'invoice.send' /
// 'care.checkin' log times.
export function customerHealth(customer, { sales, invoices = [], lastInvoiceSend, lastCheckIn }, today = todayKey()) {
  const invoiceDates = invoices.map((e) => String(e.date || '').slice(0, 10)).filter(Boolean);
  const since = keyOf(customer.createdAt);

  // Last contact: anything that means someone talked to or served the customer.
  const contactKeys = [keyOf(lastInvoiceSend), keyOf(lastCheckIn)];
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

  // Requests: customer tasks of kind 'request' (care feature 2). Open ones age
  // from their register date; done ones give response and resolution times
  // (last 90 days) — respondedAt is stamped when a request first leaves Todo.
  const reqs = (customer.tasks || []).filter((t) => t.kind === 'request')
  const open = reqs.filter((t) => t.status !== 'Done')
  const age = (t) => daysBetween(t.registerDate || since, today)
  const oldestOpen = open.length ? Math.max(...open.map(age)) : 0
  const recent = reqs.filter((t) => t.status === 'Done' && t.doneAt && keyOf(t.doneAt) >= addDays(today, -90))
  const avg = (xs) => (xs.length ? Math.round((xs.reduce((n, x) => n + x, 0) / xs.length) * 10) / 10 : null)
  const requests = {
    openCount: open.length,
    oldestDays: oldestOpen,
    avgResponseDays: avg(reqs.filter((t) => t.respondedAt && t.registerDate && keyOf(t.respondedAt) >= addDays(today, -90))
      .map((t) => daysBetween(t.registerDate, keyOf(t.respondedAt)))),
    avgResolveDays: avg(recent.filter((t) => t.registerDate).map((t) => daysBetween(t.registerDate, keyOf(t.doneAt)))),
    status: !open.length ? 'green'
      : oldestOpen >= THRESHOLDS.requestRedDays ? 'red'
        : oldestOpen >= THRESHOLDS.requestAmberDays ? 'amber' : 'green',
  }

  // Payments: invoices tracked as unpaid (payment: 'unpaid') past their due
  // date. Older invoices carry no payment field and are not tracked.
  const late = invoices
    .filter((e) => e.payment === 'unpaid' && e.dueDate && e.dueDate < today)
    .map((e) => ({ days: daysBetween(e.dueDate, today), amount: Number(e.amount || 0) }));
  const payments = {
    overdueCount: late.length,
    overdueAmount: late.reduce((n, x) => n + x.amount, 0),
    oldestDays: late.length ? Math.max(...late.map((x) => x.days)) : 0,
    unpaidCount: invoices.filter((e) => e.payment === 'unpaid').length,
  };
  payments.status = !late.length ? 'green' : payments.oldestDays >= THRESHOLDS.paymentRedDays ? 'red' : 'amber';

  // Renewal: the agreement ending soonest (endDate on Customer.agreements).
  const ends = (customer.agreements || []).map((a) => a.endDate).filter(Boolean).sort();
  const nextEnd = ends.find((d) => d >= today) || null;
  const lastEnded = [...ends].reverse().find((d) => d < today) || null;
  const renewal = { endDate: nextEnd || lastEnded, days: null, status: 'green' };
  if (nextEnd) {
    renewal.days = daysBetween(today, nextEnd);
    if (renewal.days <= THRESHOLDS.renewalWarnDays) renewal.status = 'amber';
  } else if (lastEnded) {
    renewal.days = -daysBetween(lastEnded, today);
    renewal.status = 'red'; // every agreement has ended and none renews
  }

  // Next check-in: one rhythm after the last contact of any kind, so a
  // meeting or a sent invoice also resets the clock.
  const every = CARE_CADENCES[customer.careCadence];
  const nextDue = every ? addDays(lastContact || since, every) : null;
  const checkIn = every ? {
    cadence: customer.careCadence,
    ownerId: customer.careOwnerId || null,
    lastAt: keyOf(lastCheckIn),
    nextDue,
    status: nextDue < today ? 'overdue' : nextDue === today ? 'due' : 'upcoming',
  } : null;

  // Overall: any red signal, or two or more amber ones → red.
  const signals = [contact, overdue, invoice, payments, renewal, requests];
  const reds = signals.filter((s) => s.status === 'red').length;
  const ambers = signals.filter((s) => s.status === 'amber').length;
  const status = reds || ambers >= 2 ? 'red' : ambers ? 'amber' : 'green';

  return { customerId: customer.id, status, contact, overdue, invoice, payments, renewal, requests, products, checkIn };
}
