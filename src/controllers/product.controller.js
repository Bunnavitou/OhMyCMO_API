import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf } from '../utils/tenant.js';

// Per-entry writes for a Product's JSON array columns.
//
// The billing UI used to add one invoice by PATCHing the product's ENTIRE
// income array back, so the request grew with billing history — past 1MB on
// real data, which every proxy in front of the API rejects. These routes send
// only the entry being touched, and the array is assembled here instead.
//
// Doing the read-modify-write server-side inside a transaction also closes a
// lost-update hole the old approach had: two people editing the same product
// each sent a full array built from their own stale copy, so whoever saved
// last silently dropped the other's entries.

const CHILD_FIELDS = ['income', 'expenses'];

const PRODUCT_INCLUDE = {
  pmoOwner: { select: { id: true, name: true, username: true, avatar: true } },
};

// Mirrors the id shape the frontend used to mint ('i-…' / 'e-…').
const newEntryId = (field) =>
  `${field[0]}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// `mutate` receives the current array and returns the next one. It runs inside
// the transaction, so throwing from it aborts the write.
//
// The row is locked with SELECT … FOR UPDATE first. A transaction alone is not
// enough: under Postgres' default READ COMMITTED, two concurrent writers both
// read the same array and both write it back, so one silently loses its entry
// (measured: 20 parallel adds landed 5 rows). The lock serialises them.
async function mutateChildren(req, mutate) {
  const { id, field } = req.params;
  const tenantId = tenantIdOf(req.user);
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`
      SELECT id FROM "Product" WHERE id = ${id} AND "ownerId" = ${tenantId} FOR UPDATE
    `;
    if (locked.length === 0) throw ApiError.notFound('Product not found');
    const existing = await tx.product.findUniqueOrThrow({
      where: { id },
      select: { [field]: true },
    });
    const current = Array.isArray(existing[field]) ? existing[field] : [];
    return tx.product.update({
      where: { id },
      data: { [field]: mutate(current) },
      include: PRODUCT_INCLUDE,
    });
  });
}

// Accepts one entry ({ item }) or several ({ items }) — the bulk-duplicate
// action adds a batch. Newest first, matching the previous client behaviour.
export async function addProductChildren(req, res) {
  const { field } = req.params;
  const incoming = req.body.items ?? [req.body.item];
  const prepared = incoming.map((item) => ({ ...item, id: item.id || newEntryId(field) }));
  const product = await mutateChildren(req, (current) => [...prepared, ...current]);
  res.status(201).json({ success: true, data: { product } });
}

export async function updateProductChild(req, res) {
  const { entryId } = req.params;
  const product = await mutateChildren(req, (current) => {
    const idx = current.findIndex((x) => x?.id === entryId);
    if (idx === -1) throw ApiError.notFound('Entry not found');
    const next = [...current];
    next[idx] = { ...next[idx], ...req.body.patch, id: entryId };
    return next;
  });
  res.json({ success: true, data: { product } });
}

export async function removeProductChild(req, res) {
  const { entryId } = req.params;
  const product = await mutateChildren(req, (current) => {
    const next = current.filter((x) => x?.id !== entryId);
    if (next.length === current.length) throw ApiError.notFound('Entry not found');
    return next;
  });
  res.json({ success: true, data: { product } });
}

export { CHILD_FIELDS };
