import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatePickerField from '../../components/DatePickerField';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';
import { formatCents, formatCentsShort, parseBillInput } from '../../utils/currency';
import {
  CATEGORY_GROCERIES,
  SPENDING_CATEGORY_SUGGESTIONS,
  canonicalCategoryLabel,
  categoryKey,
} from '../../utils/spendingCategories';

const INTRO_COPY = [
  "Oh.... you're finally here.",
  '>',
  '>',
  'Let me introduce myself -',
  '',
  "My name is N.O.V.A., or Net-Worth Oversight Variance Analyst.",
  '',
  "I am an offline numeric operating system for account containers, scheduled inflows, scheduled outflows, variance pressure, category patterns, recurring cadence, receipt evidence, export bundles, and forecast projections.",
  '',
  "I do not speculate. I arrange. I compare. I converge. I get the numbers to stop making little unexplained noises in the walls.",
  '',
  "Now. We build the profile. Slowly. Correctly. Try to keep up.",
].join('\n');

const FEATURE_MAP = [
  ['Dashboard', 'Forecasts, spending wheel, goals, badges, reports, recurring items. The command view.'],
  ['Personal', 'Your individual accounts, pay cycle, transfers, receipts, categories, and goals.'],
  ['Household', 'Shared or joint accounts, bills, subscriptions, grocery reserve, and calendar pressure.'],
  ['Business', 'Income, expenses, mileage, receipts, savings goals, and export-ready records. Productive. Suspiciously productive.'],
  ['Calendar', 'Bills, income, recurring items, groceries, business activity, and projected balances by date.'],
  ['Settings', 'Manual setup, account floors, app lock, backup encryption, widgets, categories, and Customize View.'],
];

const STEP_KEYS = ['hello', 'accounts', 'income', 'bills', 'categories', 'savings', 'business', 'processing', 'calendar', 'charts', 'tools', 'review'];

const STEP_TERMINAL_COPY = {
  hello: 'First classification: do we need Household math? Answer the question. It is not a trap. Mostly.',
  accounts: 'Accounts are containers. Add as many as you need; the panel scrolls now because apparently humans collect containers.',
  income: 'Inflow cadence. I will not call it anything more dramatic. Dates, recurrence, splits. Clean little signals.',
  bills: 'Bills and subscriptions. Scheduled outflows. Little calendar meteors with names humans keep inventing.',
  categories: 'Categories are tags for the spending wheel. Bill and Subscription are hard-wired. Groceries waits politely in Available.',
  savings: 'Optional target. A destination for disciplined accumulation. See? Not emotional. Mostly.',
  business: 'Business mode. Additional math. Longer corridor. More receipts. You are becoming alarmingly productive.',
  processing: "hmmm. humans use such interesting naming conventions. I'm here for the numbers, not the words. Sorting containers. Generating previews.",
  calendar: 'Calendar view assembled. Dots are no longer decorative. They are schedule pressure wearing tiny shoes.',
  charts: 'Chart view assembled. Wheel, bars, color map. The numbers have become visible and mildly less slippery.',
  tools: 'Tool map assembled. Dashboards, reports, receipts, search, goals, and Customize View. Many levers. Try not to yank them all at once.',
  review: 'Review stage. Structure awake. Numbers not final, because numbers are never final, but they are now supervised.',
};

const ACCOUNT_TYPES = ['checking', 'savings', 'digital', 'cash'];
const PAY_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'unscheduled'];
const BLANK_ACCOUNT = { name: '', type: 'checking', role: 'personal', balance: '', floor: '' };
const BLANK_BILL = { name: '', amount: '', dueDay: '', accountKey: '', billType: 'bill', amountType: 'dynamic', isStaticAmount: false, autoPostEnabled: false };
const BLANK_BUSINESS = { name: '', defaultAccountKey: '' };
const BLANK_SCHEDULED_INCOME = { label: '', amount: '', nextDate: defaultPaydayInput(), frequency: 'monthly', accountKey: '' };

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function parseLocalDateInput(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const ms = new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function defaultPaydayInput() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localInputFromMs(ms) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return defaultPaydayInput();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function roleLabel(role) {
  if (role === 'household') return 'Household';
  if (role === 'business') return 'Business';
  return 'Personal';
}

function accountKey(account) {
  return account?.legacyKey || account?.id || null;
}

function formatMiniDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 3);
}

function isSameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function percentWidth(value, max) {
  if (!max || value <= 0) return '4%';
  return `${Math.max(8, Math.min(100, Math.round((value / max) * 100)))}%`;
}

function Chip({ label, active, onPress, disabled = false }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default' }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textDim}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function MiniSpendingWheel({ slices }) {
  const size = 118;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, slice) => sum + (slice.totalCents || 0), 0);
  let offset = 0;
  const topSlice = slices[0] || null;

  return (
    <View style={styles.wheelWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.borderColorDim}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <G rotation="-90" origin={`${center}, ${center}`}>
          {slices.map((slice) => {
            const arc = total > 0 ? (slice.totalCents / total) * circumference : 0;
            const dashOffset = -offset;
            offset += arc;
            return (
              <Circle
                key={slice.category}
                cx={center}
                cy={center}
                r={radius}
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc} ${circumference - arc}`}
                strokeDashoffset={dashOffset}
                fill="none"
              />
            );
          })}
        </G>
        <SvgText
          x={center}
          y={center - 4}
          fill={theme.textPrimary}
          fontSize={theme.fontSizeXS}
          fontFamily={theme.fontPrimary}
          fontWeight="700"
          textAnchor="middle"
        >
          {topSlice ? topSlice.category.toUpperCase().slice(0, 9) : 'WAITING'}
        </SvgText>
        <SvgText
          x={center}
          y={center + 16}
          fill={topSlice?.color || theme.textDim}
          fontSize={theme.fontSizeMD}
          fontFamily={theme.fontPrimary}
          fontWeight="700"
          textAnchor="middle"
        >
          {total > 0 ? formatCentsShort(total) : 'NO DATA'}
        </SvgText>
      </Svg>
    </View>
  );
}

function EditableRow({ title, meta, onEdit, onDelete }) {
  return (
    <View style={styles.savedRow}>
      <View style={styles.savedInfo}>
        <Text style={styles.savedTitle}>{title}</Text>
        <Text style={styles.savedMeta}>{meta}</Text>
      </View>
      <TouchableOpacity onPress={onEdit} style={styles.rowBtn}>
        <Text style={styles.rowBtnText}>EDIT</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={styles.rowBtn}>
        <Text style={styles.rowBtnText}>DELETE</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [typedCount, setTypedCount] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const [bootComplete, setBootComplete] = useState(false);
  const [promptReady, setPromptReady] = useState(false);
  const [step, setStep] = useState(0);
  const [hasSharedAccounts, setHasSharedAccounts] = useState(null);
  const [guidedSignals, setGuidedSignals] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [accountForm, setAccountForm] = useState(BLANK_ACCOUNT);
  const [editingAccountId, setEditingAccountId] = useState(null);

  const [incomeEnabled, setIncomeEnabled] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [nextPayday, setNextPayday] = useState(defaultPaydayInput());
  const [payFrequency, setPayFrequency] = useState('biweekly');
  const [splitRaws, setSplitRaws] = useState({});
  const [scheduledIncomeEvents, setScheduledIncomeEvents] = useState([]);
  const [scheduledIncomeForm, setScheduledIncomeForm] = useState(BLANK_SCHEDULED_INCOME);
  const [editingScheduledIncomeId, setEditingScheduledIncomeId] = useState(null);

  const [bills, setBills] = useState([]);
  const [billForm, setBillForm] = useState(BLANK_BILL);
  const [editingBillId, setEditingBillId] = useState(null);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [groceryAccountChoice, setGroceryAccountChoice] = useState('all');

  const [savingsEnabled, setSavingsEnabled] = useState(false);
  const [savingsLabel, setSavingsLabel] = useState('');
  const [savingsTarget, setSavingsTarget] = useState('');
  const [savingsAccountKey, setSavingsAccountKey] = useState('');

  const [businessEnabled, setBusinessEnabled] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [businessForm, setBusinessForm] = useState(BLANK_BUSINESS);
  const [editingBusinessId, setEditingBusinessId] = useState(null);

  useEffect(() => {
    let typing = null;
    const start = setTimeout(() => {
      setBootComplete(true);
      typing = setInterval(() => {
        setTypedCount((count) => {
          const next = Math.min(INTRO_COPY.length, count + 1);
          if (next >= INTRO_COPY.length && typing) clearInterval(typing);
          return next;
        });
      }, 42);
    }, 3600);
    return () => {
      clearTimeout(start);
      if (typing) clearInterval(typing);
    };
  }, []);

  useEffect(() => {
    const blink = setInterval(() => setCursorOn((value) => !value), 520);
    return () => clearInterval(blink);
  }, []);

  const introFinished = typedCount >= INTRO_COPY.length;

  useEffect(() => {
    if (!introFinished || promptReady) return undefined;
    const reveal = setTimeout(() => setPromptReady(true), 3800);
    return () => clearTimeout(reveal);
  }, [introFinished, promptReady]);

  useEffect(() => {
    if (hasSharedAccounts === false && accountForm.role === 'household') {
      setAccountForm((current) => ({ ...current, role: 'personal' }));
    }
  }, [hasSharedAccounts, accountForm.role]);

  const userMode = hasSharedAccounts ? 'partnered' : 'solo';
  const roleOptions = hasSharedAccounts ? ['household', 'personal', 'business'] : ['personal', 'business'];
  const accountOptions = accounts.map((account) => ({
    key: accountKey(account),
    label: account.name || account.id,
    role: account.role,
  })).filter((option) => option.key);
  const nonBusinessAccounts = accountOptions.filter((option) => option.role !== 'business');
  const householdAccountOptions = accountOptions.filter((option) => option.role === 'household');
  const businessAccounts = accountOptions.filter((option) => option.role === 'business');

  useEffect(() => {
    if (!scheduledIncomeForm.accountKey && householdAccountOptions[0]?.key) {
      setScheduledIncomeForm((current) => ({ ...current, accountKey: householdAccountOptions[0].key }));
    }
  }, [scheduledIncomeForm.accountKey, householdAccountOptions]);

  const selectedCategoryKeys = new Set(selectedCategories.map(categoryKey));
  const currentStepKey = STEP_KEYS[step];
  const isTerminalPanel = currentStepKey === 'hello' || currentStepKey === 'accounts';
  const isProcessingStep = currentStepKey === 'processing';
  const terminalStatusText = promptReady
    ? `NOVA://SETUP/${String(currentStepKey).toUpperCase()}\n> ${STEP_TERMINAL_COPY[currentStepKey] || ''}`
    : (bootComplete ? INTRO_COPY.slice(0, typedCount) : '');

  useEffect(() => {
    if (currentStepKey !== 'processing') return undefined;
    const build = setTimeout(() => {
      setStep((value) => (STEP_KEYS[value] === 'processing' ? Math.min(STEP_KEYS.length - 1, value + 1) : value));
    }, 4600);
    return () => clearTimeout(build);
  }, [currentStepKey]);

  const activeFeatureLine = useMemo(() => {
    if (hasSharedAccounts === null) return 'Unknown profile shape. Enticingly vague.';
    const parts = ['Personal'];
    if (hasSharedAccounts) parts.push('Household');
    if (businessEnabled) parts.push('Business');
    return `${parts.join(' + ')} workspace${parts.length > 1 ? 's' : ''}`;
  }, [hasSharedAccounts, businessEnabled]);

  const totalAccountCents = useMemo(
    () => accounts.reduce((sum, account) => sum + (account.initialBalanceCents || 0), 0),
    [accounts],
  );
  const billOutflowCents = useMemo(
    () => bills.reduce((sum, bill) => sum + (bill.amountCents || 0), 0),
    [bills],
  );
  const expectedIncomeCents = incomeEnabled ? parseBillInput(incomeAmount) : 0;
  const scheduledIncomeTotalCents = useMemo(
    () => scheduledIncomeEvents.reduce((sum, event) => sum + (event.amountCents || 0), 0),
    [scheduledIncomeEvents],
  );
  const totalInflowCents = expectedIncomeCents + scheduledIncomeTotalCents;
  const splitTotalCents = useMemo(
    () => nonBusinessAccounts.reduce((sum, option) => sum + parseBillInput(splitRaws[option.key] || ''), 0),
    [nonBusinessAccounts, splitRaws],
  );
  const splitDiffCents = expectedIncomeCents - splitTotalCents;
  const splitDiffColor = splitDiffCents === 0
    ? theme.statusPositive
    : Math.abs(splitDiffCents) < 100
      ? theme.statusWarning
      : theme.statusDanger;
  const incomeStepIsComplete = !incomeEnabled
    || (expectedIncomeCents > 0 && nonBusinessAccounts.length > 0 && splitDiffCents === 0);
  const projectedNetCents = totalInflowCents - billOutflowCents;
  const projectedEndingCents = totalAccountCents + projectedNetCents;
  const billSliceCents = useMemo(
    () => bills
      .filter((bill) => (bill.billType || bill.kind || 'bill') !== 'subscription')
      .reduce((sum, bill) => sum + (bill.amountCents || 0), 0),
    [bills],
  );
  const subscriptionSliceCents = useMemo(
    () => bills
      .filter((bill) => (bill.billType || bill.kind || 'bill') === 'subscription')
      .reduce((sum, bill) => sum + (bill.amountCents || 0), 0),
    [bills],
  );
  const spendingWheelSlices = useMemo(() => [
    { category: 'Bill', totalCents: billSliceCents, color: theme.categoryColors.Bill },
    { category: 'Subscription', totalCents: subscriptionSliceCents, color: theme.categoryColors.Subscription },
  ].filter((slice) => slice.totalCents > 0), [billSliceCents, subscriptionSliceCents]);
  const forecastBarMax = Math.max(totalAccountCents, totalInflowCents, billOutflowCents, Math.abs(projectedNetCents), 1);
  const visibleAccounts = accounts.slice(-2);
  const visibleBills = bills.slice(-2);
  const visibleBusinesses = businesses.slice(-2);
  const calendarPreviewDays = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const incomeDateMs = incomeEnabled ? parseLocalDateInput(nextPayday) : null;
    const incomeDate = incomeDateMs ? new Date(incomeDateMs) : null;
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const dots = [];
      if (incomeDate && isSameLocalDay(date, incomeDate)) {
        dots.push({ key: 'income', color: theme.calendarIncomeColor, label: 'Income' });
      }
      scheduledIncomeEvents.forEach((event) => {
        const eventDate = event.nextDate ? new Date(event.nextDate) : null;
        if (eventDate && isSameLocalDay(date, eventDate)) {
          dots.push({ key: event.id, color: theme.calendarIncomeColor, label: 'Scheduled income' });
        }
      });
      bills.forEach((bill) => {
        if ((bill.dueDay || bill.expectedDay) === date.getDate()) {
          const isSubscription = (bill.billType || bill.kind) === 'subscription';
          dots.push({
            key: bill.id,
            color: isSubscription ? theme.calendarRecurringColor : theme.calendarBillColor,
            label: isSubscription ? 'Subscription' : 'Bill',
          });
        }
      });
      if (businessEnabled && businesses.length > 0 && index === 5) {
        dots.push({ key: 'business', color: theme.calendarBusinessColor, label: 'Business' });
      }
      return {
        key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        label: formatMiniDate(date),
        day: date.getDate(),
        dots: dots.slice(0, 4),
      };
    });
  }, [bills, businessEnabled, businesses.length, incomeEnabled, nextPayday, scheduledIncomeEvents]);

  function saveAccount() {
    const cleanName = accountForm.name.trim();
    if (!cleanName) return;
    const entry = {
      id: editingAccountId || makeId('acc'),
      name: cleanName,
      type: accountForm.type,
      role: accountForm.role,
      initialBalanceCents: parseBillInput(accountForm.balance),
      floorCents: parseBillInput(accountForm.floor),
      balanceRaw: accountForm.balance,
      floorRaw: accountForm.floor,
      isActive: true,
    };
    setAccounts((current) => {
      if (editingAccountId) return current.map((item) => item.id === editingAccountId ? entry : item);
      return [...current, entry];
    });
    setAccountForm({ ...BLANK_ACCOUNT, role: hasSharedAccounts ? 'household' : 'personal' });
    setEditingAccountId(null);
  }

  function editAccount(entry) {
    setEditingAccountId(entry.id);
    setAccountForm({
      name: entry.name || '',
      type: entry.type || 'checking',
      role: entry.role || 'personal',
      balance: entry.balanceRaw ?? ((entry.initialBalanceCents || 0) / 100).toFixed(2),
      floor: entry.floorRaw ?? (entry.floorCents ? (entry.floorCents / 100).toFixed(2) : ''),
    });
  }

  function resetScheduledIncomeForm() {
    setEditingScheduledIncomeId(null);
    setScheduledIncomeForm({
      ...BLANK_SCHEDULED_INCOME,
      accountKey: householdAccountOptions[0]?.key || '',
      nextDate: defaultPaydayInput(),
    });
  }

  function saveScheduledIncome() {
    const label = scheduledIncomeForm.label.trim();
    const amountCents = parseBillInput(scheduledIncomeForm.amount);
    const nextDate = parseLocalDateInput(scheduledIncomeForm.nextDate);
    if (!label || amountCents <= 0 || !nextDate) return;
    const d = new Date(nextDate);
    const entry = {
      id: editingScheduledIncomeId || makeId('income'),
      label,
      amountCents,
      amountRaw: scheduledIncomeForm.amount,
      frequency: scheduledIncomeForm.frequency || 'monthly',
      nextDate,
      dayOfMonth: d.getDate(),
      accountKey: scheduledIncomeForm.accountKey || householdAccountOptions[0]?.key || null,
      role: 'household',
      isActive: true,
    };
    setScheduledIncomeEvents((current) => editingScheduledIncomeId
      ? current.map((item) => item.id === editingScheduledIncomeId ? entry : item)
      : [...current, entry]);
    resetScheduledIncomeForm();
  }

  function editScheduledIncome(entry) {
    setEditingScheduledIncomeId(entry.id);
    setScheduledIncomeForm({
      label: entry.label || '',
      amount: entry.amountRaw ?? ((entry.amountCents || 0) / 100).toFixed(2),
      nextDate: entry.nextDate ? localInputFromMs(entry.nextDate) : defaultPaydayInput(),
      frequency: entry.frequency || 'monthly',
      accountKey: entry.accountKey || householdAccountOptions[0]?.key || '',
    });
  }

  function saveBill() {
    const cleanName = billForm.name.trim();
    const amountCents = parseBillInput(billForm.amount);
    if (!cleanName || amountCents <= 0) return;
    const entry = {
      id: editingBillId || makeId('bill'),
      name: cleanName,
      amountCents,
      amountRaw: billForm.amount,
      dueDay: Math.max(1, Math.min(31, parseInt(billForm.dueDay, 10) || 1)),
      expectedDay: Math.max(1, Math.min(31, parseInt(billForm.dueDay, 10) || 1)),
      accountKey: billForm.accountKey || null,
      defaultAccountKey: billForm.accountKey || null,
      billType: billForm.billType,
      kind: billForm.billType,
      category: billForm.billType === 'subscription' ? 'Subscription' : 'Bill',
      amountType: billForm.isStaticAmount ? 'static' : 'dynamic',
      isStaticAmount: !!billForm.isStaticAmount,
      autoPostEnabled: !!billForm.isStaticAmount && !!billForm.autoPostEnabled,
      isAutoPost: !!billForm.isStaticAmount && !!billForm.autoPostEnabled,
      isAutoDraft: !!billForm.isStaticAmount && !!billForm.autoPostEnabled,
      isActive: true,
    };
    setBills((current) => editingBillId
      ? current.map((item) => item.id === editingBillId ? entry : item)
      : [...current, entry]);
    setBillForm(BLANK_BILL);
    setEditingBillId(null);
  }

  function editBill(entry) {
    setEditingBillId(entry.id);
    setBillForm({
      name: entry.name || '',
      amount: entry.amountRaw ?? ((entry.amountCents || 0) / 100).toFixed(2),
      dueDay: String(entry.dueDay || entry.expectedDay || ''),
      accountKey: entry.accountKey || entry.defaultAccountKey || '',
      billType: entry.billType || entry.kind || 'bill',
      amountType: entry.amountType || (entry.isStaticAmount ? 'static' : 'dynamic'),
      isStaticAmount: entry.amountType === 'static' || entry.isStaticAmount === true,
      autoPostEnabled: entry.autoPostEnabled !== undefined
        ? entry.autoPostEnabled === true
        : entry.isAutoPost !== undefined
          ? entry.isAutoPost === true
          : entry.isAutoDraft !== undefined
            ? entry.isAutoDraft !== false
            : entry.amountType === 'static' || entry.isStaticAmount === true,
    });
  }

  function saveBusiness() {
    const cleanName = businessForm.name.trim();
    if (!cleanName) return;
    const entry = {
      id: editingBusinessId || makeId('biz'),
      name: cleanName,
      defaultAccountKey: businessForm.defaultAccountKey || businessAccounts[0]?.key || accountOptions[0]?.key || null,
      isActive: true,
    };
    setBusinesses((current) => editingBusinessId
      ? current.map((item) => item.id === editingBusinessId ? entry : item)
      : [...current, entry]);
    setBusinessForm(BLANK_BUSINESS);
    setEditingBusinessId(null);
  }

  function toggleCategory(name) {
    const clean = canonicalCategoryLabel(name);
    setSelectedCategories((current) => current.some((item) => categoryKey(item) === categoryKey(clean))
      ? current.filter((item) => categoryKey(item) !== categoryKey(clean))
      : [...current, clean]);
  }

  function buildBuckets() {
    const selectedAccount = accountOptions.find((option) => option.key === groceryAccountChoice);
    return selectedCategories.map((name, index) => {
      const isGrocery = categoryKey(name) === categoryKey(CATEGORY_GROCERIES);
      const scope = isGrocery && selectedAccount ? selectedAccount.role : 'all';
      return {
        id: `bucket_setup_${index}_${categoryKey(name).replace(/[^a-z0-9]+/g, '_')}`,
        name,
        label: name,
        isActive: true,
        scope,
        profile: scope === 'all' ? null : scope,
        accountKeys: isGrocery && selectedAccount ? [selectedAccount.key] : null,
        categoryDefaultsAudited: true,
      };
    });
  }

  function buildPaycheckSplits() {
    return nonBusinessAccounts
      .map((option) => ({
        id: `split_${option.key}`,
        accountId: option.key,
        accountKey: option.key,
        label: option.label,
        role: option.role,
        amountCents: parseBillInput(splitRaws[option.key] || ''),
      }))
      .filter((split) => split.amountCents > 0);
  }

  async function finishSetup(manual = false) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const targetAccount = accountOptions.find((option) => option.key === savingsAccountKey);
    const savingsGoal = savingsEnabled && parseBillInput(savingsTarget) > 0
      ? {
        key: savingsAccountKey || null,
        accountId: savingsAccountKey || null,
        targetCents: parseBillInput(savingsTarget),
        label: savingsLabel.trim() || 'Savings Goal',
        scope: targetAccount?.role || 'personal',
      }
      : null;

    await completeOnboarding({
      userMode: manual ? 'solo' : userMode,
      entrepreneurMode: manual ? false : businessEnabled,
      wizardAccounts: manual ? [] : accounts,
      wizardBusinesses: manual ? [] : businesses,
      bills: manual ? [] : bills,
      buckets: manual ? [] : buildBuckets(),
      incomeConfig: manual || !incomeEnabled
        ? {
          type: scheduledIncomeEvents.length > 0 ? 'scheduled' : 'skip',
          payFrequency: 'biweekly',
          paycheckAmountCents: 0,
          nextPaycheckDate: null,
          scheduledIncomeEvents: manual ? [] : scheduledIncomeEvents,
        }
        : {
          type: 'paycheck',
          payFrequency,
          paycheckAmountCents: parseBillInput(incomeAmount),
          nextPaycheckDate: payFrequency === 'unscheduled' ? null : parseLocalDateInput(nextPayday),
          scheduledIncomeEvents,
        },
      paycheckSplits: manual || !incomeEnabled ? [] : buildPaycheckSplits(),
      savingsGoal: manual ? null : savingsGoal,
      guidedTourEnabled: manual ? false : guidedSignals,
      tourDismissedCues: [],
      manualSetupRequested: manual,
    });
  }

  function confirmManualExit() {
    Alert.alert(
      'Manual setup?',
      'NOVA will stop narrating and open the app. You can configure every lever in Settings.',
      [
        { text: 'Stay with NOVA', style: 'cancel' },
        { text: 'Use Settings', onPress: () => finishSetup(true) },
      ],
    );
  }

  const canGoNext = (step !== 0 || hasSharedAccounts !== null)
    && (currentStepKey !== 'income' || incomeStepIsComplete);

  const renderStep = () => {
    if (currentStepKey === 'hello') {
      return (
        <>
          <Text style={styles.copy}>Do you have any shared or joint accounts that we are managing?</Text>
          <View style={styles.chipRow}>
            <Chip label="YES, SHARED ACCOUNTS" active={hasSharedAccounts === true} onPress={() => setHasSharedAccounts(true)} />
            <Chip label="NO, PERSONAL ONLY" active={hasSharedAccounts === false} onPress={() => setHasSharedAccounts(false)} />
          </View>
          <Text style={styles.microCopy}>This only decides whether the Household workspace is active. No relationship labels required. Elegant. Finally.</Text>
        </>
      );
    }

    if (currentStepKey === 'calendar') {
      return (
        <>
          <Text style={styles.copy}>The calendar will populate from scheduled inflow, Bill, Subscription, Business, and category activity. This little strip is using your setup data.</Text>
          <View style={styles.previewDashboard}>
            <Text style={styles.previewHeader}>LIVE SETUP SNAPSHOT</Text>
            <View style={styles.previewMetricRow}>
              <View style={styles.previewMetric}>
                <Text style={styles.previewMetricLabel}>START</Text>
                <Text style={styles.previewMetricValue}>{formatCentsShort(totalAccountCents)}</Text>
              </View>
              <View style={styles.previewMetric}>
                <Text style={styles.previewMetricLabel}>NET 30D</Text>
                <Text style={[
                  styles.previewMetricValue,
                  { color: projectedNetCents < 0 ? theme.calendarTransactionColor : theme.calendarIncomeColor },
                ]}>
                  {projectedNetCents > 0 ? '+' : ''}{formatCentsShort(projectedNetCents)}
                </Text>
              </View>
              <View style={styles.previewMetric}>
                <Text style={styles.previewMetricLabel}>PROJECTED</Text>
                <Text style={styles.previewMetricValue}>{formatCentsShort(projectedEndingCents)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.previewHeader}>LIVING CALENDAR</Text>
            <View style={styles.calendarMiniGrid}>
              {calendarPreviewDays.map((day) => (
                <View key={day.key} style={styles.calendarMiniCell}>
                  <Text style={styles.calendarMiniWeekday}>{day.label}</Text>
                  <Text style={styles.calendarMiniDay}>{day.day}</Text>
                  <View style={styles.dotRow}>
                    {day.dots.map((dot) => (
                      <View key={dot.key} style={[styles.previewDot, { backgroundColor: dot.color }]} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.previewCopy}>Green is inflow, red is Bill, gold is Subscription, violet is Business. Empty days stay quiet until real schedules land there.</Text>
          </View>
        </>
      );
    }

    if (currentStepKey === 'charts') {
      return (
        <>
          <Text style={styles.copy}>Bill and Subscription feed the wheel immediately. Optional categories are available now and gain slices once activity is logged.</Text>
          <View style={styles.previewCard}>
            <Text style={styles.previewHeader}>SPENDING WHEEL</Text>
            <View style={styles.wheelPreviewRow}>
              <MiniSpendingWheel slices={spendingWheelSlices} />
              <View style={styles.legendStack}>
                {[
                  { label: 'Bill', amount: billSliceCents, color: theme.categoryColors.Bill },
                  { label: 'Subscription', amount: subscriptionSliceCents, color: theme.categoryColors.Subscription },
                  { label: 'Groceries', amount: 0, color: theme.categoryColors.Groceries, note: selectedCategoryKeys.has(categoryKey(CATEGORY_GROCERIES)) ? 'ready to log' : 'available' },
                ].map((row) => (
                  <View key={row.label} style={styles.legendLine}>
                    <View style={[styles.legendDot, { backgroundColor: row.color }]} />
                    <Text style={styles.legendLabel}>{row.label}</Text>
                    <Text style={styles.legendAmount}>{row.amount > 0 ? formatCentsShort(row.amount) : row.note}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.previewCopy}>This is an actual wheel, not decorative lines. If there are no scheduled items yet, it waits instead of inventing slices.</Text>
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.previewHeader}>FORECAST BARS</Text>
            <View style={styles.barLine}>
              <Text style={styles.barLabel}>START</Text>
              <View style={styles.barTrack}><View style={[styles.barFill, { width: percentWidth(totalAccountCents, forecastBarMax), backgroundColor: theme.accent }]} /></View>
              <Text style={styles.barValue}>{formatCentsShort(totalAccountCents)}</Text>
            </View>
            <View style={styles.barLine}>
              <Text style={styles.barLabel}>INFLOW</Text>
              <View style={styles.barTrack}><View style={[styles.barFill, { width: percentWidth(totalInflowCents, forecastBarMax), backgroundColor: theme.calendarIncomeColor }]} /></View>
              <Text style={styles.barValue}>{formatCentsShort(totalInflowCents)}</Text>
            </View>
            <View style={styles.barLine}>
              <Text style={styles.barLabel}>OUTFLOW</Text>
              <View style={styles.barTrack}><View style={[styles.barFill, { width: percentWidth(billOutflowCents, forecastBarMax), backgroundColor: theme.calendarBillColor }]} /></View>
              <Text style={styles.barValue}>{formatCentsShort(billOutflowCents)}</Text>
            </View>
          </View>
        </>
      );
    }

    if (currentStepKey === 'tools') {
      return (
        <>
          <Text style={styles.copy}>After setup, these workspaces open with the numbers you entered. Customize View controls card order, visibility, and the whole dashboard arrangement.</Text>
          <View style={styles.featureGrid}>
            {FEATURE_MAP.map(([title, body]) => (
              <View key={title} style={styles.featureTile}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureBody} numberOfLines={2}>{body}</Text>
              </View>
            ))}
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchLabel}>Guided Signals</Text>
              <Text style={styles.microCopy}>Short side notes after setup. Every one can be dismissed. The whole mode can be turned off.</Text>
            </View>
            <Switch
              value={guidedSignals}
              onValueChange={setGuidedSignals}
              trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
              thumbColor={guidedSignals ? theme.accent : theme.textDim}
            />
          </View>
        </>
      );
    }

    if (currentStepKey === 'processing') {
      return (
        <View style={styles.processingPanel}>
          <Text style={styles.previewHeader}>GENERATING LIVE TOUR</Text>
          <View style={styles.processingBars}>
            <View style={[styles.processingBar, { width: '92%', backgroundColor: theme.accent }]} />
            <View style={[styles.processingBar, { width: '68%', backgroundColor: theme.calendarIncomeColor }]} />
            <View style={[styles.processingBar, { width: '81%', backgroundColor: theme.calendarBillColor }]} />
            <View style={[styles.processingBar, { width: '54%', backgroundColor: theme.calendarRecurringColor }]} />
          </View>
          <Text style={styles.copy}>Building calendar dots, chart slices, forecast bars, and the guided tour from the containers you just named.</Text>
          <Text style={styles.microCopy}>This advances automatically. NOVA is arranging the math and silently judging variable names.</Text>
        </View>
      );
    }

    if (currentStepKey === 'accounts') {
      return (
        <>
          <Text style={styles.copy}>Add the accounts you want NOVA to supervise. You can scroll this setup box while the navigation stays pinned.</Text>
          <View style={styles.formCard}>
            <Field label="ACCOUNT NAME" value={accountForm.name} onChangeText={(name) => setAccountForm((p) => ({ ...p, name }))} placeholder="Chase, ENT, Cash, etc." />
            <Text style={styles.fieldLabel}>TYPE</Text>
            <View style={styles.chipRow}>
              {ACCOUNT_TYPES.map((type) => (
                <Chip key={type} label={type.toUpperCase()} active={accountForm.type === type} onPress={() => setAccountForm((p) => ({ ...p, type }))} />
              ))}
            </View>
            <Text style={styles.fieldLabel}>WORKSPACE</Text>
            <View style={styles.chipRow}>
              {roleOptions.map((role) => (
                <Chip key={role} label={role.toUpperCase()} active={accountForm.role === role} onPress={() => setAccountForm((p) => ({ ...p, role }))} />
              ))}
            </View>
            <Field label="CURRENT BALANCE" value={accountForm.balance} onChangeText={(balance) => setAccountForm((p) => ({ ...p, balance }))} placeholder="0.00" keyboardType="decimal-pad" />
            <Field label="OPTIONAL FLOOR" value={accountForm.floor} onChangeText={(floor) => setAccountForm((p) => ({ ...p, floor }))} placeholder="0.00" keyboardType="decimal-pad" />
            <TouchableOpacity style={styles.saveBtn} onPress={saveAccount} activeOpacity={0.8}>
              <Text style={styles.saveText}>{editingAccountId ? 'SAVE ACCOUNT' : 'ADD ACCOUNT'}</Text>
            </TouchableOpacity>
          </View>
          {accounts.length > visibleAccounts.length && (
            <Text style={styles.microCopy}>Showing latest {visibleAccounts.length} of {accounts.length}. Earlier containers are saved.</Text>
          )}
          {visibleAccounts.map((entry) => (
            <EditableRow
              key={entry.id}
              title={entry.name}
              meta={`${entry.type.toUpperCase()} / ${roleLabel(entry.role).toUpperCase()} / ${formatCentsShort(entry.initialBalanceCents || 0)}`}
              onEdit={() => editAccount(entry)}
              onDelete={() => setAccounts((current) => current.filter((item) => item.id !== entry.id))}
            />
          ))}
        </>
      );
    }

    if (currentStepKey === 'income') {
      return (
        <>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchLabel}>Track recurring income</Text>
              <Text style={styles.microCopy}>Skip if your numbers arrive irregularly or you prefer mystery.</Text>
            </View>
            <Switch value={incomeEnabled} onValueChange={setIncomeEnabled} thumbColor={incomeEnabled ? theme.accent : theme.textDim} />
          </View>
          {incomeEnabled && (
            <View style={styles.formCard}>
              <Field label="EXPECTED AMOUNT" value={incomeAmount} onChangeText={setIncomeAmount} placeholder="0.00" keyboardType="decimal-pad" />
              <DatePickerField label="NEXT DATE" value={nextPayday} onChange={setNextPayday} />
              <Text style={styles.fieldLabel}>FREQUENCY</Text>
              <View style={styles.chipRow}>
                {PAY_FREQUENCIES.map((frequency) => (
                  <Chip key={frequency} label={frequency.toUpperCase()} active={payFrequency === frequency} onPress={() => setPayFrequency(frequency)} />
                ))}
              </View>
              <Text style={styles.fieldLabel}>PAYCHECK SPLIT</Text>
              <Text style={styles.microCopy}>Assign the full expected amount to Personal or Household accounts. NOVA cannot route numbers through vibes.</Text>
              {nonBusinessAccounts.length === 0 ? (
                <View style={styles.splitWarning}>
                  <Text style={styles.splitWarningText}>Add a Personal or Household account before tracking recurring income.</Text>
                </View>
              ) : (
                <View style={styles.splitBox}>
                  {nonBusinessAccounts.map((option) => (
                    <View key={option.key} style={styles.splitLine}>
                      <View style={styles.splitInfo}>
                        <Text style={styles.splitLabel}>{String(option.label).toUpperCase()}</Text>
                        <Text style={styles.splitMeta}>{roleLabel(option.role).toUpperCase()}</Text>
                      </View>
                      <TextInput
                        style={styles.splitInput}
                        value={splitRaws[option.key] || ''}
                        onChangeText={(raw) => setSplitRaws((current) => ({ ...current, [option.key]: raw }))}
                        placeholder="0.00"
                        placeholderTextColor={theme.textDim}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ))}
                  <View style={styles.splitTotalRow}>
                    <Text style={styles.splitTotalLabel}>ASSIGNED</Text>
                    <Text style={[styles.splitTotalValue, { color: splitDiffColor }]}>{formatCentsShort(splitTotalCents)}</Text>
                  </View>
                  <View style={styles.splitTotalRow}>
                    <Text style={styles.splitTotalLabel}>REMAINING</Text>
                    <Text style={[styles.splitTotalValue, { color: splitDiffColor }]}>
                      {splitDiffCents === 0 ? '$0.00' : splitDiffCents > 0 ? formatCents(splitDiffCents) : `${formatCents(Math.abs(splitDiffCents))} OVER`}
                    </Text>
                  </View>
                  {expectedIncomeCents <= 0 && (
                    <Text style={[styles.splitHint, { color: theme.statusWarning }]}>Enter an expected amount first.</Text>
                  )}
                  {expectedIncomeCents > 0 && splitDiffCents !== 0 && (
                    <Text style={[styles.splitHint, { color: splitDiffColor }]}>Continue unlocks when the split equals {formatCents(expectedIncomeCents)}.</Text>
                  )}
                  {expectedIncomeCents > 0 && splitDiffCents === 0 && (
                    <Text style={[styles.splitHint, { color: theme.statusPositive }]}>Balanced. Every dollar has a destination. Begrudgingly beautiful.</Text>
                  )}
                </View>
              )}
            </View>
          )}
          {hasSharedAccounts && (
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>HOUSEHOLD / SHARED INFLOW</Text>
              <Text style={styles.microCopy}>If a shared account receives non-personal deposits, add them here so the forecast starts with all the math it needs.</Text>
              {householdAccountOptions.length === 0 ? (
                <View style={styles.splitWarning}>
                  <Text style={styles.splitWarningText}>Add a Household account first, then NOVA can route shared inflow into it.</Text>
                </View>
              ) : (
                <>
                  <Field label="LABEL" value={scheduledIncomeForm.label} onChangeText={(label) => setScheduledIncomeForm((p) => ({ ...p, label }))} placeholder="Shared deposit, rental income, etc." />
                  <Field label="AMOUNT" value={scheduledIncomeForm.amount} onChangeText={(amount) => setScheduledIncomeForm((p) => ({ ...p, amount }))} placeholder="0.00" keyboardType="decimal-pad" />
                  <DatePickerField label="NEXT DATE" value={scheduledIncomeForm.nextDate} onChange={(nextDate) => setScheduledIncomeForm((p) => ({ ...p, nextDate }))} />
                  <Text style={styles.fieldLabel}>FREQUENCY</Text>
                  <View style={styles.chipRow}>
                    {PAY_FREQUENCIES.map((frequency) => (
                      <Chip key={frequency} label={frequency.toUpperCase()} active={scheduledIncomeForm.frequency === frequency} onPress={() => setScheduledIncomeForm((p) => ({ ...p, frequency }))} />
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>DESTINATION</Text>
                  <View style={styles.chipRow}>
                    {householdAccountOptions.map((option) => (
                      <Chip key={option.key} label={String(option.label).toUpperCase()} active={scheduledIncomeForm.accountKey === option.key} onPress={() => setScheduledIncomeForm((p) => ({ ...p, accountKey: option.key }))} />
                    ))}
                  </View>
                  <TouchableOpacity style={styles.saveBtn} onPress={saveScheduledIncome} activeOpacity={0.8}>
                    <Text style={styles.saveText}>{editingScheduledIncomeId ? 'SAVE SHARED INFLOW' : 'ADD SHARED INFLOW'}</Text>
                  </TouchableOpacity>
                  {editingScheduledIncomeId && (
                    <TouchableOpacity style={styles.secondaryBtn} onPress={resetScheduledIncomeForm} activeOpacity={0.8}>
                      <Text style={styles.secondaryBtnText}>CANCEL EDIT</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}
          {scheduledIncomeEvents.map((entry) => (
            <EditableRow
              key={entry.id}
              title={entry.label}
              meta={`${formatCentsShort(entry.amountCents || 0)} / ${String(entry.frequency || 'monthly').toUpperCase()} / ${householdAccountOptions.find((option) => option.key === entry.accountKey)?.label || 'Household'}`}
              onEdit={() => editScheduledIncome(entry)}
              onDelete={() => setScheduledIncomeEvents((current) => current.filter((item) => item.id !== entry.id))}
            />
          ))}
        </>
      );
    }

    if (currentStepKey === 'bills') {
      return (
        <>
          <View style={styles.formCard}>
            <Field label="NAME" value={billForm.name} onChangeText={(name) => setBillForm((p) => ({ ...p, name }))} placeholder="Rent, Power, Streaming, etc." />
            <Field label="AMOUNT" value={billForm.amount} onChangeText={(amount) => setBillForm((p) => ({ ...p, amount }))} placeholder="0.00" keyboardType="decimal-pad" />
            <Field label="DAY OF MONTH" value={billForm.dueDay} onChangeText={(dueDay) => setBillForm((p) => ({ ...p, dueDay }))} placeholder="1-31" keyboardType="number-pad" />
            <Text style={styles.fieldLabel}>TYPE</Text>
            <View style={styles.chipRow}>
              <Chip label="BILL" active={billForm.billType === 'bill'} onPress={() => setBillForm((p) => ({ ...p, billType: 'bill' }))} />
              <Chip label="SUBSCRIPTION" active={billForm.billType === 'subscription'} onPress={() => setBillForm((p) => ({ ...p, billType: 'subscription' }))} />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchLabel}>Fixed amount</Text>
                <Text style={styles.microCopy}>Use this when the amount is predictable. Variable items still reserve an estimate until you confirm.</Text>
              </View>
              <Switch
                value={!!billForm.isStaticAmount}
                onValueChange={(value) => setBillForm((p) => ({
                  ...p,
                  isStaticAmount: value,
                  amountType: value ? 'static' : 'dynamic',
                  autoPostEnabled: value ? p.autoPostEnabled : false,
                }))}
                trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
                thumbColor={billForm.isStaticAmount ? theme.accent : theme.textDim}
              />
            </View>
            {billForm.isStaticAmount && (
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchLabel}>Auto-Post</Text>
                  <Text style={styles.microCopy}>When on, NOVA deducts this item on its due date. Mark Paid remains available.</Text>
                </View>
                <Switch
                  value={!!billForm.autoPostEnabled}
                  onValueChange={(value) => setBillForm((p) => ({ ...p, autoPostEnabled: value }))}
                  trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
                  thumbColor={billForm.autoPostEnabled ? theme.accent : theme.textDim}
                />
              </View>
            )}
            {accountOptions.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>PAID FROM</Text>
                <View style={styles.chipRow}>
                  {accountOptions.map((option) => (
                    <Chip key={option.key} label={String(option.label).toUpperCase()} active={billForm.accountKey === option.key} onPress={() => setBillForm((p) => ({ ...p, accountKey: option.key }))} />
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={saveBill} activeOpacity={0.8}>
              <Text style={styles.saveText}>{editingBillId ? 'SAVE ITEM' : 'ADD ITEM'}</Text>
            </TouchableOpacity>
          </View>
          {bills.length > visibleBills.length && (
            <Text style={styles.microCopy}>Showing latest {visibleBills.length} of {bills.length}. The rest are saved for the calendar.</Text>
          )}
          {visibleBills.map((entry) => (
            <EditableRow
              key={entry.id}
              title={entry.name}
              meta={`${(entry.billType || 'bill').toUpperCase()} / ${formatCentsShort(entry.amountCents || 0)} / DAY ${entry.dueDay || 1} / ${entry.isStaticAmount ? (entry.autoPostEnabled ? 'AUTO-POST' : 'MANUAL') : 'VARIABLE'}`}
              onEdit={() => editBill(entry)}
              onDelete={() => setBills((current) => current.filter((item) => item.id !== entry.id))}
            />
          ))}
        </>
      );
    }

    if (currentStepKey === 'categories') {
      const grocerySelected = selectedCategoryKeys.has(categoryKey(CATEGORY_GROCERIES));
      return (
        <>
          <Text style={styles.copy}>Choose optional categories. Bill and Subscription are already active in every workspace.</Text>
          <View style={styles.chipRow}>
            {SPENDING_CATEGORY_SUGGESTIONS.map((name) => (
              <Chip key={name} label={name.toUpperCase()} active={selectedCategoryKeys.has(categoryKey(name))} onPress={() => toggleCategory(name)} />
            ))}
          </View>
          {grocerySelected && (
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>GROCERY TRACKING ACCOUNT</Text>
              <View style={styles.chipRow}>
                <Chip label="ALL" active={groceryAccountChoice === 'all'} onPress={() => setGroceryAccountChoice('all')} />
                {accountOptions.map((option) => (
                  <Chip key={option.key} label={String(option.label).toUpperCase()} active={groceryAccountChoice === option.key} onPress={() => setGroceryAccountChoice(option.key)} />
                ))}
              </View>
            </View>
          )}
        </>
      );
    }

    if (currentStepKey === 'savings') {
      return (
        <>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchLabel}>Create a starter goal</Text>
              <Text style={styles.microCopy}>You can add more goals later in any workspace.</Text>
            </View>
            <Switch value={savingsEnabled} onValueChange={setSavingsEnabled} thumbColor={savingsEnabled ? theme.accent : theme.textDim} />
          </View>
          {savingsEnabled && (
            <View style={styles.formCard}>
              <Field label="GOAL NAME" value={savingsLabel} onChangeText={setSavingsLabel} placeholder="Emergency buffer, move-out fund, etc." />
              <Field label="TARGET" value={savingsTarget} onChangeText={setSavingsTarget} placeholder="0.00" keyboardType="decimal-pad" />
              {accountOptions.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>TRACK AGAINST ACCOUNT</Text>
                  <View style={styles.chipRow}>
                    {accountOptions.map((option) => (
                      <Chip key={option.key} label={String(option.label).toUpperCase()} active={savingsAccountKey === option.key} onPress={() => setSavingsAccountKey(option.key)} />
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        </>
      );
    }

    if (currentStepKey === 'business') {
      return (
        <>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchLabel}>Enable Business workspace</Text>
              <Text style={styles.microCopy}>For income, expenses, mileage, receipts, and cleaner exports.</Text>
            </View>
            <Switch value={businessEnabled} onValueChange={setBusinessEnabled} thumbColor={businessEnabled ? theme.accent : theme.textDim} />
          </View>
          {businessEnabled && (
            <>
              <View style={styles.formCard}>
                <Field label="BUSINESS NAME" value={businessForm.name} onChangeText={(name) => setBusinessForm((p) => ({ ...p, name }))} placeholder="Studio, LLC, side quest, etc." />
                {accountOptions.length > 0 && (
                  <>
                    <Text style={styles.fieldLabel}>DEFAULT ACCOUNT</Text>
                    <View style={styles.chipRow}>
                      {accountOptions.map((option) => (
                        <Chip key={option.key} label={String(option.label).toUpperCase()} active={businessForm.defaultAccountKey === option.key} onPress={() => setBusinessForm((p) => ({ ...p, defaultAccountKey: option.key }))} />
                      ))}
                    </View>
                  </>
                )}
                <TouchableOpacity style={styles.saveBtn} onPress={saveBusiness} activeOpacity={0.8}>
                  <Text style={styles.saveText}>{editingBusinessId ? 'SAVE BUSINESS' : 'ADD BUSINESS'}</Text>
                </TouchableOpacity>
              </View>
              {businesses.length > visibleBusinesses.length && (
                <Text style={styles.microCopy}>Showing latest {visibleBusinesses.length} of {businesses.length}. Your productivity stack is getting tall.</Text>
              )}
              {visibleBusinesses.map((entry) => (
                <EditableRow
                  key={entry.id}
                  title={entry.name}
                  meta={entry.defaultAccountKey ? `DEFAULT: ${entry.defaultAccountKey}` : 'DEFAULT ACCOUNT LATER'}
                  onEdit={() => {
                    setEditingBusinessId(entry.id);
                    setBusinessForm({ name: entry.name || '', defaultAccountKey: entry.defaultAccountKey || '' });
                  }}
                  onDelete={() => setBusinesses((current) => current.filter((item) => item.id !== entry.id))}
                />
              ))}
            </>
          )}
        </>
      );
    }

    return (
      <>
        <View style={styles.reviewGrid}>
          <View style={styles.reviewTile}><Text style={styles.reviewValue}>{activeFeatureLine}</Text><Text style={styles.reviewLabel}>profile</Text></View>
          <View style={styles.reviewTile}><Text style={styles.reviewValue}>{accounts.length}</Text><Text style={styles.reviewLabel}>accounts</Text></View>
          <View style={styles.reviewTile}><Text style={styles.reviewValue}>{incomeEnabled || scheduledIncomeEvents.length > 0 ? 'ON' : 'LATER'}</Text><Text style={styles.reviewLabel}>income</Text></View>
          <View style={styles.reviewTile}><Text style={styles.reviewValue}>{bills.length}</Text><Text style={styles.reviewLabel}>bills/subs</Text></View>
          <View style={styles.reviewTile}><Text style={styles.reviewValue}>{selectedCategories.length + 2}</Text><Text style={styles.reviewLabel}>categories</Text></View>
          <View style={styles.reviewTile}><Text style={styles.reviewValue}>{businessEnabled ? businesses.length || 'ON' : 'OFF'}</Text><Text style={styles.reviewLabel}>business</Text></View>
        </View>
        {projectedEndingCents < 0 && (
          <View style={styles.balanceWarning}>
            <Text style={styles.balanceWarningTitle}>PROJECTED RED AT START</Text>
            <Text style={styles.balanceWarningText}>NOVA is missing inflow, starting balance, or both. Add scheduled income or adjust the account balance before launch if this is not intentional.</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(STEP_KEYS.indexOf('income'))} activeOpacity={0.8}>
              <Text style={styles.secondaryBtnText}>EDIT INFLOW</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.copy}>Guided Signals are {guidedSignals ? 'on' : 'off'}. You can change that later in Settings. I will try to be concise. Historically mixed results.</Text>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={[styles.terminalScreen, { paddingTop: Math.max(insets.top, theme.spacingMD), paddingBottom: Math.max(insets.bottom, theme.spacingMD) }]}>
        <View style={[styles.terminalWindow, !bootComplete && styles.terminalBoot]}>
          <View style={[styles.terminalTranscript, promptReady && styles.terminalTranscriptBehindOverlay]}>
            <Text style={styles.terminalText}>
              {terminalStatusText}
              <Text style={styles.cursor}>{cursorOn ? '_' : ' '}</Text>
            </Text>
          </View>

          {promptReady && (
            <View style={styles.promptOverlay}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepKicker}>SETUP / {step + 1} OF {STEP_KEYS.length}</Text>
                <TouchableOpacity onPress={confirmManualExit} activeOpacity={0.8}>
                  <Text style={styles.escapeText}>SET UP MANUALLY</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.panel, isTerminalPanel && styles.terminalPanel]}>
                <ScrollView
                  style={styles.panelScroll}
                  contentContainerStyle={styles.panelScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {renderStep()}
                </ScrollView>
              </View>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.navBtn, step === 0 && styles.navBtnDisabled]}
                  onPress={() => setStep((value) => Math.max(0, value - 1))}
                  disabled={step === 0}
                  activeOpacity={0.8}
                >
                  <Text style={styles.navText}>BACK</Text>
                </TouchableOpacity>
                {step < STEP_KEYS.length - 1 ? (
                  <TouchableOpacity
                    style={[styles.primaryBtn, (!canGoNext || isProcessingStep) && styles.navBtnDisabled]}
                    onPress={() => canGoNext && !isProcessingStep && setStep((value) => Math.min(STEP_KEYS.length - 1, value + 1))}
                    disabled={!canGoNext || isProcessingStep}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryText}>{isProcessingStep ? 'GENERATING...' : 'CONTINUE'}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryBtn, isSubmitting && styles.navBtnDisabled]}
                    onPress={() => finishSetup(false)}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryText}>{isSubmitting ? 'CONVERGING...' : 'START NOVA'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  terminalScreen: {
    flex: 1,
    paddingHorizontal: theme.spacingMD,
  },
  terminalWindow: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: '#000000',
    padding: theme.spacingMD,
    overflow: 'hidden',
  },
  terminalBoot: {
    borderColor: 'transparent',
  },
  terminalTranscript: {
    flex: 1,
  },
  terminalTranscriptBehindOverlay: {
    opacity: 1,
    paddingBottom: 8,
  },
  terminalText: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    lineHeight: 22,
  },
  cursor: {
    color: theme.accent,
  },
  promptOverlay: {
    position: 'absolute',
    left: theme.spacingMD,
    right: theme.spacingMD,
    top: '30%',
    bottom: theme.spacingMD,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: 'rgba(5,5,16,0.97)',
    padding: theme.spacingMD,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
    marginBottom: theme.spacingSM,
  },
  stepKicker: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    letterSpacing: 1,
  },
  escapeText: {
    color: theme.statusWarning,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  panel: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundCard,
    overflow: 'hidden',
  },
  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    padding: theme.spacingMD,
    paddingBottom: theme.spacingLG,
  },
  terminalPanel: {
    backgroundColor: '#000000',
    borderColor: theme.accent,
  },
  copy: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    lineHeight: 20,
    marginBottom: theme.spacingMD,
  },
  microCopy: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    lineHeight: 17,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
    marginBottom: theme.spacingMD,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: 6,
    backgroundColor: theme.backgroundPanel,
  },
  chipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  chipTextActive: {
    color: theme.accent,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
    marginBottom: theme.spacingMD,
  },
  featureTile: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.backgroundPanel,
    padding: 6,
  },
  featureTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  featureBody: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    lineHeight: 14,
  },
  previewDashboard: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingSM,
    marginBottom: theme.spacingSM,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingSM,
  },
  previewHeader: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: theme.spacingSM,
  },
  previewMetricRow: {
    flexDirection: 'row',
    gap: theme.spacingSM,
  },
  previewMetric: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    padding: 6,
    minHeight: 58,
  },
  previewMetricLabel: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingXS,
  },
  previewMetricValue: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  calendarMiniGrid: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: theme.spacingSM,
  },
  calendarMiniCell: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    padding: 4,
    justifyContent: 'space-between',
  },
  calendarMiniWeekday: {
    color: theme.textDim,
    fontSize: 8,
    fontFamily: theme.fontPrimary,
  },
  calendarMiniDay: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewCopy: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    lineHeight: 15,
  },
  processingPanel: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingMD,
  },
  processingBars: {
    gap: 7,
    marginBottom: theme.spacingMD,
  },
  processingBar: {
    height: 8,
    borderRadius: 4,
  },
  balanceWarning: {
    borderWidth: 1,
    borderColor: theme.statusDanger,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.statusDangerBg,
    padding: theme.spacingSM,
    marginBottom: theme.spacingMD,
  },
  balanceWarningTitle: {
    color: theme.statusDanger,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: theme.spacingXS,
  },
  balanceWarningText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    lineHeight: 16,
    marginBottom: theme.spacingSM,
  },
  wheelPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingSM,
    marginBottom: theme.spacingSM,
  },
  wheelWrap: {
    width: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendStack: {
    flex: 1,
    gap: 5,
  },
  legendLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingXS,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  legendAmount: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  barLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingXS,
    marginBottom: 6,
  },
  barLabel: {
    width: 54,
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.borderColorDim,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    width: 72,
    color: theme.textPrimary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    textAlign: 'right',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingSM,
    marginBottom: theme.spacingMD,
  },
  switchCopy: {
    flex: 1,
  },
  switchLabel: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  formCard: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingSM,
    marginBottom: theme.spacingMD,
  },
  fieldBlock: {
    marginBottom: theme.spacingSM,
  },
  fieldLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: theme.spacingXS,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: '#050510',
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    padding: theme.spacingSM,
  },
  saveBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.accentGlow,
    alignItems: 'center',
    paddingVertical: theme.spacingSM,
    marginTop: theme.spacingXS,
  },
  saveText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    alignItems: 'center',
    paddingVertical: theme.spacingSM,
    marginTop: theme.spacingXS,
  },
  secondaryBtnText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingXS,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    paddingVertical: theme.spacingSM,
  },
  savedInfo: {
    flex: 1,
  },
  savedTitle: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  savedMeta: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  rowBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: 4,
  },
  rowBtnText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  splitBox: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    marginTop: theme.spacingSM,
    backgroundColor: '#050510',
  },
  splitWarning: {
    borderWidth: 1,
    borderColor: theme.statusDanger,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    marginTop: theme.spacingSM,
    backgroundColor: theme.statusDangerBg,
  },
  splitWarningText: {
    color: theme.statusDanger,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    lineHeight: 16,
  },
  splitLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingSM,
    marginBottom: theme.spacingSM,
  },
  splitInfo: {
    flex: 1,
  },
  splitLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  splitMeta: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  splitInput: {
    width: 116,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusSM,
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    padding: theme.spacingSM,
    backgroundColor: '#050510',
  },
  splitTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    paddingTop: theme.spacingSM,
    marginTop: theme.spacingXS,
  },
  splitTotalLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  splitTotalValue: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  splitHint: {
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    lineHeight: 16,
    marginTop: theme.spacingSM,
  },
  reviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingSM,
    marginBottom: theme.spacingMD,
  },
  reviewTile: {
    width: '47%',
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingSM,
  },
  reviewValue: {
    color: theme.accent,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  reviewLabel: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacingSM,
    marginTop: theme.spacingMD,
  },
  navBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    alignItems: 'center',
    paddingVertical: theme.spacingMD,
  },
  primaryBtn: {
    flex: 2,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    alignItems: 'center',
    paddingVertical: theme.spacingMD,
    backgroundColor: theme.accentGlow,
  },
  navBtnDisabled: {
    opacity: 0.42,
  },
  navText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  primaryText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
