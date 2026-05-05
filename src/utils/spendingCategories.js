export const CATEGORY_BILLS = 'Bill';
export const CATEGORY_SUBSCRIPTIONS = 'Subscription';
export const CATEGORY_GROCERIES = 'Groceries';
export const CATEGORY_UNCATEGORIZED = 'Uncategorized';
export const CATEGORY_OTHER = 'Other';

export const AUTO_ACTIVE_SPENDING_CATEGORIES = [
  CATEGORY_BILLS,
  CATEGORY_SUBSCRIPTIONS,
];

export const SPENDING_CATEGORY_SUGGESTIONS = [
  CATEGORY_GROCERIES,
  'Entertainment/Dining Out',
  'Transportation',
  'Health',
  'Home',
  'Business Supplies',
];

export const SPENDING_CATEGORY_COLOR_ORDER = [
  ...AUTO_ACTIVE_SPENDING_CATEGORIES,
  ...SPENDING_CATEGORY_SUGGESTIONS,
  CATEGORY_UNCATEGORIZED,
  CATEGORY_OTHER,
];

const LEGACY_PRESET_CATEGORIES = [
  'Gas',
  'Eating Out',
  'Dining Out',
  'Entertainment',
  'Hobby Supplies',
  'Entrepreneurial',
  'Home Supplies',
  'Pets',
  'Gifts',
  'Travel',
  'Streaming Subscriptions',
];

const CATEGORY_ALIASES = {
  bill: CATEGORY_BILLS,
  bills: CATEGORY_BILLS,
  'bill payment': CATEGORY_BILLS,
  bill_payment: CATEGORY_BILLS,
  'scheduled bill': CATEGORY_BILLS,
  'scheduled bills': CATEGORY_BILLS,
  subscription: CATEGORY_SUBSCRIPTIONS,
  subscriptions: CATEGORY_SUBSCRIPTIONS,
  'streaming subscription': CATEGORY_SUBSCRIPTIONS,
  'streaming subscriptions': CATEGORY_SUBSCRIPTIONS,
  grocery: CATEGORY_GROCERIES,
  groceries: CATEGORY_GROCERIES,
  'eating out': 'Entertainment/Dining Out',
  'dining out': 'Entertainment/Dining Out',
  entertainment: 'Entertainment/Dining Out',
  restaurant: 'Entertainment/Dining Out',
  restaurants: 'Entertainment/Dining Out',
  uncategorized: CATEGORY_UNCATEGORIZED,
  gas: 'Transportation',
  fuel: 'Transportation',
  transport: 'Transportation',
  transportation: 'Transportation',
  'home supplies': 'Home',
  household: 'Home',
  entrepreneurial: 'Business Supplies',
  business: 'Business Supplies',
  'business supplies': 'Business Supplies',
};

export function canonicalCategoryLabel(value, fallback = CATEGORY_OTHER) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return CATEGORY_ALIASES[raw.toLowerCase()] || raw;
}

export function categoryKey(value) {
  return canonicalCategoryLabel(value).toLowerCase();
}

export function isAutoActiveSpendingCategory(value) {
  const key = categoryKey(value);
  return AUTO_ACTIVE_SPENDING_CATEGORIES.some(category => categoryKey(category) === key);
}

export function isKnownPresetSpendingCategory(value) {
  const key = categoryKey(value);
  return [...AUTO_ACTIVE_SPENDING_CATEGORIES, ...SPENDING_CATEGORY_SUGGESTIONS, ...LEGACY_PRESET_CATEGORIES]
    .some(category => categoryKey(category) === key);
}

export function dedupeCategoryLabels(items = []) {
  const seen = new Set();
  return (items || [])
    .map(item => canonicalCategoryLabel(item, ''))
    .filter(Boolean)
    .filter(item => {
      const key = categoryKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
