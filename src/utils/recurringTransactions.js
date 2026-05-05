export const RECURRING_FREQUENCIES = [
  { value: 'weekly', label: 'WEEKLY' },
  { value: 'biweekly', label: 'BIWEEKLY' },
  { value: 'monthly', label: 'MONTHLY' },
  { value: 'quarterly', label: 'QUARTERLY' },
  { value: 'yearly', label: 'YEARLY' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function localDateKey(value = Date.now()) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseLocalDate(value, fallback = new Date()) {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function clampDayForMonth(year, monthZeroIndexed, day) {
  return Math.min(day, new Date(year, monthZeroIndexed + 1, 0).getDate());
}

export function addRecurringInterval(dateValue, frequency = 'monthly') {
  const date = parseLocalDate(dateValue);
  if (frequency === 'weekly') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7, 12, 0, 0, 0);
  if (frequency === 'biweekly') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 14, 12, 0, 0, 0);
  if (frequency === 'yearly') {
    const year = date.getFullYear() + 1;
    const month = date.getMonth();
    return new Date(year, month, clampDayForMonth(year, month, date.getDate()), 12, 0, 0, 0);
  }
  const months = frequency === 'quarterly' ? 3 : 1;
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1, 12, 0, 0, 0);
  target.setDate(clampDayForMonth(target.getFullYear(), target.getMonth(), date.getDate()));
  return target;
}

export function getNextRecurringDate(template = {}, afterValue = Date.now()) {
  const after = parseLocalDate(afterValue);
  let next = parseLocalDate(template.nextDueDate || template.startDate || Date.now());
  let guard = 0;
  while (next.getTime() <= after.getTime() && guard < 240) {
    next = addRecurringInterval(next, template.frequency || 'monthly');
    guard += 1;
  }
  return next;
}

export function advanceRecurringTemplate(template = {}, fromValue = null) {
  const from = fromValue
    ? parseLocalDate(fromValue)
    : parseLocalDate(template.nextDueDate || template.startDate || Date.now());
  return localDateKey(addRecurringInterval(from, template.frequency || 'monthly'));
}

export function normalizeRecurringTransaction(input = {}, existing = null) {
  const now = Date.now();
  const amountCents = Math.max(0, Math.floor(Number(input.amountCents ?? existing?.amountCents ?? 0) || 0));
  const direction = input.direction === 'income' || existing?.direction === 'income' ? 'income' : 'expense';
  const frequency = RECURRING_FREQUENCIES.some(item => item.value === input.frequency)
    ? input.frequency
    : existing?.frequency || 'monthly';
  const startDate = input.startDate || existing?.startDate || input.nextDueDate || localDateKey(now);
  const nextDueDate = input.nextDueDate || existing?.nextDueDate || startDate;

  return {
    ...(existing || {}),
    ...input,
    id: input.id || existing?.id || `recurring_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title: String(input.title ?? existing?.title ?? '').trim(),
    amountCents,
    direction,
    category: String(input.category ?? existing?.category ?? '').trim(),
    accountKey: input.accountKey || existing?.accountKey || null,
    scope: input.scope || existing?.scope || 'personal',
    frequency,
    startDate: localDateKey(parseLocalDate(startDate)),
    nextDueDate: localDateKey(parseLocalDate(nextDueDate)),
    reminderEnabled: input.reminderEnabled !== undefined ? input.reminderEnabled !== false : existing?.reminderEnabled !== false,
    reminderDaysBefore: Math.max(0, Math.min(30, parseInt(input.reminderDaysBefore ?? existing?.reminderDaysBefore ?? 1, 10) || 0)),
    reminderHour: Math.max(0, Math.min(23, parseInt(input.reminderHour ?? existing?.reminderHour ?? 9, 10) || 9)),
    notes: String(input.notes ?? existing?.notes ?? '').trim(),
    isActive: input.isActive !== undefined ? input.isActive !== false : existing?.isActive !== false,
    deleted: input.deleted === true || existing?.deleted === true,
    createdAt: existing?.createdAt || input.createdAt || now,
    updatedAt: now,
  };
}

export function getRecurringTransactionEventsBetween(templates = [], startMs, endMs) {
  const events = [];
  for (const template of templates || []) {
    if (!template || template.deleted || template.isActive === false || !template.title) continue;
    let cursor = parseLocalDate(template.nextDueDate || template.startDate || Date.now());
    if (!Number.isFinite(cursor.getTime())) continue;
    let guard = 0;
    while (cursor.getTime() < startMs && guard < 240) {
      cursor = addRecurringInterval(cursor, template.frequency || 'monthly');
      guard += 1;
    }
    while (cursor.getTime() <= endMs && guard < 360) {
      events.push({
        ...template,
        id: `${template.id}_${localDateKey(cursor)}`,
        templateId: template.id,
        dateMs: cursor.getTime(),
        amountCents: template.amountCents || 0,
      });
      cursor = addRecurringInterval(cursor, template.frequency || 'monthly');
      guard += 1;
    }
  }
  return events;
}

export function getReminderDate(template = {}) {
  if (template.reminderEnabled === false) return null;
  const due = parseLocalDate(template.nextDueDate || template.startDate || Date.now());
  const reminder = new Date(due.getTime() - (Math.max(0, template.reminderDaysBefore || 0) * DAY_MS));
  reminder.setHours(Math.max(0, Math.min(23, template.reminderHour ?? 9)), 0, 0, 0);
  return reminder;
}

export function recurringScopeMatches(template = {}, scope = null) {
  if (!scope || scope === 'dashboard') return true;
  return template.scope === scope;
}
