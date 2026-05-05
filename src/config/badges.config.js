// Legacy flat badges — used by checkAndAwardBadge (Stage 1-era system, preserved)
export const BADGES = [
  { id: 'first_log',         name: 'First Log',          description: 'First transaction logged',                                      earned: false, earnedAt: null, icon: '📝' },
  { id: 'rollover_king',     name: 'Rollover King',       description: 'First income split sweep',                                      earned: false, earnedAt: null, icon: '🏆' },
  { id: 'grocery_discipline',name: 'Grocery Discipline',  description: '4 consecutive weeks under grocery budget',                      earned: false, earnedAt: null, icon: '🥦' },
  { id: 'balance_confirmed', name: 'Balance Confirmed',   description: '7-day Confirm Balance streak',                                  earned: false, earnedAt: null, icon: '✅' },
  { id: 'comma_club',        name: 'Comma Club',          description: 'Any savings account reaches $1,000',                            earned: false, earnedAt: null, icon: '💰' },
  { id: 'llc_launched',      name: 'Business Launched',   description: 'First business expense logged',                                 earned: false, earnedAt: null, icon: '🏢' },
  { id: 'business_income',   name: 'First Client',        description: 'First business income logged',                                  earned: false, earnedAt: null, icon: '💼' },
  { id: 'cycle_complete',    name: 'Full Cycle',          description: 'Complete one full calendar month with all bills marked paid',   earned: false, earnedAt: null, icon: '📅' },
];

export const getDefaultBadges = () => BADGES.map(b => ({ ...b }));

// ─────────────────────────────────────────────────────────────────────────────
// Tiered badge system (Stage 3) — Ingress-style Bronze → Silver → Gold → Platinum → Onyx
// Each badge has three variables; ALL three must meet or exceed the tier threshold.
// Higher tiers implicitly satisfy all lower tiers.
// ─────────────────────────────────────────────────────────────────────────────

export const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'onyx'];

// vars: labels and units for UI display (badgeEngine reads values from actionCounts/streakData)
// tiers: array in Bronze→Onyx order, each has v1/v2/v3 thresholds that must ALL be met

export const TIERED_BADGES = [
  {
    id: 'payday_oracle',
    name: 'Payday Oracle',
    tagline: 'You showed up when it mattered.',
    entrepreneurOnly: false,
    vars: {
      v1: { label: 'Same-day confirms',              unit: 'confirms' },
      v2: { label: 'Income XP earned',               unit: 'XP'       },
      v3: { label: 'Consecutive paychecks on time',  unit: 'in a row' },
    },
    tiers: [
      { tier: 'bronze',   v1: 2,   v2: 300,   v3: 2  },
      { tier: 'silver',   v1: 8,   v2: 1200,  v3: 4  },
      { tier: 'gold',     v1: 20,  v2: 3500,  v3: 8  },
      { tier: 'platinum', v1: 50,  v2: 9000,  v3: 16 },
      { tier: 'onyx',     v1: 100, v2: 20000, v3: 26 },
    ],
  },

  {
    id: 'vault_guardian',
    name: 'Vault Guardian',
    tagline: 'Building the thing you said you would.',
    entrepreneurOnly: false,
    vars: {
      v1: { label: 'Savings allocations confirmed',  unit: 'deposits'  },
      v2: { label: 'Savings XP earned',              unit: 'XP'        },
      // V3: % of savings goal reached (0-100). Source: live computation from accounts+novaConfig.
      v3: { label: 'Savings goal reached',           unit: '%'         },
    },
    tiers: [
      { tier: 'bronze',   v1: 3,   v2: 50,   v3: 10  },
      { tier: 'silver',   v1: 10,  v2: 300,  v3: 25  },
      { tier: 'gold',     v1: 25,  v2: 1000, v3: 50  },
      { tier: 'platinum', v1: 60,  v2: 3500, v3: 75  },
      { tier: 'onyx',     v1: 100, v2: 8000, v3: 100 },
    ],
  },

  {
    id: 'bill_slayer',
    name: 'Bill Slayer',
    tagline: "Recurring obligations don't scare you.",
    entrepreneurOnly: false,
    vars: {
      v1: { label: 'Bills paid on time',                      unit: 'bills'  },
      v2: { label: 'Bill-related XP earned',                  unit: 'XP'     },
      v3: { label: 'Consecutive months — zero late bills',    unit: 'months' },
    },
    tiers: [
      { tier: 'bronze',   v1: 5,   v2: 200,   v3: 1  },
      { tier: 'silver',   v1: 20,  v2: 800,   v3: 3  },
      { tier: 'gold',     v1: 50,  v2: 2000,  v3: 6  },
      { tier: 'platinum', v1: 120, v2: 5500,  v3: 12 },
      { tier: 'onyx',     v1: 300, v2: 15000, v3: 24 },
    ],
  },

  {
    id: 'grocery_sentinel',
    name: 'Grocery Sentinel',
    tagline: 'The most frequent battlefield in your budget.',
    entrepreneurOnly: false,
    vars: {
      v1: { label: 'Weeks ended under budget',        unit: 'weeks'    },
      v2: { label: 'Grocery entries logged',          unit: 'entries'  },
      // V2 uses entry count directly (each entry ≈ 10 XP; stored as actionCounts.groceryEntriesLogged)
      v3: { label: 'Consecutive weeks under limit',   unit: 'in a row' },
    },
    tiers: [
      { tier: 'bronze',   v1: 2,   v2: 8,   v3: 2  },
      { tier: 'silver',   v1: 8,   v2: 35,  v3: 4  },
      { tier: 'gold',     v1: 20,  v2: 100, v3: 8  },
      { tier: 'platinum', v1: 52,  v2: 300, v3: 18 },
      { tier: 'onyx',     v1: 104, v2: 750, v3: 32 },
    ],
    // V2 thresholds are entry counts (divide plan's XP values by 10 since each entry = 10 XP)
  },

  {
    id: 'ledger_keeper',
    name: 'Ledger Keeper',
    tagline: 'The habit of looking.',
    entrepreneurOnly: false,
    vars: {
      v1: { label: 'Balance confirmations',                unit: 'confirms' },
      v2: { label: 'Balance confirmation XP',             unit: 'XP'       },
      v3: { label: 'Distinct weeks with 1+ confirmation', unit: 'weeks'    },
    },
    tiers: [
      { tier: 'bronze',   v1: 5,   v2: 75,   v3: 3   },
      { tier: 'silver',   v1: 25,  v2: 375,  v3: 10  },
      { tier: 'gold',     v1: 75,  v2: 1125, v3: 26  },
      { tier: 'platinum', v1: 200, v2: 3000, v3: 52  },
      { tier: 'onyx',     v1: 500, v2: 7500, v3: 100 },
    ],
  },

  {
    id: 'cycle_closer',
    name: 'Cycle Closer',
    tagline: 'You finished the month with your eyes open.',
    entrepreneurOnly: false,
    vars: {
      v1: { label: 'Cycles completed',          unit: 'cycles' },
      v2: { label: 'Best single-cycle XP',      unit: 'XP'     },
      v3: { label: 'Cycles ending in green',    unit: 'cycles' },
    },
    tiers: [
      { tier: 'bronze',   v1: 2,  v2: 150,  v3: 1  },
      { tier: 'silver',   v1: 6,  v2: 400,  v3: 3  },
      { tier: 'gold',     v1: 12, v2: 800,  v3: 6  },
      { tier: 'platinum', v1: 24, v2: 1500, v3: 12 },
      { tier: 'onyx',     v1: 48, v2: 2500, v3: 24 },
    ],
  },

  {
    id: 'income_architect',
    name: 'Income Architect',
    tagline: 'Every dollar had a destination before it arrived.',
    entrepreneurOnly: false,
    vars: {
      v1: { label: 'Paychecks confirmed with active split', unit: 'paychecks' },
      v2: { label: 'Savings / split XP earned',            unit: 'XP'         },
      // V3: % of paycheck allocated across all active splits (0-100)
      v3: { label: 'Paycheck coverage by splits',          unit: '%'          },
    },
    tiers: [
      { tier: 'bronze',   v1: 2,   v2: 120,   v3: 1   },
      { tier: 'silver',   v1: 8,   v2: 500,   v3: 25  },
      { tier: 'gold',     v1: 20,  v2: 1500,  v3: 75  },
      { tier: 'platinum', v1: 50,  v2: 4000,  v3: 90  },
      { tier: 'onyx',     v1: 100, v2: 10000, v3: 100 },
    ],
  },

  {
    id: 'variance_analyst',
    name: 'Variance Analyst',
    tagline: "You didn't just see yellow. You understood it.",
    entrepreneurOnly: false,
    vars: {
      v1: { label: 'Balance confirmations',     unit: 'confirms'    },
      v2: { label: 'Balance / variance XP',    unit: 'XP'          },
      v3: { label: 'Yellow → Green recoveries', unit: 'recoveries'  },
    },
    tiers: [
      { tier: 'bronze',   v1: 5,   v2: 100,  v3: 1  },
      { tier: 'silver',   v1: 20,  v2: 400,  v3: 3  },
      { tier: 'gold',     v1: 60,  v2: 1200, v3: 8  },
      { tier: 'platinum', v1: 150, v2: 3500, v3: 20 },
      { tier: 'onyx',     v1: 400, v2: 9000, v3: 40 },
    ],
  },

  {
    id: 'entrepreneur',
    name: 'Entrepreneur',
    tagline: 'Real numbers on a real hustle.',
    entrepreneurOnly: true,
    vars: {
      v1: { label: 'Business transactions logged',       unit: 'transactions' },
      v2: { label: 'Total business income tracked',      unit: 'dollars'      },
      v3: { label: 'Complete P&L months (income+expense)', unit: 'months'     },
    },
    tiers: [
      { tier: 'bronze',   v1: 5,   v2: 100,   v3: 1  },
      { tier: 'silver',   v1: 20,  v2: 500,   v3: 3  },
      { tier: 'gold',     v1: 60,  v2: 2000,  v3: 6  },
      { tier: 'platinum', v1: 150, v2: 7500,  v3: 12 },
      { tier: 'onyx',     v1: 400, v2: 25000, v3: 24 },
    ],
    // V2 thresholds are in whole dollars (engine divides totalBusinessIncomeCents by 100)
  },

  {
    id: 'nova_agent',
    name: 'NOVA Agent',
    tagline: "You're not just using an app. You're building a practice.",
    entrepreneurOnly: false,
    vars: {
      v1: { label: 'Total XP',                              unit: 'XP'    },
      v2: { label: 'Distinct active days',                  unit: 'days'  },
      v3: { label: 'Weeks with XP in 3+ categories',        unit: 'weeks' },
    },
    tiers: [
      { tier: 'bronze',   v1: 500,   v2: 14,  v3: 4   },
      { tier: 'silver',   v1: 2500,  v2: 45,  v3: 12  },
      { tier: 'gold',     v1: 8000,  v2: 120, v3: 30  },
      { tier: 'platinum', v1: 22000, v2: 300, v3: 65  },
      { tier: 'onyx',     v1: 60000, v2: 600, v3: 130 },
    ],
  },
];
