// Sales planner lists (PHASE-1-ACTIVITIES.md §4). Activity types and their
// KPI groups come from the Excel tracker's Setup sheet; 'Other' is a
// free-text activity (its title says what it was).
// Must match OhMyCMO/src/utils/activities.js.

// Activity type → KPI group used by the weekly dashboard (next phase).
// null = recorded but not counted toward any KPI.
export const ACTIVITY_TYPES = {
  'New Lead': 'NEW_LEAD',
  Call: 'CALL_FOLLOWUP',
  'Follow-up (Telegram/Email)': 'CALL_FOLLOWUP',
  Meeting: 'MEETING_DEMO',
  Demo: 'MEETING_DEMO',
  'Proposal Sent': 'PROPOSAL',
  Negotiation: null,
  'Deal Won': 'DEAL_WON',
  'Deal Lost': null,
  'Customer Care': null,
  Other: null,
};

// Sale status. New = nothing done yet; Follow-up = under way, a next step is
// due; Completed; Cancelled (by hand only).
export const STATUSES = ['New', 'Follow-up', 'Completed', 'Cancelled'];
export const ACTIVITY_STATUSES = ['New', 'In progress', 'Done'];

// With activities, the sale's status follows them (§2): all New → New,
// all Done → Completed, anything in between → Follow-up.
export function statusFromActivities(activities) {
  if (activities.every((a) => a.status === 'Done')) return 'Completed';
  if (activities.every((a) => a.status === 'New')) return 'New';
  return 'Follow-up';
}

// Earliest due date among activities not yet Done — the sale's due date
// when it becomes Follow-up without one of its own. Dates as 'YYYY-MM-DD'.
export function nextActivityDue(activities) {
  return activities
    .filter((a) => a.status !== 'Done' && a.dueDate)
    .map((a) => (a.dueDate instanceof Date ? a.dueDate.toISOString().slice(0, 10) : a.dueDate))
    .sort()[0] || null;
}

export const CHANNELS = ['Field visit', 'Office visit', 'Phone', 'Telegram', 'Email', 'Online meeting'];

// The team works in Phnom Penh (UTC+7 all year, no daylight saving).
// Calendar days and "today" use its clock, not the server's.
export const TIME_ZONE = 'Asia/Phnom_Penh';
const OFFSET = '+07:00';

// 'YYYY-MM-DD' of today in Phnom Penh.
export const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE });

// Start of a Phnom Penh calendar day, as an instant.
export const dayStart = (key) => new Date(`${key}T00:00:00${OFFSET}`);

// 'YYYY-MM-DD' → Date at UTC midnight, the form Prisma stores in a @db.Date.
export const toDbDate = (key) => (key ? new Date(`${key}T00:00:00.000Z`) : key);

// Date from a @db.Date column → 'YYYY-MM-DD'.
export const dateKey = (d) => (d ? d.toISOString().slice(0, 10) : null);

// 'YYYY-MM-DD' shifted by n days.
export const addDays = (key, n) => {
  const d = toDbDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dateKey(d);
};

// Follow-up state (Excel BR-02): only a Follow-up activity with a due date
// has one; Completed and Cancelled are closed.
export function followupStatus(activity, today = todayKey()) {
  if (activity.status !== 'Follow-up') return null;
  const due = dateKey(activity.dueDate);
  if (!due) return null;
  if (due < today) return 'Overdue';
  if (due === today) return 'Today';
  return 'Upcoming';
}
