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

export const getIncomeEventsBetween = (incomeEvents, startMs, endMs) => {
  const events = [];
  if (!incomeEvents) return events;

  const {
    nextPaycheckDate,
    paycheckAmountCents = 0,
    payFrequency,
    partnerDepositAmountCents = 0,
    partnerDepositSchedule,
    partnerDepositLastReceivedMonth,
  } = incomeEvents;

  // Operator paycheck — bi-weekly forward walk from nextPaycheckDate
  if (nextPaycheckDate != null && paycheckAmountCents > 0) {
    let cursor = nextPaycheckDate;
    // Walk backward to find first occurrence >= startMs
    while (cursor > startMs) cursor -= 14 * 24 * 60 * 60 * 1000;
    while (cursor < startMs) cursor += 14 * 24 * 60 * 60 * 1000;

    while (cursor <= endMs) {
      events.push({
        dateMs: cursor,
        source: 'operator_paycheck',
        amountCents: paycheckAmountCents,
        accountKey: 'entChecking',
      });
      cursor += 14 * 24 * 60 * 60 * 1000;
    }
  }

  // Partner deposit — one per month
  if (partnerDepositAmountCents > 0) {
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
            accountKey: 'jointChecking',
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
}) => {
  const now = Date.now();
  const billEvents = getBillEventsBetween(bills, now, targetDateMs);
  const incomeEvts = getIncomeEventsBetween(incomeEvents, now, targetDateMs);
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
}) => {
  const now = Date.now();
  let minimumBalance = currentBalance;
  let minimumDate = null;
  let dipsBelowFloor = false;

  for (let d = 1; d <= daysAhead; d++) {
    const targetDateMs = now + d * 24 * 60 * 60 * 1000;
    const { projectedBalance } = projectBalance({
      currentBalance,
      accountKey,
      targetDateMs,
      bills,
      incomeEvents,
    });
    if (projectedBalance < minimumBalance) {
      minimumBalance = projectedBalance;
      minimumDate = targetDateMs;
    }
    if (projectedBalance < floorCents) {
      dipsBelowFloor = true;
    }
  }

  return { minimumBalance, minimumDate, dipsBelowFloor };
};

const PROFILE_ACCOUNTS = {
  household: ['jointChecking'],
  personal: ['entChecking', 'entSavings', 'venmo', 'cash'],
  business: [],
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
  now = Date.now(),
}) => {
  if (profile === 'business') {
    return { balance: 0, variance: 0, state: 'neutral', annotation: '—', dipPeriod: null, redDate: null };
  }

  const profileAccounts = PROFILE_ACCOUNTS[profile] || [];
  const currentBalance = profileAccounts.reduce((sum, key) => sum + (accounts[key] || 0), 0);

  const cycleId = getCurrentCycleId(now);
  const { endMs } = getCycleBounds(cycleId);
  const redThreshold = varianceConfig.redThresholdCents ?? -30000;

  // Remaining bills this cycle: not yet paid, expectedDay >= today's day
  const today = new Date(now).getDate();
  const allBills = bills || [];
  const remainingBills = allBills
    .filter(b => {
      if (b.isActive === false) return false;
      if (!profileAccounts.includes(b.defaultAccountKey || 'jointChecking')) return false;
      const day = b.expectedDay || b.dueDay || 1;
      if (day < today) return false;
      const cycleMonth = cycleId;
      if (b.lastPaidMonth === cycleMonth) return false;
      return true;
    })
    .reduce((sum, b) => sum + (b.lastPaidAmountCents != null ? b.lastPaidAmountCents : b.amountCents), 0);

  // Remaining grocery (household only)
  const groceryWeeklyLimit = groceryBudget?.weeklyLimit || 0;
  const remainingGrocery = profile === 'household'
    ? weeksRemainingInCycle(now) * groceryWeeklyLimit
    : 0;

  // Projected income remaining (income events for this profile's accounts, now → end of cycle)
  const incomeEvts = getIncomeEventsBetween(incomeEvents, now, endMs);
  const projectedIncomeRemaining = incomeEvts
    .filter(e => profileAccounts.includes(e.accountKey))
    .reduce((sum, e) => sum + e.amountCents, 0);

  const variance = (currentBalance + projectedIncomeRemaining) - (remainingBills + remainingGrocery);

  // Find minimum projected balance for primary account
  const primaryAccount = profileAccounts[0];
  const primaryBalance = accounts[primaryAccount] || 0;
  const primaryFloor = accountFloors[primaryAccount] ?? (accountFloors.others ?? 0);

  const { minimumBalance, minimumDate, dipsBelowFloor } = findMinimumProjectedBalance({
    currentBalance: primaryBalance,
    accountKey: primaryAccount,
    bills: allBills,
    incomeEvents,
    daysAhead: 14,
    floorCents: primaryFloor,
  });

  const dipPeriod = dipsBelowFloor && minimumDate
    ? { startMs: minimumDate, endMs: minimumDate + 3 * 24 * 60 * 60 * 1000 }
    : null;

  const redDate = variance <= redThreshold && minimumDate ? minimumDate : null;

  // State classification
  let state;
  if (variance <= redThreshold || (redDate !== null)) {
    state = 'red';
  } else if (dipsBelowFloor) {
    state = 'yellow';
  } else if (variance >= 0) {
    state = 'green';
  } else {
    state = 'yellow';
  }

  // Annotation
  let annotation;
  if (state === 'green') {
    annotation = variance > 50000 ? 'On track for rollover' : 'On track';
  } else if (state === 'yellow') {
    if (dipPeriod) {
      annotation = `Tight: ${formatAnnotationDate(dipPeriod.startMs)}–${formatAnnotationDate(dipPeriod.endMs)}`;
    } else {
      annotation = 'Margin thin';
    }
  } else if (state === 'red') {
    if (redDate) {
      annotation = `Deposit needed by ${formatAnnotationDate(redDate)}`;
    } else {
      annotation = `Variance: -${formatCentsShort(Math.abs(variance))}`;
    }
  } else {
    annotation = '—';
  }

  return { balance: currentBalance, variance, state, annotation, dipPeriod, redDate };
};
