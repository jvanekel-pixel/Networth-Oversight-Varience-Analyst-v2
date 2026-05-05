// XP awarded per event type. awardXP(eventType) looks up the value here.
// See NOVA_GAMIFICATION_PLAN.md for full rationale.
export const XP_EVENTS = {
  // Onboarding
  ONBOARDING_COMPLETE: 100,

  // Paycheck & income
  PAYCHECK_CONFIRMED_SAME_DAY: 200,  // confirmed on the calendar day it was expected
  PAYCHECK_CONFIRMED: 75,             // confirmed within 48hr but not same day
  PARTNER_DEPOSIT_LOGGED: 10,

  // Bills
  BILL_PAID_ON_TIME: 60,
  BILL_PAID_LATE: 25,

  // Balance & activity
  CONFIRM_BALANCE: 15,
  ADD_TRANSACTION: 10,

  // Post-payday allocation
  POST_PAYDAY_ACTION_COMPLETED: 50,

  // Business / entrepreneur mode
  BUSINESS_INCOME_LOGGED: 40,
  BUSINESS_EXPENSE_LOGGED: 30,
  BUSINESS_MILEAGE_LOGGED: 20,
};

// Which broad category each XP event belongs to.
// Used to track cross-category engagement for the NOVA AGENT badge (V3).
export const XP_CATEGORIES = {
  ONBOARDING_COMPLETE: 'onboarding',
  PAYCHECK_CONFIRMED_SAME_DAY: 'income',
  PAYCHECK_CONFIRMED: 'income',
  PARTNER_DEPOSIT_LOGGED: 'income',
  BILL_PAID_ON_TIME: 'bills',
  BILL_PAID_LATE: 'bills',
  POST_PAYDAY_ACTION_COMPLETED: 'savings',
  BUSINESS_INCOME_LOGGED: 'business',
  BUSINESS_EXPENSE_LOGGED: 'business',
  BUSINESS_MILEAGE_LOGGED: 'business',
  CONFIRM_BALANCE: 'balance',
  ADD_TRANSACTION: 'transactions',
};
