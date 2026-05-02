import { getPartnerDepositDate, getLastFridayOfMonth } from './dates';
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
    if (bill.isActive === false) continue;

    const day = bill.expectedDay || bill.dueDay || 1;
    const accountKey = bill.defaultAccountKey || 'jointChecking';

    let y = startYear;
    let m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      const lastDay = getLastDayOfMonth(y, m);
      const actualDay = Math.min(day, lastDay);
      const dateMs = new Date(y, m, actualDay, 12, 0, 0, 0).getTime();

      if (dateMs >= startMs && dateMs <= endMs) {
        const cycleId = `${y}-${String(m + 1).padStart(2, '0')}`;
        const skipPaid = bill.lastPaidMonth === cycleId;
        if (!skipPaid) {
          const amountCents = bill.lastPaidAmountCents != null ? bill.lastPaidAmountCents : bill.amountCents;
          events.push({ dateMs, billId: bill.id, billName: bill.name, amountCents, accountKey });
        }
      }

      m++;
      if (m > 11) { m = 0; y++; }
    }
  }

  return events;
};

function addPayFrequency(cursorMs, payFrequency) {
  if (payFrequency === 'weekly') return cursorMs + 7 * 24 * 60 * 60 * 1000;
  if (payFrequency === 'monthly') {
    const d = new Date(cursorMs);
    return new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()).getTime();
  }
  return cursorMs + 14 * 24 * 60 * 60 * 1000;
}

function subtractPayFrequency(cursorMs, payFrequency) {
  if (payFrequency === 'weekly') return cursorMs - 7 * 24 * 60 * 60 * 1000;
  if (payFrequency === 'monthly') {
    const d = new Date(cursorMs);
    return new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()).getTime();
  }
  return cursorMs - 14 * 24 * 60 * 60 * 1000;
}

const PROFILE_ACCOUNTS_FALLBACK = {
  household: ['jointChecking'],
  personal: ['entChecking', 'entSavings', 'venmo', 'cash'],
  business: [],
};

export function getProfileAccounts(profile, accountRegistry = []) {
  if (!accountRegistry || accountRegistry.length === 0) {
    return PROFILE_ACCOUNTS_FALLBACK[profile] || [];
  }
  return accountRegistry
    .filter(a => a.isActive !== false && a.role === profile)
    .map(a => a.legacyKey || a.id);
}

function getAccountKeyByRole(role, accountRegistry, fallback) {
  if (!accountRegistry || accountRegistry.length === 0) return fallback;
  const entry = accountRegistry.find(a => a.isActive !== false && a.role === role);
  return entry ? (entry.legacyKey || entry.id) : fallback;
}

export const getIncomeEventsBetween = (incomeEvents, startMs, endMs, accountRegistry = [], userMode = null) => {
  const events = [];
  if (!incomeEvents) return events;

  const nextPaycheckDate = incomeEvents.nextPaycheckDate;
  const paycheckAmountCents = incomeEvents.paycheckAmountCents ?? incomeEvents.paycheckAmount ?? 0;
  const payFrequency = incomeEvents.payFrequency ?? incomeEvents.paycheckFrequency ?? 'biweekly';
  const partnerDepositAmountCents = incomeEvents.partnerDepositAmountCents ?? incomeEvents.partnerDepositAmount ?? 0;
  const partnerDepositSchedule = incomeEvents.partnerDepositSchedule ?? 'last_day';
  const partnerDepositLastReceivedMonth = incomeEvents.partnerDepositLastReceivedMonth;

  const paycheckAccountKey = getAccountKeyByRole('personal', accountRegistry, 'entChecking');
  const partnerDepositAccountKey = getAccountKeyByRole('household', accountRegistry, 'jointChecking');

  // Operator paycheck — forward walk using configured pay frequency
  if (nextPaycheckDate != null && paycheckAmountCents > 0 && payFrequency !== 'unscheduled') {
    let cursor = nextPaycheckDate;
    while (cursor > startMs) cursor = subtractPayFrequency(cursor, payFrequency);
    while (cursor < startMs) cursor = addPayFrequency(cursor, payFrequency);

    while (cursor <= endMs) {
      events.push({
        dateMs: cursor,
        source: 'operator_paycheck',
        amountCents: paycheckAmountCents,
        accountKey: paycheckAccountKey,
      });
      cursor = addPayFrequency(cursor, payFrequency);
    }
  }

  // Partner deposit — one per month (skipped for solo users)
  if (userMode !== 'solo' && partnerDepositAmountCents > 0) {
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);
    let y = startDate.getFullYear();
    let m = startDate.getMonth();
    const endY = endDate.getFullYear();
    const endM = endDate.getMonth();

    while (y < endY || (y === endY && m <= endM)) {
      const cycleId = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (partnerDepositLastReceivedMonth !== cycleId) {
        let depositDate;
        if (partnerDepositSchedule === 'last_friday') {
          depositDate = getLastFridayOfMonth(y, m);
        } else {
          depositDate = getPartnerDepositDate(y, m);
        }
        const dateMs = depositDate.getTime();
        if (dateMs >= startMs && dateMs <= endMs) {
          events.push({
            dateMs,
            source: 'partner_deposit',
            amountCents: partnerDepositAmountCents,
            accountKey: partnerDepositAccountKey,
          });
        }
      }
      m++;
      if (m > 11) { m = 0; y++; }
    }
  }

  return events;
};

export const projectBalance = ({
  currentBalance,
  accountKey,
  targetDateMs,
  bills,
  incomeEvents,
  groceryWeeklyLimit = 0,
  groceryAccountKey = 'jointChecking',
  accountRegistry = [],
  userMode = null,
}) => {
  const now = Date.now();
  const billEvents = getBillEventsBetween(bills, now, targetDateMs);
  const incomeEvts = getIncomeEventsBetween(incomeEvents, now, targetDateMs, accountRegistry, userMode);
  const eventLog = [];

  let balance = currentBalance;

  // Grocery deduction: one deduction per week remaining until targetDateMs
  if (accountKey === groceryAccountKey && groceryWeeklyLimit > 0) {
    const msRange = targetDateMs - now;
    const weeksAhead = Math.ceil(msRange / (7 * 24 * 60 * 60 * 1000));
    const groceryDeduction = weeksAhead * groceryWeeklyLimit;
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
  accountRegistry = [],
  userMode = null,
}) => {
  const now = Date.now();
  const currentCycleId = getCurrentCycleId(now);
  const billsForScan = (bills || []).filter(b => b.lastPaidMonth !== currentCycleId);
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
      accountRegistry,
      userMode,
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
  massageExpenses = [],
  cleaningExpenses = [],
  now = Date.now(),
  accountRegistry = [],
  userMode = null,
}) => {
  if (profile === 'business') {
    const d = new Date(now);
    const currentMonth = d.getMonth();
    const currentYear = d.getFullYear();

    const activeIncome = (massageIncome || []).filter(r => !r.deleted);
    const activeMassageExp = (massageExpenses || []).filter(r => !r.deleted);
    const activeCleaningExp = (cleaningExpenses || []).filter(r => !r.deleted);
    const allExpenses = [...activeMassageExp, ...activeCleaningExp];

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
      if (b.isActive === false) return false;
      if (!profileAccounts.includes(b.defaultAccountKey || 'jointChecking')) return false;
      if (b.lastPaidMonth === cycleId) return false;
      return true;
    })
    .reduce((sum, b) => sum + (b.lastPaidAmountCents != null ? b.lastPaidAmountCents : b.amountCents), 0);

  // Remaining grocery (household only)
  const groceryWeeklyLimit = groceryBudget?.weeklyLimit || 0;
  const remainingGrocery = profile === 'household'
    ? weeksRemainingInCycle(now) * groceryWeeklyLimit
    : 0;

  // Projected income remaining (income events for this profile's accounts, now → end of cycle)
  const incomeEvts = getIncomeEventsBetween(incomeEvents, now, endMs, accountRegistry, userMode);
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
    accountRegistry,
    userMode,
  });

  const { dipsBelowFloor: dipsRed, triggerBillName: redTrigger } = findMinimumProjectedBalance({
    currentBalance: primaryBalance,
    accountKey: primaryAccount,
    bills: allBills,
    incomeEvents,
    daysAhead: 14,
    floorCents: 0,
    accountRegistry,
    userMode,
  });

  // State classification: red > yellow > green
  let state;
  if (dipsRed) {
    state = 'red';
  } else if (dipsYellow) {
    state = 'yellow';
  } else {
    state = 'green';
  }

  // Annotation
  let annotation;
  if (state === 'green') {
    annotation = variance > 50000 ? 'On track for rollover' : 'On track';
  } else if (state === 'yellow') {
    annotation = yellowTrigger ? `Enters yellow with ${yellowTrigger}` : 'Balance approaches limit';
  } else if (state === 'red') {
    annotation = redTrigger ? `Enters red with ${redTrigger}` : 'Deposit needed';
  } else {
    annotation = '—';
  }

  return { balance: currentBalance, variance, state, annotation, dipPeriod: null, redDate: null };
};
