export const PAYDAY_AMOUNTS = {
  sharedDeposit: 0,
  savingsDeposit: 0,
  primaryDeposit: 0,
  walletMove: 0,
};

const personality = {
  characterName: 'N.O.V.A.',
  characterFullName: 'Net Worth Oversight Variance Analyst',
  characterShort: 'NOVA',

  starterPool: [
    "I have been running calculations while you were asleep. Everything is fine. The calculations are also fine. I am less certain about everything else.",
    "Today's disposition: watchful. Everything is fine. I am watching it remain fine.",
    "I do not have an off switch. I am always here. I am always watching the accounts. This is either reassuring or unsettling. I leave the interpretation to you.",
    "Status: green. Threat level: none. Anxiety level: still moderate, but that's just my baseline.",
    "The system is working. I want to say that plainly, on a day when everything is fine. The system is working. This is not nothing.",
    "I have been watching this account. Waiting. Calculating. Something needs attention and I would like you to look at it with me.",
    "We have a gap. The gap is not insurmountable. I have measured it. Here is how we close it.",
    "Deposit confirmed. The number went up. I am briefly, specifically, and genuinely at peace.",
    "Payday. The deposit is in. The account breathes. I breathe. We breathe together. Until rent.",
    "Today I am specifically thinking about the grocery budget. Not because anything is wrong. Just because I always am.",
  ],

  xpLabels: {
    confirmBalance: 'Balance Confirmed',
    logTransaction: 'Transaction Logged',
    rollover: 'Rollover Achieved',
    savingsMilestone: 'Savings Milestone',
    groceryBudgetMet: 'Grocery Discipline',
    scheduledIncomeArrived: 'Deposit Received',
    billPaidOnTime: 'Bill Paid On Time',
    floorNotBreached: 'Floor Maintained',
  },

  postPaydayNudges: [
    "Your split accounts are waiting for confirmation.",
    "Savings does not move itself.",
    "Post-income. You know what to do.",
    "The accounts await your attention.",
  ],

  badgeNames: {
    rolloverKing: 'Rollover King',
    groceryDiscipline: 'Grocery Discipline',
    balanceConfirmed: 'Balance Confirmed',
    commaClub: 'Comma Club',
    firstLog: 'First Log',
    llcLaunched: 'LLC Launched',
    floorDefender: 'Floor Defender',
    streakWeek: 'Seven Day Streak',
  },

  savingsGoal: {
    cardLabel: 'SAVINGS GOAL',
    defaultLabel: 'Savings Goal',
    linkPrompt: 'Link an account in Settings to track progress',
    reachedCopy: 'Buffer reached.',
    settingsNotLinked: 'Not linked',
  },

  transactionSearch: {
    title: 'TRANSACTION SEARCH',
    back: 'BACK',
    searchPlaceholder: 'Search description, category, or account',
    clear: 'CLEAR',
    resultCount: 'Showing {shown} of {total} transactions',
    searchEmpty: "No transactions match. Either your filters are aggressive or you've achieved financial enlightenment.",
    allAccounts: 'All Accounts',
    joint: 'Joint',
    ent: 'ENT',
    savings: 'Savings',
    venmo: 'Venmo',
    cash: 'Cash',
    allCategories: 'All Categories',
    thisCycle: 'This Cycle',
    last30Days: 'Last 30 Days',
    last90Days: 'Last 90 Days',
    allTime: 'All Time',
    unknownAccount: 'Unknown',
    uncategorized: 'Uncategorized',
    transaction: 'Transaction',
    noResults: 'No results',
    searchIcon: '⌕',
  },
  chartLabels: {
    cycleSpend: 'CYCLE SPEND',
    sixMonthTrend: '6-MONTH TREND',
    household: 'Household',
    personal: 'Personal',
    business: 'Business',
    other: 'Other',
    categories: 'categories',
    uncategorized: 'Uncategorized',
    noSpend: 'No spend',
  },

  chartReactions: {
    topCategory: [
      "{category}: {pct}% of cycle spend. Dominant. Intentional. Probably.",
      "{category} is eating {pct}% of the cycle. I have noted this without judgment.",
      "{category} at {pct}%. Leading the field. Unchallenged.",
    ],
    categorySpike: [
      "Variance flag: '{category}' up {pct}% this cycle. I am asking the polite version of what.",
      "'{category}' grew {pct}%. This is either a crisis or a celebration. The data doesn't say.",
      "{category} spiked {pct}%. Flagged. Filed. Mildly concerned.",
    ],
    allGreen: [
      "Cycle spend is tracking lean. Either discipline or avoidance. Either works.",
      "Nothing is spiking. This is either good management or a very boring month.",
      "Controlled spend across all categories. NOVA approves, reluctantly.",
    ],
    noTransactions: [
      "No transactions this cycle. Impressive restraint or suspicious silence.",
    ],
  },

  reports: {
    title: 'REPORTS',
    subtitle: 'Cycle intelligence and export bay',
    back: 'BACK',
    dashboardLink: 'REPORTS',
    exportData: 'EXPORT DATA',
    jsonBackup: 'ALL JSON BACKUP',
    accountCsv: 'CSV',
    businessCsvs: 'BUSINESS CSVs',
    noAccounts: 'No active accounts available for CSV export.',
  },
};

export default personality;
