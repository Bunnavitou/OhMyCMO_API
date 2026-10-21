import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf, isOwner, hasPermission } from '../utils/tenant.js';
import {
  todayKey, dayStart, toDbDate, addDays, followupStatus, statusFromActivities, nextActivityDue,
} from '../utils/activities.js';

// Sales (PHASE-1-ACTIVITIES.md). A sale is one opportunity with a customer,
// or with a prospect — a Partner business card — until the user marks the
// sale won (winSale) or converts the card (convertPartnerToCustomer); both
// confirm the customer's details first. Its activities are the steps; with
// activities, the sale's status follows them (saleRules).
//
// Everyone with the 'sales' permission sees the whole team (A2), but a
// sub-user may only create or change their own sales. The owner can act for
// any sales officer. A person in charge of an activity may update that
// activity from the calendar.

const PERSON = { select: { id: true, name: true, username: true, role: true } }; // role: the main account shows as "Admin"
const INCLUDE = {
  customer: { select: { id: true, name: true, contact: true, phone: true, notes: true } },
  partner: { select: { id: true, name: true, company: true, phone: true, customerId: true, notes: true } },
  product: { select: { id: true, name: true } },
  user: PERSON,
  activities: { orderBy: { position: 'asc' }, include: { assignee: PERSON } },
};

const withFollowup = (s, today) => ({ ...s, followupStatus: followupStatus(s, today) });
const dateOf = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d || null);

// Every linked id must belong to the caller's tenant.
async function assertLinksInTenant(tenantId, body) {
  const checks = [
    ['customerId', () => prisma.customer.count({ where: { id: body.customerId, ownerId: tenantId } })],
    ['partnerId', () => prisma.partner.count({ where: { id: body.partnerId, ownerId: tenantId } })],
    ['productId', () => prisma.product.count({ where: { id: body.productId, ownerId: tenantId } })],
    ['userId', () => prisma.user.count({ where: { id: body.userId, OR: [{ id: tenantId }, { ownerId: tenantId }] } })],
  ];
  for (const [field, count] of checks) {
    if (body[field] && (await count()) === 0) {
      throw ApiError.badRequest('Validation failed', [{ path: `body.${field}`, message: 'Not found' }]);
    }
  }
  // An activity's person in charge must be on the team too.
  const assignees = [...new Set((body.activities || []).map((a) => a.assigneeId).filter(Boolean))];
  if (assignees.length) {
    const found = await prisma.user.count({ where: { id: { in: assignees }, OR: [{ id: tenantId }, { ownerId: tenantId }] } });
    if (found !== assignees.length) {
      throw ApiError.badRequest('Validation failed', [{ path: 'body.activities', message: 'Person in charge not found' }]);
    }
  }
}

// The officer a sale belongs to: whoever is picked (default themselves) for
// the owner and sub-users with 'sales.assign'; other sub-users always
// themselves. assertLinksInTenant checks the pick is on the team.
function officerFor(user, requested) {
  if (!requested || requested === user.id) return user.id;
  if (!hasPermission(user, 'sales.assign')) throw ApiError.forbidden('You can only add sales for yourself');
  return requested;
}

function assertCanEdit(user, sale) {
  if (isOwner(user) || sale.userId === user.id) return;
  throw ApiError.forbidden('You can only change your own sales');
}

// The sale-level status rules, given the sale's activities after the change:
// - With activities, the status follows them (statusFromActivities) unless
//   the sale is Cancelled. Choosing Completed by hand marks every activity
//   Done, so the two never disagree.
// - Follow-up needs a due date, or it could never show as overdue. Without
//   one, it takes the earliest due date of the unfinished activities.
// - Completed stamps completedAt; leaving Completed clears it.
// Returns the sale columns to write, and the activities (possibly all set
// to Done).
function saleRules(body, existing, activities) {
  const data = {};
  let list = activities;
  let status = body.status ?? existing?.status ?? 'New';
  if (list.length && status !== 'Cancelled') {
    if (body.status === 'Completed') list = list.map((a) => ({ ...a, status: 'Done' }));
    status = statusFromActivities(list);
  }
  data.status = status;

  const ownDue = body.dueDate !== undefined ? body.dueDate : dateOf(existing?.dueDate);
  if (status === 'Follow-up' && !ownDue) {
    const due = nextActivityDue(list);
    if (!due) {
      throw ApiError.badRequest('Validation failed', [{ path: 'body.dueDate', message: 'Required for Follow-up' }]);
    }
    data.dueDate = toDbDate(due);
  }
  if (status !== (existing?.status ?? null)) {
    data.completedAt = status === 'Completed' ? new Date() : null;
  }
  return { data, activities: list };
}

// Request fields → sale columns (without activities and status rules).
function saleColumns(body) {
  const data = { ...body };
  delete data.activities;
  delete data.status;
  if (body.saleAt !== undefined) data.saleAt = new Date(body.saleAt);
  if (body.dueDate !== undefined) data.dueDate = toDbDate(body.dueDate);
  return data;
}

// Makes the sale's activities match `list` (in order): rows not in the list
// are deleted, known ids updated, the rest created. Stamps doneAt when an
// activity becomes Done.
async function syncActivities(tx, tenantId, saleId, list) {
  const current = await tx.activity.findMany({ where: { saleId } });
  const byId = new Map(current.map((a) => [a.id, a]));
  const keep = new Set(list.map((a) => a.id).filter((id) => byId.has(id)));
  await tx.activity.deleteMany({ where: { saleId, id: { notIn: [...keep] } } });
  for (const [position, a] of list.entries()) {
    const prev = a.id && byId.get(a.id);
    const data = {
      type: a.type,
      title: a.title?.trim() || null,
      status: a.status,
      dueDate: toDbDate(a.dueDate || null),
      assigneeId: a.assigneeId || null,
      position,
      doneAt: a.status === 'Done' ? prev?.doneAt || new Date() : null,
    };
    if (prev) await tx.activity.update({ where: { id: prev.id }, data });
    else await tx.activity.create({ data: { ...data, ownerId: tenantId, saleId } });
  }
}

// A prospect that already became a customer is recorded against that
// customer too, so its new sales show on the customer's page.
async function withConvertedCustomer(body) {
  if (!body.partnerId || body.customerId) return body;
  const p = await prisma.partner.findUnique({ where: { id: body.partnerId }, select: { customerId: true } });
  return p?.customerId ? { ...body, customerId: p.customerId } : body;
}

const withLogs = ({ logs, ...rest }) => ({ ...rest, logs: logs || [] });

// Turns a prospect (Partner business card) into a customer, with the details
// the user confirmed (§2.1):
// - `customerId` set → that existing customer is used (Prospect → Active)
// - otherwise a customer is created from `name`, `contact`, `phone`
// - the card is linked to the customer and every sale with the card moves to
//   it, so the history shows on the customer's page
// - both audit logs record it
// Runs inside the caller's transaction; returns { customer, partner }.
async function convertPartner(tx, tenantId, partner, details, actorId, meta = {}) {
  let customerId = partner.customerId;
  if (!customerId && details.customerId) {
    const existing = await tx.customer.findFirst({ where: { id: details.customerId, ownerId: tenantId } });
    if (!existing) throw ApiError.badRequest('Validation failed', [{ path: 'body.customerId', message: 'Not found' }]);
    customerId = existing.id;
    if (existing.stage === 'Prospect') await tx.customer.update({ where: { id: existing.id }, data: { stage: 'Active' } });
    await tx.customerLog.create({
      data: {
        customerId,
        type: 'customer.update',
        message: `Linked to prospect ${partner.name}`,
        meta: { partnerId: partner.id, ...meta, by: actorId },
      },
    });
  } else if (!customerId) {
    const created = await tx.customer.create({
      data: {
        ownerId: tenantId,
        name: details.name.trim(),
        contact: details.contact?.trim() || null,
        phone: details.phone?.trim() || null,
        email: partner.email,
        stage: 'Active',
      },
    });
    customerId = created.id;
    await tx.customerLog.create({
      data: {
        customerId,
        type: 'customer.create',
        message: `Created from prospect ${partner.name}`,
        meta: { partnerId: partner.id, ...meta, by: actorId },
      },
    });
  }

  if (!partner.customerId) {
    // A customer can come from only one card; if another card already owns
    // this customer, the sales are still linked but the card isn't.
    const taken = await tx.partner.count({ where: { customerId } });
    await tx.partner.update({
      where: { id: partner.id },
      data: { convertedAt: new Date(), ...(taken ? {} : { customerId }) },
    });
    const name = (await tx.customer.findUnique({ where: { id: customerId }, select: { name: true } })).name;
    await tx.partnerLog.create({
      data: {
        partnerId: partner.id,
        type: 'partner.converted',
        message: `Became customer ${name}`,
        meta: { customerId, ...meta, by: actorId },
      },
    });
  }

  await tx.sale.updateMany({ where: { partnerId: partner.id, customerId: null }, data: { customerId } });
  const [customer, updatedPartner] = await Promise.all([
    tx.customer.findUnique({ where: { id: customerId }, include: { logs: { orderBy: { ts: 'desc' } } } }),
    tx.partner.findUnique({ where: { id: partner.id }, include: { logs: { orderBy: { ts: 'desc' } } } }),
  ]);
  return { customer: withLogs(customer), partner: withLogs(updatedPartner) };
}

// A won sale (Done "Deal Won") with a product means the customer now uses
// that product: add it to Customer › Products if it isn't there yet, so the
// customer page and the dashboard's "Products in use" agree with Sales.
// The row is locked first — productLinks is a JSON array, and a lost update
// there has bitten this app before. Returns the updated customer (with
// logs) when a link was added, else null.
async function linkWonProduct(tx, saleId, actorId) {
  const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { activities: true, product: true } });
  if (!sale.customerId || !sale.productId) return null;
  if (!sale.activities.some((a) => a.type === 'Deal Won' && a.status === 'Done')) return null;
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${sale.customerId} FOR UPDATE`;
  const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
  const links = Array.isArray(customer.productLinks) ? customer.productLinks : [];
  if (links.some((l) => l.productId === sale.productId)) return null;
  // Same shape the app's own "link product" writes (StoreContext addCustomerProductLink).
  const link = { id: `pl_${randomUUID().slice(0, 12)}`, productId: sale.productId, linkedAt: new Date().toISOString(), activities: [] };
  await tx.customer.update({ where: { id: customer.id }, data: { productLinks: [...links, link] } });
  await tx.customerLog.create({
    data: {
      customerId: customer.id,
      type: 'product.link',
      message: `Started product history: "${sale.product.name}" (Deal Won)`,
      meta: { linkId: link.id, productId: sale.productId, saleId, by: actorId },
    },
  });
  return withLogs(await tx.customer.findUnique({ where: { id: customer.id }, include: { logs: { orderBy: { ts: 'desc' } } } }));
}

async function findOwn(tenantId, id) {
  const sale = await prisma.sale.findFirst({ where: { id, ownerId: tenantId }, include: { activities: true } });
  if (!sale) throw ApiError.notFound('Sale not found');
  return sale;
}

// ── Sales

// A sale's result, from its activities: won / lost once a Deal Won / Deal
// Lost activity is Done, open until then.
const WON = { activities: { some: { type: 'Deal Won', status: 'Done' } } };
const LOST = { activities: { some: { type: 'Deal Lost', status: 'Done' } } };
const OUTCOME_WHERE = { won: WON, lost: LOST, open: { NOT: [WON, LOST] } };

export async function listSales(req, res) {
  const tenantId = tenantIdOf(req.user);
  const { from, to, userId, customerId, partnerId, activityType, status, outcome, channel, q, page, limit } = req.query;
  const where = {
    ownerId: tenantId,
    ...(from || to
      ? { saleAt: { ...(from ? { gte: dayStart(from) } : {}), ...(to ? { lt: dayStart(addDays(to, 1)) } : {}) } }
      : {}),
    ...(userId ? { userId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(partnerId ? { partnerId } : {}),
    ...(activityType ? { activities: { some: { type: activityType } } } : {}),
    ...(status ? { status } : {}),
    ...(outcome ? { AND: [OUTCOME_WHERE[outcome]] } : {}),
    ...(channel ? { channel } : {}),
    ...(q
      ? {
          OR: [
            { notes: { contains: q, mode: 'insensitive' } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
            { customer: { phone: { contains: q } } },
            { partner: { name: { contains: q, mode: 'insensitive' } } },
            { partner: { company: { contains: q, mode: 'insensitive' } } },
            { partner: { phone: { contains: q } } },
            { user: { name: { contains: q, mode: 'insensitive' } } },
            { activities: { some: { title: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ saleAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);
  const today = todayKey();
  res.json({ success: true, data: { items: items.map((s) => withFollowup(s, today)), total, page, limit } });
}

// Open follow-ups grouped Overdue / Today / Upcoming (Excel BR-02, BR-10).
export async function listFollowups(req, res) {
  const tenantId = tenantIdOf(req.user);
  const { userId } = req.query;
  const items = await prisma.sale.findMany({
    where: { ownerId: tenantId, status: 'Follow-up', dueDate: { not: null }, ...(userId ? { userId } : {}) },
    include: INCLUDE,
    orderBy: [{ dueDate: 'asc' }, { saleAt: 'asc' }],
  });
  const today = todayKey();
  const groups = { overdue: [], today: [], upcoming: [] };
  for (const s of items) {
    const row = withFollowup(s, today);
    groups[row.followupStatus.toLowerCase()].push(row);
  }
  res.json({ success: true, data: groups });
}

export async function getSale(req, res) {
  const tenantId = tenantIdOf(req.user);
  const sale = await prisma.sale.findFirst({ where: { id: req.params.id, ownerId: tenantId }, include: INCLUDE });
  if (!sale) throw ApiError.notFound('Sale not found');
  res.json({ success: true, data: { sale: withFollowup(sale) } });
}

export async function createSale(req, res) {
  const tenantId = tenantIdOf(req.user);
  const userId = officerFor(req.user, req.body.userId);
  await assertLinksInTenant(tenantId, { ...req.body, userId });
  const body = await withConvertedCustomer(req.body);
  const rules = saleRules(body, null, body.activities || []);
  const { sale, customer } = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: { ...saleColumns(body), ...rules.data, userId, ownerId: tenantId },
    });
    await syncActivities(tx, tenantId, created.id, rules.activities);
    const customer = await linkWonProduct(tx, created.id, req.user.id);
    return { sale: await tx.sale.findUnique({ where: { id: created.id }, include: INCLUDE }), customer };
  });
  res.status(201).json({ success: true, data: { sale: withFollowup(sale), customer } });
}

export async function updateSale(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await findOwn(tenantId, req.params.id);
  assertCanEdit(req.user, existing);
  if (req.body.userId) req.body.userId = officerFor(req.user, req.body.userId);
  await assertLinksInTenant(tenantId, req.body);
  const body = await withConvertedCustomer(req.body);
  const after = (k) => (body[k] !== undefined ? body[k] : existing[k]);
  if (!after('customerId') && !after('partnerId')) {
    throw ApiError.badRequest('Validation failed', [{ path: 'body.customerId', message: 'Choose a customer or a prospect' }]);
  }
  const list = body.activities ?? existing.activities.map((a) => ({ ...a, dueDate: dateOf(a.dueDate) }));
  const rules = saleRules(body, existing, list);
  const { sale, customer } = await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id: existing.id }, data: { ...saleColumns(body), ...rules.data } });
    if (body.activities !== undefined || rules.activities !== list) {
      await syncActivities(tx, tenantId, existing.id, rules.activities);
    }
    const customer = await linkWonProduct(tx, existing.id, req.user.id);
    return { sale: await tx.sale.findUnique({ where: { id: existing.id }, include: INCLUDE }), customer };
  });
  res.json({ success: true, data: { sale: withFollowup(sale), customer } });
}

export async function deleteSale(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await findOwn(tenantId, req.params.id);
  assertCanEdit(req.user, existing);
  if (!hasPermission(req.user, 'sales.delete')) {
    throw ApiError.forbidden('Missing permission: sales.delete');
  }
  await prisma.sale.delete({ where: { id: existing.id } }); // activities cascade
  res.json({ success: true, data: { message: 'Sale deleted' } });
}

// ── Activities (week calendar)

// Activities due in a date range. `userId` = the person in charge, or the
// sale's officer when nobody is in charge.
export async function listActivities(req, res) {
  const tenantId = tenantIdOf(req.user);
  const { from, to, userId } = req.query;
  const items = await prisma.activity.findMany({
    where: {
      ownerId: tenantId,
      dueDate: { gte: toDbDate(from), lte: toDbDate(to) },
      ...(userId ? { OR: [{ assigneeId: userId }, { assigneeId: null, sale: { userId } }] } : {}),
    },
    include: {
      assignee: PERSON,
      sale: { include: { customer: INCLUDE.customer, partner: INCLUDE.partner, user: PERSON } },
    },
    orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
  });
  res.json({ success: true, data: { items } });
}

// Quick change of one activity (status, date, person) — by the sale's
// officer, the person in charge, or the owner. Re-applies the sale rules.
export async function updateActivity(req, res) {
  const tenantId = tenantIdOf(req.user);
  const act = await prisma.activity.findFirst({ where: { id: req.params.id, ownerId: tenantId }, include: { sale: { include: { activities: true } } } });
  if (!act) throw ApiError.notFound('Activity not found');
  const { sale } = act;
  if (!isOwner(req.user) && sale.userId !== req.user.id && act.assigneeId !== req.user.id) {
    throw ApiError.forbidden('You can only change activities on your sales or in your charge');
  }
  await assertLinksInTenant(tenantId, { activities: [req.body] });

  const list = sale.activities
    .sort((a, b) => a.position - b.position)
    .map((a) => ({ ...a, dueDate: dateOf(a.dueDate), ...(a.id === act.id ? req.body : {}) }));
  const rules = saleRules({}, sale, list);
  const { result, customer } = await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id: sale.id }, data: rules.data });
    await syncActivities(tx, tenantId, sale.id, rules.activities);
    const customer = await linkWonProduct(tx, sale.id, req.user.id);
    return { result: await tx.sale.findUnique({ where: { id: sale.id }, include: INCLUDE }), customer };
  });
  res.json({ success: true, data: { sale: withFollowup(result), customer } });
}

// ── Winning a prospect

// Mark a prospect's sale won: the customer is created (or an existing one
// used) with the details the user confirmed, the sale is Completed — its
// Deal Won activity Done, or one added — so the weekly KPI counts it.
export async function winSale(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await findOwn(tenantId, req.params.id);
  assertCanEdit(req.user, existing);
  if (existing.customerId) throw ApiError.conflict('This sale is already with a customer');
  if (!existing.partnerId) throw ApiError.badRequest('This sale has no prospect');
  await assertLinksInTenant(tenantId, { productId: req.body.productId });

  const list = existing.activities
    .sort((a, b) => a.position - b.position)
    .map((a) => ({ ...a, dueDate: dateOf(a.dueDate) }));
  const won = list.find((a) => a.type === 'Deal Won');
  if (!won) list.push({ type: 'Deal Won', status: 'Done', title: null, dueDate: todayKey(), assigneeId: req.user.id });
  const rules = saleRules({ status: 'Completed' }, existing, list);

  const { sale, conversion } = await prisma.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ where: { id: existing.partnerId } });
    const conversion = await convertPartner(tx, tenantId, partner, req.body, req.user.id, { saleId: existing.id });
    await tx.sale.update({
      where: { id: existing.id },
      data: { ...rules.data, ...(req.body.productId ? { productId: req.body.productId } : {}) },
    });
    await syncActivities(tx, tenantId, existing.id, rules.activities);
    const linked = await linkWonProduct(tx, existing.id, req.user.id);
    if (linked) conversion.customer = linked;
    return { sale: await tx.sale.findUnique({ where: { id: existing.id }, include: INCLUDE }), conversion };
  });
  res.json({ success: true, data: { sale: withFollowup(sale), conversion } });
}

// Partner page: turn a business card into a customer without a sale (e.g.
// someone who signed outside the app). Mounted under /api/partners.
export async function convertPartnerToCustomer(req, res) {
  const tenantId = tenantIdOf(req.user);
  const partner = await prisma.partner.findFirst({ where: { id: req.params.id, ownerId: tenantId } });
  if (!partner) throw ApiError.notFound('Partner not found');
  if (partner.customerId) throw ApiError.conflict('This business card is already a customer');
  const conversion = await prisma.$transaction((tx) => convertPartner(tx, tenantId, partner, req.body, req.user.id));
  res.json({ success: true, data: { conversion } });
}

// ── Dashboard

// Phnom Penh calendar 'YYYY-MM' of an instant.
const monthKey = (d) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 7);

// Cards: sales by status for the filters (date range = sale date). Chart:
// deals won — Done "Deal Won" activities — counted by the month they were
// done (date range = done date), for the same officer / customer.
export async function dashboard(req, res) {
  const tenantId = tenantIdOf(req.user);
  const { userId, customerId, from, to } = req.query;
  const who = { ownerId: tenantId, ...(userId ? { userId } : {}), ...(customerId ? { customerId } : {}) };
  const range = (from || to)
    ? { ...(from ? { gte: dayStart(from) } : {}), ...(to ? { lt: dayStart(addDays(to, 1)) } : {}) }
    : null;

  const inRange = { ...who, ...(range ? { saleAt: range } : {}) };
  const [byStatus, overdue, won, wonSales, lostSales] = await Promise.all([
    prisma.sale.groupBy({ by: ['status'], where: inRange, _count: true }),
    prisma.sale.count({ where: { ...inRange, status: 'Follow-up', dueDate: { lt: toDbDate(todayKey()) } } }),
    prisma.activity.findMany({
      where: { ownerId: tenantId, type: 'Deal Won', status: 'Done', doneAt: { not: null, ...(range || {}) }, sale: who },
      select: {
        doneAt: true,
        sale: { select: { id: true, customerId: true, partnerId: true, customer: INCLUDE.customer, partner: INCLUDE.partner, product: { select: { id: true, name: true } }, user: PERSON } },
      },
      orderBy: { doneAt: 'desc' },
    }),
    // Results of the sales counted on the cards (same saleAt range).
    prisma.sale.count({ where: { ...inRange, ...WON } }),
    prisma.sale.count({ where: { ...inRange, ...LOST } }),
  ]);
  const count = Object.fromEntries(byStatus.map((r) => [r.status, r._count]));
  const months = {};
  for (const a of won) {
    const k = monthKey(a.doneAt);
    months[k] = (months[k] || 0) + 1;
  }
  res.json({
    success: true,
    data: {
      totals: {
        total: byStatus.reduce((n, r) => n + r._count, 0),
        new: count.New || 0,
        followUp: count['Follow-up'] || 0,
        completed: count.Completed || 0,
        rejected: count.Cancelled || 0,
        won: wonSales,
        lost: lostSales,
        overdue,
      },
      wonByMonth: months, // { 'YYYY-MM': count }
      // The latest deals won, newest first: who bought what, when, and from whom.
      wins: won.slice(0, 10).map((a) => ({ wonAt: a.doneAt, ...a.sale })),
      winsTotal: won.length,
    },
  });
}
