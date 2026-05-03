import { addMonthsClamped, getCurrentWeekStart } from './dates';
import { formatCentsShort } from './currency';

export const getLastDayOfMonth = (year, monthZeroIndexed) => {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
};

export const getCurrentCycleId = (now = Date.now()) => {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const getCycleBounds = (cycleId) => {
  const [y, m] = cycleId.split('-').map(Number);
  const startMs = new Date(y, m - 1, 1, 0, 0, 0, 0).getTime();
  const endMs = new Date(y, m, 0, 23, 59, 59, 999).getTime();
  return { startMs, endMs };
};

export const weeksRemainingInCycle = (now = Date.now()) => {
  const d = new Date(now);
  const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  const msRemaining = endOfMonth.getTime() - now;
  return Math.ceil(msRemaining / (7 * 24 * 60 * 60 * 1000));
};

export const getBillEventsBetween = (bills, startMs, endMs) => {
  const events = [];
  if (!bills || bills.length === 0) return events;

  const startDate = new Date(startMs);
  const endDate = new Date(endMs);

  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();

  for (const bill of bills) {
    if (!isBillActiveForProjection(bill)) continue;

    const day = bill.expectedDay || bill.dueDay || 1;
    const accountKey = bill.accountKey || bill.defaultAccountKey || null;

    let y = startYear;
    let m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      const lastDay = getLastDayOfMonth(y, m);
      const actualDay = Math.min(day, lastDay);
      const dateMs = new Date(y, m, actualDay, 12, 0, 0, 0).getTime();

      if (dateMs >= startMs && dateMs <= endMs) {
        const cycleId = `${y}-${String(m + 1).padStart(2, '0')}`;
        const skipPaid = billPaidInCycle(bill, cycleId);
        if (!skipPaid) {
          const amountCents = bill.lastPaidAmountCents != null ? bill.lastPaidAmountCents : (bill.amountCents ?? bill.amount ?? 0);
          if (amountCents > 0) {
            events.push({ dateMs, billId: bill.id, billName: bill.name, amountCents, accountKey });
          }
        }
      }

      m++;
      if (m > 11) { m = 0; y++; }
    }
  }

  return events;
};

export const PROJECTION_ACCOUNT_KEYS = [
  'jointChecking',
  'entChecking',
  'entSavings',
  'venmo',
  'cash',
  'cleaningChecking',
];

function asDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parts = value.split('-').map(Number);
    if (parts.length === 3 && parts.every(Boolean)) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }
  return new Date(value);
}

function startOfLocalDayMs(value) {
  const d = asDate(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

function endOfLocalDayMs(value) {
  const d = asDate(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

function localNoonMs(year, monthZeroIndexed, day) {
  return new Date(year, monthZeroIndexed, day, 12, 0, 0, 0).getTime();
}

function toDateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toCycleId(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildProjectionSnapshot(accounts = {}) {
  const snapshot = {};
  for (const key of PROJECTION_ACCOUNT_KEYS) {
    snapshot[key] = accounts[key] || 0;
  }
  for (const key of Object.keys(accounts || {})) {
    snapshot[key] = accounts[key] || 0;
  }
  return snapshot;
}

function isBillActiveForProjection(bill) {
  return bill && bill.active !== false && bill.isActive !== false && bill.deleted !== true;
}

function billPaidInCycle(bill, cycleId) {
  if (!bill) return false;
  if (bill.lastPaidMonth === cycleId || bill.paidMonth === cycleId) return true;
  const paidDate = bill.paidDate || bill.lastPaidDate;
  if (!paidDate) return false;
  const paidMs = typeof paidDate === 'number' ? paidDate : new Date(paidDate).getTime();
  return Number.isFinite(paidMs) && toCycleId(paidMs) === cycleId;
}

function getProjectionBillEvents(bills, startMs, endMs, fallbackAccountKey) {
  const events = [];
  if (!Array.isArray(bills) || bills.length === 0) return events;

  const startDate = new Date(startMs);
  const endDate = new Date(endMs);
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();

  for (const bill of bills) {
    if (!isBillActiveForProjection(bill)) continue;
    const amountCents = bill.amountCents ?? bill.amount ?? 0;
    if (amountCents <= 0) continue;

    const scheduledDay = Math.max(1, Math.min(31, parseInt(bill.expectedDay || bill.dueDay || 1, 10) || 1));
    const accountKey = bill.accountKey || bill.defaultAccountKey || fallbackAccountKey;

    let y = startDate.getFullYear();
    let m = startDate.getMonth();
    while (y < endYear || (y === endYear && m <= endMonth)) {
      const actualDay = Math.min(scheduledDay, getLastDayOfMonth(y, m));
      const dateMs = localNoonMs(y, m, actualDay);
      const cycleId = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (dateMs >= startMs && dateMs <= endMs && !billPaidInCycle(bill, cycleId)) {
        events.push({
          dateMs,
          dateKey: toDateKey(dateMs),
          amountCents,
          accountKey,
          billId: bill.id,
          billName: bill.name,
        });
      }

      m++;
      if (m > 11) { m = 0; y++; }
    }
  }

  return events;
}

function getProjectionIncomeAccountKey(event) {
  return event?.accountKey
    || event?.accountId
    || event?.destinationAccountKey
    || event?.destinationAccountId
    || 'entChecking';
}

function resolveRegistryAccountKey(accountRef, accountRegistry = [], fallback = null) {
  if (!accountRef) return fallback;
  const found = (accountRegistry || []).find(account =>
    account &&
    (account.id === accountRef || account.legacyKey === accountRef)
  );
  return found ? (found.legacyKey || found.id) : accountRef;
}

function getPaycheckSplits(novaConfig = {}) {
  return Array.isArray(novaConfig?.paycheckSplits)
    ? novaConfig.paycheckSplits.filter(split => (split?.amountCents || 0) > 0)
    : [];
}

function addEventByDate(target, event) {
  const key = event.dateKey || toDateKey(event.dateMs);
  if (!target.has(key)) target.set(key, []);
  target.get(key).push(event);
}

export function projectAccountBalances(
  startDate,
  endDate,
  accounts = {},
  householdBills = [],
  personalBills = [],
  incomeEvents = {},
  massageIncome = [],
  cleaningIncome = [],
  accountRegistry = [],
  novaConfig = {},
  userMode = null,
) {
  // Business income has no recurring schedule yet; accepted for API compatibility.

  const startMs = startOfLocalDayMs(startDate);
  const endMs = endOfLocalDayMs(endDate);
  const projections = new Map();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return projections;
  }

  const balances = buildProjectionSnapshot(accounts);
  const incomeByDay = new Map();
  const billByDay = new Map();

  getIncomeEventsBetween(incomeEvents, startMs, endMs, accountRegistry, userMode, novaConfig).forEach(event => {
    const amountCents = event.amountCents ?? event.amount ?? 0;
    if (amountCents <= 0) return;
    addEventByDate(incomeByDay, {
      ...event,
      amountCents,
      accountKey: resolveRegistryAccountKey(getProjectionIncomeAccountKey(event), accountRegistry, 'entChecking'),
    });
  });

  const householdFallback = getAccountKeyByRole('household', accountRegistry, 'jointChecking');
  const personalFallback = getAccountKeyByRole('personal', accountRegistry, 'entChecking');

  [
    ...getProjectionBillEvents(householdBills, startMs, endMs, householdFallback),
    ...getProjectionBillEvents(personalBills, startMs, endMs, personalFallback),
  ].forEach(event => addEventByDate(billByDay, event));

  const cursorDate = new Date(startMs);
  while (cursorDate.getTime() <= endMs) {
    const dayMs = cursorDate.getTime();
    const dateKey = toDateKey(dayMs);

    for (const event of incomeByDay.get(dateKey) || []) {
      const accountKey = event.accountKey || 'entChecking';
      balances[accountKey] = (balances[accountKey] || 0) + event.amountCents;
    }

    for (const event of billByDay.get(dateKey) || []) {
      const accountKey = event.accountKey || 'jointChecking';
      balances[accountKey] = (balances[accountKey] || 0) - event.amountCents;
    }

    projections.set(dateKey, { ...balances });
    cursorDate.setDate(cursorDate.getDate() + 1);
  }

  return projections;
}

function addPayFrequency(cursorMs, payFrequency) {
  if (payFrequency === 'weekly') return cursorMs + 7 * 24 * 60 * 60 * 1000;
  if (payFrequency === 'monthly') return addMonthsClamped(cursorMs, 1);
  return cursorMs + 14 * 24 * 60 * 60 * 1000;
}

function subtractPayFrequency(cursorMs, payFrequency) {
  if (payFrequency === 'weekly') return cursorMs - 7 * 24 * 60 * 60 * 1000;
  if (payFrequency === 'monthly') return addMonthsClamped(cursorMs, -1);
  return cursorMs - 14 * 24 * 60 * 60 * 1000;
}

export function getProfileAccounts(profile, accountRegistry = []) {
  if (!accountRegistry || accountRegistry.length === 0) return [];
  return accountRegistry
    .filter(a => a.isActive !== false && a.role === profile)
    .map(a => a.legacyKey || a.id);
}

function getAccountKeyByRole(role, accountRegistry, fallback) {
  if (!accountRegistry || accountRegistry.length === 0) return fallback;
  const entry = accountRegistry.find(a => a.isActive !== false && a.role === role);
  return entry ? (entry.legacyKey || entry.id) : fallback;
}

function getFirstAccountKey(accountRegistry) {
  const entry = (accountRegistry || []).find(a => a.isActive !== false);
  return entry ? (entry.legacyKey || entry.id) : null;
}

function getIncomeAccountKey(event, accountRegistry) {
  if (event.accountKey) return event.accountKey;
  if (event.accountId) return event.accountId;
  return getAccountKeyByRole(event.role || 'personal', accountRegistry, null)
    || getAccountKeyByRole('household', accountRegistry, null)
    || getFirstAccountKey(accountRegistry);
}

function getMonthlyEventDate(year, monthZeroIndexed, dayOfMonth) {
  const lastDay = getLastDayOfMonth(year, monthZeroIndexed);
  const safeDay = Math.max(1, Math.min(parseInt(dayOfMonth, 10) || 1, lastDay));
  return new Date(year, monthZeroIndexed, safeDay, 12, 0, 0, 0).getTime();
}

export const getIncomeEventsBetween = (incomeEvents, startMs, endMs, accountRegistry = [], userMode = null, novaConfig = {}) => {
  const events = [];
  if (!incomeEvents) return events;

  const nextPaycheckDate = incomeEvents.nextPaycheckDate;
  const paycheckAmountCents = incomeEvents.paycheckAmountCents ?? incomeEvents.paycheckAmount ?? 0;
  const payFrequency = incomeEvents.payFrequency ?? incomeEvents.paycheckFrequency ?? 'biweekly';
  const scheduledIncomeEvents = Array.isArray(incomeEvents.scheduledIncomeEvents)
    ? incomeEvents.scheduledIncomeEvents
    : [];
  const partnerDepositAmountCents = incomeEvents.partnerDepositAmountCents ?? incomeEvents.partnerDepositAmount ?? 0;
  const partnerDepositLastReceivedMonth = incomeEvents.partnerDepositLastReceivedMonth;

  const paycheckAccountKey = getAccountKeyByRole('personal', accountRegistry, null);
  const paycheckSplits = getPaycheckSplits(novaConfig);

  // Operator paycheck - forward walk using configured pay frequency
  if (nextPaycheckDate != null && paycheckAmountCents > 0 && payFrequency !== 'unscheduled') {
    let cursor = nextPaycheckDate;
    while (cursor > startMs) cursor = subtractPayFrequency(cursor, payFrequency);
    while (cursor < startMs) cursor = addPayFrequency(cursor, payFrequency);

    while (cursor <= endMs) {
      if (paycheckSplits.length > 0) {
        for (const split of paycheckSplits) {
          const amountCents = Math.floor(split.amountCents || 0);
          const splitAccountKey = resolveRegistryAccountKey(
            split.accountKey || split.accountId || split.id,
            accountRegistry,
            paycheckAccountKey,
          );
          if (amountCents <= 0 || !splitAccountKey) continue;
          events.push({
            dateMs: cursor,
            source: 'operator_paycheck_split',
            label: split.label || 'Paycheck split',
            amountCents,
            accountKey: splitAccountKey,
          });
        }
      } else {
        events.push({
          dateMs: cursor,
          source: 'operator_paycheck',
          label: 'Primary income',
          amountCents: paycheckAmountCents,
          accountKey: paycheckAccountKey,
        });
      }
      cursor = addPayFrequency(cursor, payFrequency);
    }
  }

  // Scheduled income events, with a legacy contribution fallback for existing installs.
  const incomeSchedule = scheduledIncomeEvents.length > 0
    ? scheduledIncomeEvents
    : (
      userMode !== 'solo' && partnerDepositAmountCents > 0
        ? [{
          id: 'legacy_partner_deposit',
          label: 'Imported contribution',
          amountCents: partnerDepositAmountCents,
          frequency: 'monthly',
          dayOfMonth: 31,
          role: 'household',
          lastReceivedCycle: partnerDepositLastReceivedMonth,
          isActive: true,
        }]
        : []
    );

  for (const event of incomeSchedule) {
    if (!event || event.isActive === false) continue;
    const amountCents = event.amountCents ?? event.amount ?? 0;
    if (amountCents <= 0) continue;
    const frequency = event.frequency || 'monthly';
    if (frequency === 'unscheduled') continue;
    const accountKey = resolveRegistryAccountKey(
      getIncomeAccountKey(event, accountRegistry),
      accountRegistry,
      getFirstAccountKey(accountRegistry),
    );
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    if (frequency === 'monthly') {
      let y = startDate.getFullYear();
      let m = startDate.getMonth();
      const endY = endDate.getFullYear();
      const endM = endDate.getMonth();

      while (y < endY || (y === endY && m <= endM)) {
        const cycleId = `${y}-${String(m + 1).padStart(2, '0')}`;
        if (event.lastReceivedCycle !== cycleId) {
          const dateMs = getMonthlyEventDate(y, m, event.dayOfMonth || 1);
          if (dateMs >= startMs && dateMs <= endMs) {
            events.push({
              dateMs,
              source: 'scheduled_income',
              label: event.label || 'Scheduled income',
              amountCents,
              accountKey,
              eventId: event.id,
            });
          }
        }
        m++;
        if (m > 11) { m = 0; y++; }
      }
    } else {
      let cursor = event.nextDate || getMonthlyEventDate(startDate.getFullYear(), startDate.getMonth(), event.dayOfMonth || startDate.getDate());
      while (cursor > startMs) cursor = subtractPayFrequency(cursor, frequency);
      while (cursor < startMs) cursor = addPayFrequency(cursor, frequency);

      while (cursor <= endMs) {
        events.push({
          dateMs: cursor,
          source: 'scheduled_income',
          label: event.label || 'Scheduled income',
          amountCents,
          accountKey,
          eventId: event.id,
        });
        cursor = addPayFrequency(cursor, frequency);
      }
    }
  }


  return events;
};

export const getRemainingGroceryReserve = (groceryBudget, now = Date.now(), targetDateMs = null) => {
  const weeklyLimit = groceryBudget?.weeklyLimit || 0;
  if (weeklyLimit <= 0) return 0;

  const target = targetDateMs || getCycleBounds(getCurrentCycleId(now)).endMs;
  if (target <= now) return 0;

  const currentWeekStart = getCurrentWeekStart(now);
  const storedWeekStart = groceryBudget?.weekStartDate || currentWeekStart;
  const currentWeekSpend = storedWeekStart < currentWeekStart ? 0 : (groceryBudget?.currentWeekSpend || 0);
  const currentWeekRemaining = Math.max(weeklyLimit - currentWeekSpend, 0);

  let reserve = currentWeekRemaining;
  let cursor = currentWeekStart + 7 * 24 * 60 * 60 * 1000;
  while (cursor <= target) {
    reserve += weeklyLimit;
    cursor += 7 * 24 * 60 * 60 * 1000;
  }

  return reserve;
};

export function getGroceryReserveForDate({ targetDateMs, now = Date.now(), groceryBudget }) {
  return getRemainingGroceryReserve(groceryBudget, now, targetDateMs);
}

export const projectBalance = ({
  currentBalance,
  accountKey,
  targetDateMs,
  bills,
  incomeEvents,
  groceryWeeklyLimit = 0,
  groceryAccountKey = null,
  groceryBudget = null,
  accountRegistry = [],
  userMode = null,
  novaConfig = {},
}) => {
  const now = Date.now();
  const billEvents = getBillEventsBetween(bills, now, targetDateMs);
  const incomeEvts = getIncomeEventsBetween(incomeEvents, now, targetDateMs, accountRegistry, userMode, novaConfig);
  const eventLog = [];

  let balance = currentBalance;

  // Grocery deduction: one deduction per week remaining until targetDateMs
  if (accountKey === groceryAccountKey && groceryWeeklyLimit > 0) {
    const groceryDeduction = groceryBudget
      ? getRemainingGroceryReserve(groceryBudget, now, targetDateMs)
      : Math.ceil((targetDateMs - now) / (7 * 24 * 60 * 60 * 1000)) * groceryWeeklyLimit;
    balance -= groceryDeduction;
    eventLog.push({ type: 'grocery', amountCents: -groceryDeduction });
  }

  for (const evt of incomeEvts) {
    if (evt.accountKey === accountKey) {
      balance += evt.amountCents;
      eventLog.push({ type: 'income', ...evt });
    }
  }

  for (const evt of billEvents) {
    if (evt.accountKey === accountKey) {
      balance -= evt.amountCents;
      eventLog.push({ type: 'bill', ...evt });
    }
  }

  return { projectedBalance: balance, eventLog };
};

export const findMinimumProjectedBalance = ({
  currentBalance,
  accountKey,
  bills,
  incomeEvents,
  daysAhead = 14,
  floorCents = 0,
  groceryBudget = null,
  groceryAccountKey = null,
  accountRegistry = [],
  userMode = null,
  novaConfig = {},
}) => {
  const now = Date.now();
  const currentCycleId = getCurrentCycleId(now);
  const billsForScan = (bills || []).filter(b => !billPaidInCycle(b, currentCycleId));
  let minimumBalance = currentBalance;
  let minimumDate = null;
  let dipsBelowFloor = false;
  let triggerBillName = null;

  for (let d = 1; d <= daysAhead; d++) {
    const prevDayMs = now + (d - 1) * 24 * 60 * 60 * 1000;
    const targetDateMs = now + d * 24 * 60 * 60 * 1000;
    const { projectedBalance } = projectBalance({
      currentBalance,
      accountKey,
      targetDateMs,
      bills: billsForScan,
      incomeEvents,
      groceryWeeklyLimit: 0,
      groceryAccountKey: null,
      groceryBudget: null,
      accountRegistry,
      userMode,
      novaConfig,
    });
    if (projectedBalance < minimumBalance) {
      minimumBalance = projectedBalance;
      minimumDate = targetDateMs;
    }
    if (projectedBalance < floorCents && !dipsBelowFloor) {
      dipsBelowFloor = true;
      const dayBills = getBillEventsBetween(billsForScan, prevDayMs, targetDateMs)
        .filter(e => e.accountKey === accountKey);
      if (dayBills.length > 0) {
        dayBills.sort((a, b) => b.amountCents - a.amountCents);
        triggerBillName = dayBills[0].billName;
      }
    }
  }

  return { minimumBalance, minimumDate, dipsBelowFloor, triggerBillName };
};

function formatAnnotationDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const computeProfileVariance = ({
  profile,
  accounts,
  accountFloors = {},
  bills,
  incomeEvents,
  groceryBudget,
  varianceConfig = {},
  massageIncome = [],
  cleaningIncome = [],
  genericBusinessIncome = [],
  genericBusinessExpenses = [],
  massageExpenses = [],
  cleaningExpenses = [],
  now = Date.now(),
  accountRegistry = [],
  userMode = null,
  novaConfig = {},
}) => {
  if (profile === 'business') {
    const d = new Date(now);
    const currentMonth = d.getMonth();
    const currentYear = d.getFullYear();

    const activeIncome = [
      ...(massageIncome || []),
      ...(cleaningIncome || []),
      ...(genericBusinessIncome || []),
    ].filter(r => !r.deleted);
    const activeMassageExp = (massageExpenses || []).filter(r => !r.deleted);
    const activeCleaningExp = (cleaningExpenses || []).filter(r => !r.deleted);
    const activeGenericExp = (genericBusinessExpenses || []).filter(r => !r.deleted);
    const allExpenses = [...activeMassageExp, ...activeCleaningExp, ...activeGenericExp];

    const totalIncome = activeIncome.reduce((s, r) => s + (r.amountCents || 0), 0);
    const totalExpenses = allExpenses.reduce((s, r) => s + (r.amountCents || 0), 0);
    const balance = totalIncome - totalExpenses;

    const isThisMonth = (r) => {
      const rd = new Date(r.date);
      return rd.getMonth() === currentMonth && rd.getFullYear() === currentYear;
    };
    const monthIncome = activeIncome.filter(isThisMonth).reduce((s, r) => s + (r.amountCents || 0), 0);
    const monthExpenses = allExpenses.filter(isThisMonth).reduce((s, r) => s + (r.amountCents || 0), 0);
    const variance = monthIncome - monthExpenses;

    const redThreshold = varianceConfig?.redThresholdCents ?? -30000;
    let state, annotation;
    if (totalIncome === 0 && totalExpenses === 0) {
      state = 'neutral';
      annotation = 'No data yet';
    } else if (variance < redThreshold) {
      state = 'red';
      annotation = `Net ${formatCentsShort(variance)} this month`;
    } else if (variance < 0) {
      state = 'yellow';
      annotation = `Net ${formatCentsShort(variance)} this month`;
    } else {
      state = 'green';
      annotation = `Net +${formatCentsShort(variance)} this month`;
    }

    return { balance, variance, state, annotation, dipPeriod: null, redDate: null };
  }

  const profileAccounts = getProfileAccounts(profile, accountRegistry);
  const currentBalance = profileAccounts.reduce((sum, key) => sum + (accounts[key] || 0), 0);

  const cycleId = getCurrentCycleId(now);
  const { endMs } = getCycleBounds(cycleId);

  // Remaining bills this cycle: active, correct account, not yet paid
  const allBills = bills || [];
  const remainingBills = allBills
    .filter(b => {
      if (!isBillActiveForProjection(b)) return false;
      const billAccountKey = b.accountKey || b.defaultAccountKey;
      if (!billAccountKey || !profileAccounts.includes(billAccountKey)) return false;
      if (billPaidInCycle(b, cycleId)) return false;
      return true;
    })
    .reduce((sum, b) => sum + (b.lastPaidAmountCents != null ? b.lastPaidAmountCents : (b.amountCents ?? b.amount ?? 0)), 0);

  // Remaining grocery (household only)
  const groceryWeeklyLimit = groceryBudget?.weeklyLimit || 0;
  const groceryProfile = userMode === 'solo' ? 'personal' : 'household';
  const remainingGrocery = profile === groceryProfile
    ? getRemainingGroceryReserve(groceryBudget, now, endMs)
    : 0;

  // Projected income remaining (income events for this profile's accounts, now to end of cycle)
  const incomeEvts = getIncomeEventsBetween(incomeEvents, now, endMs, accountRegistry, userMode, novaConfig);
  const projectedIncomeRemaining = incomeEvts
    .filter(e => profileAccounts.includes(e.accountKey))
    .reduce((sum, e) => sum + e.amountCents, 0);

  const variance = (currentBalance + projectedIncomeRemaining) - (remainingBills + remainingGrocery);

  // Two-tier 14-day dip scan: yellow floor ($300) and red floor ($0)
  const primaryAccount = profileAccounts[0];
  const primaryBalance = accounts[primaryAccount] || 0;
  const yellowFloor = accountFloors[primaryAccount] ?? (accountFloors.others ?? 0);

  const { dipsBelowFloor: dipsYellow, triggerBillName: yellowTrigger } = findMinimumProjectedBalance({
    currentBalance: primaryBalance,
    accountKey: primaryAccount,
    bills: allBills,
    incomeEvents,
    daysAhead: 14,
    floorCents: yellowFloor,
    groceryBudget: null,
    groceryAccountKey: null,
    accountRegistry,
    userMode,
    novaConfig,
  });

  const { dipsBelowFloor: dipsRed, triggerBillName: redTrigger } = findMinimumProjectedBalance({
    currentBalance: primaryBalance,
    accountKey: primaryAccount,
    bills: allBills,
    incomeEvents,
    daysAhead: 14,
    floorCents: 0,
    groceryBudget: null,
    groceryAccountKey: null,
    accountRegistry,
    userMode,
    novaConfig,
  });

  const redVarianceThreshold = varianceConfig?.redThresholdCents ?? -30000;

  // State classification: immediate cash dip first, then cycle-end variance.
  let state;
  if (dipsRed || variance < redVarianceThreshold) {
    state = 'red';
  } else if (dipsYellow || variance < 0) {
    state = 'yellow';
  } else {
    state = 'green';
  }

  // Annotation
  let annotation;
  if (state === 'green') {
    annotation = variance > 50000 ? 'On track for rollover' : 'On track';
  } else if (state === 'yellow') {
    annotation = yellowTrigger ? `Enters yellow with ${yellowTrigger}` : `Projected ${formatCentsShort(variance)} by cycle end`;
  } else if (state === 'red') {
    annotation = redTrigger ? `Enters red with ${redTrigger}` : `Projected ${formatCentsShort(variance)} by cycle end`;
  } else {
    annotation = '-';
  }

  return { balance: currentBalance, variance, state, annotation, dipPeriod: null, redDate: null };
};
